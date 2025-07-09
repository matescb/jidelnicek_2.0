#!/usr/bin/env python3
"""
Redis Session Cleanup Script for Jídelníček 2.0
Manages session cleanup and provides session statistics
"""

import os
import sys
import redis
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Tuple

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class SessionCleaner:
    def __init__(self, redis_url: str = None, redis_password: str = None):
        """Initialize session cleaner with Redis connection"""
        self.redis_url = redis_url or os.getenv('REDIS_URL', 'redis://localhost:6379')
        self.redis_password = redis_password or os.getenv('REDIS_PASSWORD', '')
        
        # Connect to Redis
        self.redis_client = redis.from_url(
            self.redis_url,
            password=self.redis_password,
            decode_responses=True
        )
        
        # Switch to session database (DB 0)
        self.redis_client.select(0)
    
    def _safe_scan_keys(self, pattern: str, count: int = 100) -> List[str]:
        """Safely scan for keys matching pattern without blocking"""
        keys = []
        cursor = 0
        
        while True:
            cursor, batch = self.redis_client.scan(
                cursor=cursor,
                match=pattern,
                count=count
            )
            keys.extend(batch)
            
            if cursor == 0:
                break
        
        return keys
    
    def get_session_stats(self) -> Dict[str, int]:
        """Get statistics about current sessions"""
        stats = {
            'user_sessions': 0,
            'admin_sessions': 0,
            'session_metadata': 0,
            'total_sessions': 0,
            'expired_sessions': 0
        }
        
        # Count user sessions
        user_sessions = self._safe_scan_keys("session:user:*")
        stats['user_sessions'] = len([k for k in user_sessions if ':' in k.split('session:user:')[1]])
        
        # Count admin sessions
        admin_sessions = self._safe_scan_keys("session:admin:*")
        stats['admin_sessions'] = len([k for k in admin_sessions if ':' in k.split('session:admin:')[1]])
        
        # Count session metadata
        meta_sessions = self._safe_scan_keys("session:meta:*")
        stats['session_metadata'] = len(meta_sessions)
        
        # Total active sessions
        stats['total_sessions'] = stats['user_sessions'] + stats['admin_sessions']
        
        # Check for expired sessions (sessions without TTL)
        all_session_keys = user_sessions + admin_sessions
        for key in all_session_keys:
            ttl = self.redis_client.ttl(key)
            if ttl == -1:  # No expiration set
                stats['expired_sessions'] += 1
        
        return stats
    
    def cleanup_expired_sessions(self, dry_run: bool = False) -> int:
        """Remove sessions that don't have TTL set (expired)"""
        logger.info("Cleaning up expired sessions...")
        
        patterns = [
            "session:user:*",
            "session:admin:*",
            "session:meta:*"
        ]
        
        expired_keys = []
        
        for pattern in patterns:
            keys = self._safe_scan_keys(pattern)
            for key in keys:
                ttl = self.redis_client.ttl(key)
                if ttl == -1:  # No expiration set
                    expired_keys.append(key)
        
        count = len(expired_keys)
        
        if count == 0:
            logger.info("No expired sessions found")
            return 0
        
        logger.info(f"Found {count} expired sessions")
        
        if dry_run:
            logger.info("DRY RUN - Would remove the following sessions:")
            for key in expired_keys[:10]:
                logger.info(f"  - {key}")
            if count > 10:
                logger.info(f"  ... and {count - 10} more sessions")
        else:
            # Delete in batches
            batch_size = 1000
            for i in range(0, count, batch_size):
                batch = expired_keys[i:i + batch_size]
                self.redis_client.delete(*batch)
            
            logger.info(f"Successfully removed {count} expired sessions")
        
        return count
    
    def cleanup_orphaned_metadata(self, dry_run: bool = False) -> int:
        """Remove metadata for sessions that no longer exist"""
        logger.info("Cleaning up orphaned session metadata...")
        
        meta_keys = self._safe_scan_keys("session:meta:*")
        orphaned_keys = []
        
        for meta_key in meta_keys:
            session_id = meta_key.split("session:meta:")[1]
            
            # Check if corresponding session exists
            user_session_exists = self.redis_client.exists(f"session:user:*:{session_id}")
            admin_session_exists = self.redis_client.exists(f"session:admin:*:{session_id}")
            
            if not user_session_exists and not admin_session_exists:
                orphaned_keys.append(meta_key)
        
        count = len(orphaned_keys)
        
        if count == 0:
            logger.info("No orphaned metadata found")
            return 0
        
        logger.info(f"Found {count} orphaned metadata entries")
        
        if dry_run:
            logger.info("DRY RUN - Would remove the following metadata:")
            for key in orphaned_keys[:10]:
                logger.info(f"  - {key}")
            if count > 10:
                logger.info(f"  ... and {count - 10} more entries")
        else:
            # Delete in batches
            batch_size = 1000
            for i in range(0, count, batch_size):
                batch = orphaned_keys[i:i + batch_size]
                self.redis_client.delete(*batch)
            
            logger.info(f"Successfully removed {count} orphaned metadata entries")
        
        return count
    
    def cleanup_old_sessions(self, days: int = 1, dry_run: bool = False) -> int:
        """Remove sessions older than specified days (based on TTL)"""
        logger.info(f"Cleaning up sessions with less than {days} days remaining...")
        
        patterns = [
            "session:user:*",
            "session:admin:*"
        ]
        
        old_keys = []
        threshold_seconds = days * 24 * 60 * 60
        
        for pattern in patterns:
            keys = self._safe_scan_keys(pattern)
            for key in keys:
                ttl = self.redis_client.ttl(key)
                if 0 < ttl < threshold_seconds:
                    old_keys.append(key)
        
        count = len(old_keys)
        
        if count == 0:
            logger.info("No old sessions found")
            return 0
        
        logger.info(f"Found {count} old sessions")
        
        if dry_run:
            logger.info("DRY RUN - Would remove the following sessions:")
            for key in old_keys[:10]:
                ttl = self.redis_client.ttl(key)
                hours_left = ttl / 3600
                logger.info(f"  - {key} (expires in {hours_left:.1f} hours)")
            if count > 10:
                logger.info(f"  ... and {count - 10} more sessions")
        else:
            # Delete in batches
            batch_size = 1000
            for i in range(0, count, batch_size):
                batch = old_keys[i:i + batch_size]
                self.redis_client.delete(*batch)
            
            logger.info(f"Successfully removed {count} old sessions")
        
        return count
    
    def get_active_users(self) -> List[Dict[str, str]]:
        """Get list of currently active users"""
        active_users = []
        
        user_sessions = self._safe_scan_keys("session:user:*")
        
        for session_key in user_sessions:
            if session_key.count(':') >= 3:  # Valid session key format
                parts = session_key.split(':')
                user_id = parts[2]
                session_id = parts[3]
                
                # Get session data if available
                session_data = self.redis_client.get(session_key)
                ttl = self.redis_client.ttl(session_key)
                
                active_users.append({
                    'user_id': user_id,
                    'session_id': session_id,
                    'ttl_minutes': round(ttl / 60) if ttl > 0 else 0,
                    'has_data': bool(session_data)
                })
        
        return active_users
    
    def force_logout_user(self, user_id: int, dry_run: bool = False) -> int:
        """Force logout a specific user by removing all their sessions"""
        logger.info(f"Force logging out user ID: {user_id}")
        
        pattern = f"session:user:{user_id}:*"
        user_sessions = self._safe_scan_keys(pattern)
        
        # Also get associated metadata
        meta_keys = []
        for session_key in user_sessions:
            session_id = session_key.split(':')[-1]
            meta_key = f"session:meta:{session_id}"
            if self.redis_client.exists(meta_key):
                meta_keys.append(meta_key)
        
        all_keys = user_sessions + meta_keys
        count = len(all_keys)
        
        if count == 0:
            logger.info("No active sessions found for this user")
            return 0
        
        logger.info(f"Found {len(user_sessions)} sessions and {len(meta_keys)} metadata entries")
        
        if dry_run:
            logger.info("DRY RUN - Would remove the following keys:")
            for key in all_keys:
                logger.info(f"  - {key}")
        else:
            self.redis_client.delete(*all_keys)
            logger.info(f"Successfully logged out user {user_id}")
        
        return count
    
    def full_cleanup(self, dry_run: bool = False) -> Dict[str, int]:
        """Perform full session cleanup"""
        logger.info("Performing full session cleanup...")
        
        results = {
            'expired_sessions': 0,
            'orphaned_metadata': 0,
            'old_sessions': 0,
            'total_cleaned': 0
        }
        
        # Clean expired sessions
        results['expired_sessions'] = self.cleanup_expired_sessions(dry_run)
        
        # Clean orphaned metadata
        results['orphaned_metadata'] = self.cleanup_orphaned_metadata(dry_run)
        
        # Clean old sessions (older than 1 day)
        results['old_sessions'] = self.cleanup_old_sessions(days=1, dry_run=dry_run)
        
        results['total_cleaned'] = sum(results.values()) - results['total_cleaned']
        
        return results


