#!/usr/bin/env python3
"""
Test Redis Configuration for Jídelníček 2.0
Verifies Redis connectivity and basic operations
"""

import os
import sys
import redis
import time
from datetime import datetime

def test_redis_connection():
    """Test Redis connection and configuration"""
    
    redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379')
    redis_password = os.getenv('REDIS_PASSWORD', '')
    
    print(f"Testing Redis connection to: {redis_url}")
    print("-" * 50)
    
    try:
        # Test connection
        r = redis.from_url(redis_url, password=redis_password, decode_responses=True)
        
        # Test ping
        print("1. Testing connection...")
        pong = r.ping()
        print(f"   ✓ Connection successful: {pong}")
        
        # Test authentication
        print("\n2. Testing authentication...")
        info = r.info('server')
        print(f"   ✓ Redis version: {info.get('redis_version', 'Unknown')}")
        
        # Test database selection
        print("\n3. Testing database selection...")
        for db in range(4):
            r.select(db)
            r.set(f'test:db{db}', f'Database {db} test', ex=10)
            value = r.get(f'test:db{db}')
            print(f"   ✓ DB {db}: {value}")
        
        # Test session operations (DB 0)
        print("\n4. Testing session operations (DB 0)...")
        r.select(0)
        session_key = "session:user:test:123456"
        r.setex(session_key, 1800, "test_session_data")  # 30 min TTL
        ttl = r.ttl(session_key)
        print(f"   ✓ Session created with TTL: {ttl} seconds")
        r.delete(session_key)
        
        # Test cache operations (DB 1)
        print("\n5. Testing cache operations (DB 1)...")
        r.select(1)
        cache_key = "cache:test:data"
        test_data = '{"test": "data", "timestamp": "' + str(datetime.now()) + '"}'
        r.setex(cache_key, 3600, test_data)  # 1 hour TTL
        cached = r.get(cache_key)
        print(f"   ✓ Cache write/read successful")
        r.delete(cache_key)
        
        # Test rate limiting (DB 2)
        print("\n6. Testing rate limiting (DB 2)...")
        r.select(2)
        rate_key = "ratelimit:test:user:1min"
        r.incr(rate_key)
        r.expire(rate_key, 60)
        count = r.get(rate_key)
        print(f"   ✓ Rate limit counter: {count}")
        r.delete(rate_key)
        
        # Test memory info
        print("\n7. Testing memory configuration...")
        memory_info = r.info('memory')
        print(f"   ✓ Used memory: {memory_info.get('used_memory_human', 'Unknown')}")
        print(f"   ✓ Max memory: {r.config_get('maxmemory').get('maxmemory', 'Not set')}")
        print(f"   ✓ Eviction policy: {r.config_get('maxmemory-policy').get('maxmemory-policy', 'Not set')}")
        
        # Test persistence
        print("\n8. Testing persistence configuration...")
        r.select(1)
        persistence_info = r.info('persistence')
        print(f"   ✓ AOF enabled: {persistence_info.get('aof_enabled', 0) == 1}")
        print(f"   ✓ RDB last save: {datetime.fromtimestamp(persistence_info.get('rdb_last_save_time', 0))}")
        
        # Test key patterns
        print("\n9. Testing key pattern operations...")
        test_keys = [
            "cache:user:profile:1",
            "cache:menu:daily:1:2024-01-09",
            "cache:meal:detail:100"
        ]
        for key in test_keys:
            r.setex(key, 60, f"Test data for {key}")
        
        found_keys = list(r.scan_iter("cache:*"))
        print(f"   ✓ Created {len(test_keys)} test keys")
        print(f"   ✓ Found {len(found_keys)} cache keys")
        
        # Cleanup
        for key in test_keys:
            r.delete(key)
        
        print("\n" + "="*50)
        print("✅ All Redis tests passed successfully!")
        print("="*50)
        
        return True
        
    except redis.ConnectionError as e:
        print(f"❌ Connection Error: {e}")
        return False
    except redis.AuthenticationError as e:
        print(f"❌ Authentication Error: {e}")
        print("   Make sure REDIS_PASSWORD is set correctly")
        return False
    except Exception as e:
        print(f"❌ Unexpected Error: {e}")
        return False


def main():
    """Main entry point"""
    print("Redis Configuration Test")
    print("========================\n")
    
    # Check environment variables
    if not os.getenv('REDIS_PASSWORD'):
        print("⚠️  Warning: REDIS_PASSWORD environment variable not set")
        print("   Redis will use password from redis.conf")
    
    # Run tests
    success = test_redis_connection()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()