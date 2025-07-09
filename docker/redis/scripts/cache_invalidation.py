#!/usr/bin/env python3
"""
Redis Cache Invalidation Script for Jídelníček 2.0
Provides utilities for invalidating cache entries based on various patterns
"""

import os
import sys
import redis
import logging
from typing import List, Optional, Set
from datetime import datetime

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class CacheInvalidator:
    def __init__(self, redis_url: str = None, redis_password: str = None):
        """Initialize cache invalidator with Redis connection"""
        self.redis_url = redis_url or os.getenv('REDIS_URL', 'redis://localhost:6379')
        self.redis_password = redis_password or os.getenv('REDIS_PASSWORD', '')
        
        # Connect to Redis
        self.redis_client = redis.from_url(
            self.redis_url,
            password=self.redis_password,
            decode_responses=True
        )
        
        # Switch to cache database (DB 1)
        self.redis_client.select(1)
    
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
    
    def invalidate_pattern(self, pattern: str, dry_run: bool = False) -> int:
        """Invalidate all keys matching the given pattern"""
        logger.info(f"Invalidating keys matching pattern: {pattern}")
        
        keys = self._safe_scan_keys(pattern)
        count = len(keys)
        
        if count == 0:
            logger.info("No keys found matching pattern")
            return 0
        
        logger.info(f"Found {count} keys to invalidate")
        
        if dry_run:
            logger.info("DRY RUN - Would invalidate the following keys:")
            for key in keys[:10]:  # Show first 10 keys
                logger.info(f"  - {key}")
            if count > 10:
                logger.info(f"  ... and {count - 10} more keys")
        else:
            # Delete keys in batches for better performance
            batch_size = 1000
            for i in range(0, count, batch_size):
                batch = keys[i:i + batch_size]
                self.redis_client.delete(*batch)
            
            logger.info(f"Successfully invalidated {count} keys")
        
        return count
    
    def invalidate_user_cache(self, user_id: int, dry_run: bool = False) -> int:
        """Invalidate all cache entries for a specific user"""
        logger.info(f"Invalidating cache for user ID: {user_id}")
        
        patterns = [
            f"cache:user:profile:{user_id}",
            f"cache:order:user:{user_id}:*",
            f"session:user:{user_id}:*"  # Also clear sessions
        ]
        
        total_invalidated = 0
        for pattern in patterns:
            total_invalidated += self.invalidate_pattern(pattern, dry_run)
        
        return total_invalidated
    
    def invalidate_restaurant_cache(self, restaurant_id: int, dry_run: bool = False) -> int:
        """Invalidate all cache entries for a specific restaurant"""
        logger.info(f"Invalidating cache for restaurant ID: {restaurant_id}")
        
        patterns = [
            f"cache:restaurant:detail:{restaurant_id}",
            f"cache:restaurant:menu_categories:{restaurant_id}",
            f"cache:menu:daily:{restaurant_id}:*",
            f"cache:menu:weekly:{restaurant_id}:*",
            f"cache:stats:meal:popular:{restaurant_id}:*",
            f"cache:stats:order:summary:{restaurant_id}:*",
            "cache:restaurant:list:active"  # Also invalidate the list
        ]
        
        total_invalidated = 0
        for pattern in patterns:
            total_invalidated += self.invalidate_pattern(pattern, dry_run)
        
        return total_invalidated
    
    def invalidate_menu_cache(self, restaurant_id: Optional[int] = None, 
                            date: Optional[str] = None, dry_run: bool = False) -> int:
        """Invalidate menu cache entries"""
        logger.info("Invalidating menu cache")
        
        patterns = []
        
        if restaurant_id and date:
            patterns.append(f"cache:menu:daily:{restaurant_id}:{date}")
        elif restaurant_id:
            patterns.append(f"cache:menu:daily:{restaurant_id}:*")
            patterns.append(f"cache:menu:weekly:{restaurant_id}:*")
        elif date:
            patterns.append(f"cache:menu:daily:*:{date}")
        else:
            patterns.append("cache:menu:*")
        
        total_invalidated = 0
        for pattern in patterns:
            total_invalidated += self.invalidate_pattern(pattern, dry_run)
        
        return total_invalidated
    
    def invalidate_meal_cache(self, meal_id: Optional[int] = None, dry_run: bool = False) -> int:
        """Invalidate meal cache entries"""
        logger.info("Invalidating meal cache")
        
        if meal_id:
            patterns = [
                f"cache:meal:detail:{meal_id}",
                f"cache:meal:nutrition:{meal_id}"
            ]
        else:
            patterns = ["cache:meal:*"]
        
        total_invalidated = 0
        for pattern in patterns:
            total_invalidated += self.invalidate_pattern(pattern, dry_run)
        
        # Also invalidate related menu caches
        total_invalidated += self.invalidate_pattern("cache:menu:*", dry_run)
        
        return total_invalidated
    
    def invalidate_order_cache(self, order_id: Optional[int] = None, 
                             user_id: Optional[int] = None, dry_run: bool = False) -> int:
        """Invalidate order cache entries"""
        logger.info("Invalidating order cache")
        
        patterns = []
        
        if order_id:
            patterns.append(f"cache:order:detail:{order_id}")
        
        if user_id:
            patterns.append(f"cache:order:user:{user_id}:recent")
        
        if not order_id and not user_id:
            patterns.append("cache:order:*")
        
        total_invalidated = 0
        for pattern in patterns:
            total_invalidated += self.invalidate_pattern(pattern, dry_run)
        
        return total_invalidated
    
    def invalidate_stats_cache(self, restaurant_id: Optional[int] = None, dry_run: bool = False) -> int:
        """Invalidate statistics cache entries"""
        logger.info("Invalidating statistics cache")
        
        if restaurant_id:
            patterns = [
                f"cache:stats:meal:popular:{restaurant_id}:*",
                f"cache:stats:order:summary:{restaurant_id}:*"
            ]
        else:
            patterns = ["cache:stats:*"]
        
        total_invalidated = 0
        for pattern in patterns:
            total_invalidated += self.invalidate_pattern(pattern, dry_run)
        
        return total_invalidated
    
    def invalidate_all_cache(self, dry_run: bool = False) -> int:
        """Invalidate all cache entries (use with caution!)"""
        logger.warning("Invalidating ALL cache entries!")
        
        if not dry_run:
            response = input("Are you sure you want to invalidate ALL cache? (yes/no): ")
            if response.lower() != 'yes':
                logger.info("Operation cancelled")
                return 0
        
        return self.invalidate_pattern("cache:*", dry_run)
    
    def get_cache_info(self) -> dict:
        """Get information about current cache state"""
        info = {}
        
        # Get key counts by pattern
        patterns = [
            "cache:user:*",
            "cache:restaurant:*",
            "cache:menu:*",
            "cache:meal:*",
            "cache:order:*",
            "cache:allergen:*",
            "cache:stats:*"
        ]
        
        for pattern in patterns:
            keys = self._safe_scan_keys(pattern)
            info[pattern] = len(keys)
        
        # Get total keys
        dbinfo = self.redis_client.info('keyspace')
        info['total_keys'] = dbinfo.get('db1', {}).get('keys', 0)
        
        # Get memory usage
        memory_info = self.redis_client.info('memory')
        info['used_memory'] = memory_info.get('used_memory_human', 'N/A')
        
        return info