def main():
    """Main entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Redis session cleanup for Jídelníček 2.0')
    
    # Add subcommands
    subparsers = parser.add_subparsers(dest='command', help='Cleanup commands')
    
    # Stats command
    stats_parser = subparsers.add_parser('stats', help='Show session statistics')
    
    # Cleanup expired
    expired_parser = subparsers.add_parser('expired', help='Clean up expired sessions')
    expired_parser.add_argument('--dry-run', action='store_true', help='Show what would be cleaned')
    
    # Cleanup orphaned
    orphaned_parser = subparsers.add_parser('orphaned', help='Clean up orphaned metadata')
    orphaned_parser.add_argument('--dry-run', action='store_true', help='Show what would be cleaned')
    
    # Cleanup old
    old_parser = subparsers.add_parser('old', help='Clean up old sessions')
    old_parser.add_argument('--days', type=int, default=1, help='Sessions older than N days')
    old_parser.add_argument('--dry-run', action='store_true', help='Show what would be cleaned')
    
    # Full cleanup
    full_parser = subparsers.add_parser('full', help='Perform full cleanup')
    full_parser.add_argument('--dry-run', action='store_true', help='Show what would be cleaned')
    
    # Active users
    active_parser = subparsers.add_parser('active', help='Show active users')
    
    # Force logout
    logout_parser = subparsers.add_parser('logout', help='Force logout a user')
    logout_parser.add_argument('user_id', type=int, help='User ID to logout')
    logout_parser.add_argument('--dry-run', action='store_true', help='Show what would be done')
    
    # Global arguments
    parser.add_argument('--redis-url', help='Redis connection URL')
    parser.add_argument('--redis-password', help='Redis password')
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        sys.exit(1)
    
    # Initialize cleaner
    cleaner = SessionCleaner(
        redis_url=args.redis_url,
        redis_password=args.redis_password
    )
    
    # Execute command
    if args.command == 'stats':
        stats = cleaner.get_session_stats()
        print("\nSession Statistics:")
        print("-" * 40)
        for key, value in stats.items():
            print(f"{key:.<30} {value}")
    
    elif args.command == 'expired':
        cleaner.cleanup_expired_sessions(args.dry_run)
    
    elif args.command == 'orphaned':
        cleaner.cleanup_orphaned_metadata(args.dry_run)
    
    elif args.command == 'old':
        cleaner.cleanup_old_sessions(args.days, args.dry_run)
    
    elif args.command == 'full':
        results = cleaner.full_cleanup(args.dry_run)
        print("\nFull Cleanup Results:")
        print("-" * 40)
        for key, value in results.items():
            print(f"{key:.<30} {value}")
    
    elif args.command == 'active':
        users = cleaner.get_active_users()
        print(f"\nActive Users ({len(users)} total):")
        print("-" * 60)
        print(f"{'User ID':<15} {'Session ID':<25} {'TTL (min)':<10} {'Has Data':<10}")
        print("-" * 60)
        for user in users[:20]:  # Show first 20
            print(f"{user['user_id']:<15} {user['session_id']:<25} {user['ttl_minutes']:<10} {user['has_data']:<10}")
        if len(users) > 20:
            print(f"\n... and {len(users) - 20} more users")
    
    elif args.command == 'logout':
        cleaner.force_logout_user(args.user_id, args.dry_run)


if __name__ == '__main__':
    main()