def main():
    """Main entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Redis cache invalidation for Jídelníček 2.0')
    
    # Add subcommands
    subparsers = parser.add_subparsers(dest='command', help='Invalidation commands')
    
    # Pattern invalidation
    pattern_parser = subparsers.add_parser('pattern', help='Invalidate by pattern')
    pattern_parser.add_argument('pattern', help='Key pattern to invalidate')
    pattern_parser.add_argument('--dry-run', action='store_true', help='Show what would be invalidated')
    
    # User invalidation
    user_parser = subparsers.add_parser('user', help='Invalidate user cache')
    user_parser.add_argument('user_id', type=int, help='User ID')
    user_parser.add_argument('--dry-run', action='store_true', help='Show what would be invalidated')
    
    # Restaurant invalidation
    restaurant_parser = subparsers.add_parser('restaurant', help='Invalidate restaurant cache')
    restaurant_parser.add_argument('restaurant_id', type=int, help='Restaurant ID')
    restaurant_parser.add_argument('--dry-run', action='store_true', help='Show what would be invalidated')
    
    # Menu invalidation
    menu_parser = subparsers.add_parser('menu', help='Invalidate menu cache')
    menu_parser.add_argument('--restaurant-id', type=int, help='Restaurant ID')
    menu_parser.add_argument('--date', help='Date (YYYY-MM-DD)')
    menu_parser.add_argument('--dry-run', action='store_true', help='Show what would be invalidated')
    
    # Meal invalidation
    meal_parser = subparsers.add_parser('meal', help='Invalidate meal cache')
    meal_parser.add_argument('--meal-id', type=int, help='Meal ID')
    meal_parser.add_argument('--dry-run', action='store_true', help='Show what would be invalidated')
    
    # Order invalidation
    order_parser = subparsers.add_parser('order', help='Invalidate order cache')
    order_parser.add_argument('--order-id', type=int, help='Order ID')
    order_parser.add_argument('--user-id', type=int, help='User ID')
    order_parser.add_argument('--dry-run', action='store_true', help='Show what would be invalidated')
    
    # Stats invalidation
    stats_parser = subparsers.add_parser('stats', help='Invalidate statistics cache')
    stats_parser.add_argument('--restaurant-id', type=int, help='Restaurant ID')
    stats_parser.add_argument('--dry-run', action='store_true', help='Show what would be invalidated')
    
    # All cache invalidation
    all_parser = subparsers.add_parser('all', help='Invalidate all cache')
    all_parser.add_argument('--dry-run', action='store_true', help='Show what would be invalidated')
    
    # Info command
    info_parser = subparsers.add_parser('info', help='Show cache information')
    
    # Global arguments
    parser.add_argument('--redis-url', help='Redis connection URL')
    parser.add_argument('--redis-password', help='Redis password')
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        sys.exit(1)
    
    # Initialize invalidator
    invalidator = CacheInvalidator(
        redis_url=args.redis_url,
        redis_password=args.redis_password
    )
    
    # Execute command
    if args.command == 'pattern':
        invalidator.invalidate_pattern(args.pattern, args.dry_run)
    
    elif args.command == 'user':
        invalidator.invalidate_user_cache(args.user_id, args.dry_run)
    
    elif args.command == 'restaurant':
        invalidator.invalidate_restaurant_cache(args.restaurant_id, args.dry_run)
    
    elif args.command == 'menu':
        invalidator.invalidate_menu_cache(args.restaurant_id, args.date, args.dry_run)
    
    elif args.command == 'meal':
        invalidator.invalidate_meal_cache(args.meal_id, args.dry_run)
    
    elif args.command == 'order':
        invalidator.invalidate_order_cache(args.order_id, args.user_id, args.dry_run)
    
    elif args.command == 'stats':
        invalidator.invalidate_stats_cache(args.restaurant_id, args.dry_run)
    
    elif args.command == 'all':
        invalidator.invalidate_all_cache(args.dry_run)
    
    elif args.command == 'info':
        info = invalidator.get_cache_info()
        print("\nCache Information:")
        print("-" * 40)
        for key, value in info.items():
            print(f"{key:.<30} {value}")


if __name__ == '__main__':
    main()