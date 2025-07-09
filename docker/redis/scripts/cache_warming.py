#!/usr/bin/env python3
"""
Redis Cache Warming Script for Jídelníček 2.0
Preloads frequently accessed data into Redis cache to improve performance
"""

import os
import sys
import redis
import json
import asyncio
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class CacheWarmer:
    def __init__(self, redis_url: str = None, redis_password: str = None):
        """Initialize cache warmer with Redis connection"""
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
        
    def warm_restaurant_data(self) -> int:
        """Warm cache with restaurant data"""
        logger.info("Warming restaurant data cache...")
        keys_created = 0
        
        # This would normally fetch from database
        # For now, using placeholder data structure
        restaurants = [
            {"id": 1, "name": "Hlavní jídelna", "active": True},
            {"id": 2, "name": "Bistro", "active": True},
            {"id": 3, "name": "Vegetariánská jídelna", "active": True}
        ]
        
        # Cache active restaurant list
        active_restaurants = [r for r in restaurants if r["active"]]
        self.redis_client.setex(
            "cache:restaurant:list:active",
            21600,  # 6 hours TTL
            json.dumps(active_restaurants)
        )
        keys_created += 1
        
        # Cache individual restaurant details
        for restaurant in restaurants:
            key = f"cache:restaurant:detail:{restaurant['id']}"
            self.redis_client.setex(
                key,
                7200,  # 2 hours TTL
                json.dumps(restaurant)
            )
            keys_created += 1
            
        logger.info(f"Warmed {keys_created} restaurant cache keys")
        return keys_created
    
    def warm_menu_data(self, days_ahead: int = 7) -> int:
        """Warm cache with menu data for upcoming days"""
        logger.info(f"Warming menu data cache for next {days_ahead} days...")
        keys_created = 0
        
        today = datetime.now().date()
        restaurant_ids = [1, 2, 3]  # Would fetch from DB
        
        for restaurant_id in restaurant_ids:
            # Daily menus
            for day_offset in range(days_ahead):
                date = today + timedelta(days=day_offset)
                date_str = date.strftime("%Y-%m-%d")
                
                # Placeholder menu data
                menu_data = {
                    "restaurant_id": restaurant_id,
                    "date": date_str,
                    "meals": []  # Would contain actual meal data
                }
                
                key = f"cache:menu:daily:{restaurant_id}:{date_str}"
                self.redis_client.setex(
                    key,
                    3600,  # 1 hour TTL
                    json.dumps(menu_data)
                )
                keys_created += 1
            
            # Weekly menu
            current_week = today.isocalendar()[1]
            current_year = today.year
            
            weekly_key = f"cache:menu:weekly:{restaurant_id}:{current_year}:{current_week}"
            weekly_data = {
                "restaurant_id": restaurant_id,
                "year": current_year,
                "week": current_week,
                "meals": []  # Would contain week's meals
            }
            
            self.redis_client.setex(
                weekly_key,
                21600,  # 6 hours TTL
                json.dumps(weekly_data)
            )
            keys_created += 1
        
        logger.info(f"Warmed {keys_created} menu cache keys")
        return keys_created
    
    def warm_allergen_data(self) -> int:
        """Warm cache with allergen data"""
        logger.info("Warming allergen data cache...")
        keys_created = 0
        
        # Common allergens (EU regulation)
        allergens = [
            {"id": 1, "name": "Lepek", "code": "1"},
            {"id": 2, "name": "Korýši", "code": "2"},
            {"id": 3, "name": "Vejce", "code": "3"},
            {"id": 4, "name": "Ryby", "code": "4"},
            {"id": 5, "name": "Arašídy", "code": "5"},
            {"id": 6, "name": "Sója", "code": "6"},
            {"id": 7, "name": "Mléko", "code": "7"},
            {"id": 8, "name": "Ořechy", "code": "8"},
            {"id": 9, "name": "Celer", "code": "9"},
            {"id": 10, "name": "Hořčice", "code": "10"},
            {"id": 11, "name": "Sezam", "code": "11"},
            {"id": 12, "name": "Oxid siřičitý", "code": "12"},
            {"id": 13, "name": "Vlčí bob", "code": "13"},
            {"id": 14, "name": "Měkkýši", "code": "14"}
        ]
        
        # Cache allergen list
        self.redis_client.setex(
            "cache:allergen:list:all",
            86400,  # 24 hours TTL
            json.dumps(allergens)
        )
        keys_created += 1
        
        # Cache individual allergens
        for allergen in allergens:
            key = f"cache:allergen:detail:{allergen['id']}"
            self.redis_client.setex(
                key,
                86400,  # 24 hours TTL
                json.dumps(allergen)
            )
            keys_created += 1
        
        logger.info(f"Warmed {keys_created} allergen cache keys")
        return keys_created
    
    def warm_popular_meals(self) -> int:
        """Warm cache with popular meals data"""
        logger.info("Warming popular meals cache...")
        keys_created = 0
        
        restaurant_ids = [1, 2, 3]
        periods = ['daily', 'weekly', 'monthly']
        
        for restaurant_id in restaurant_ids:
            for period in periods:
                # Placeholder popular meals data
                popular_meals = {
                    "restaurant_id": restaurant_id,
                    "period": period,
                    "meals": []  # Would contain actual popular meals
                }
                
                key = f"cache:stats:meal:popular:{restaurant_id}:{period}"
                self.redis_client.setex(
                    key,
                    3600,  # 1 hour TTL
                    json.dumps(popular_meals)
                )
                keys_created += 1
        
        logger.info(f"Warmed {keys_created} popular meals cache keys")
        return keys_created
    
    def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        info = self.redis_client.info()
        dbinfo = self.redis_client.info('keyspace')
        
        stats = {
            "total_keys": dbinfo.get('db1', {}).get('keys', 0),
            "used_memory": info.get('used_memory_human', 'N/A'),
            "connected_clients": info.get('connected_clients', 0),
            "total_commands_processed": info.get('total_commands_processed', 0),
            "keyspace_hits": info.get('keyspace_hits', 0),
            "keyspace_misses": info.get('keyspace_misses', 0),
            "hit_ratio": 0
        }
        
        # Calculate hit ratio
        total_ops = stats['keyspace_hits'] + stats['keyspace_misses']
        if total_ops > 0:
            stats['hit_ratio'] = round(stats['keyspace_hits'] / total_ops * 100, 2)
        
        return stats
    
    def run(self, components: List[str] = None) -> None:
        """Run cache warming for specified components"""
        if components is None:
            components = ['restaurants', 'menus', 'allergens', 'popular']
        
        logger.info("Starting cache warming process...")
        total_keys = 0
        
        try:
            # Get initial stats
            initial_stats = self.get_cache_stats()
            logger.info(f"Initial cache stats: {initial_stats}")
            
            # Warm each component
            if 'restaurants' in components:
                total_keys += self.warm_restaurant_data()
            
            if 'menus' in components:
                total_keys += self.warm_menu_data()
            
            if 'allergens' in components:
                total_keys += self.warm_allergen_data()
            
            if 'popular' in components:
                total_keys += self.warm_popular_meals()
            
            # Get final stats
            final_stats = self.get_cache_stats()
            logger.info(f"Final cache stats: {final_stats}")
            
            logger.info(f"Cache warming completed. Total keys created: {total_keys}")
            
        except Exception as e:
            logger.error(f"Error during cache warming: {e}")
            sys.exit(1)


def main():
    """Main entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Redis cache warming for Jídelníček 2.0')
    parser.add_argument(
        '--components',
        nargs='+',
        choices=['restaurants', 'menus', 'allergens', 'popular'],
        help='Components to warm (default: all)'
    )
    parser.add_argument(
        '--redis-url',
        help='Redis connection URL (default: from REDIS_URL env)'
    )
    parser.add_argument(
        '--redis-password',
        help='Redis password (default: from REDIS_PASSWORD env)'
    )
    
    args = parser.parse_args()
    
    warmer = CacheWarmer(
        redis_url=args.redis_url,
        redis_password=args.redis_password
    )
    
    warmer.run(components=args.components)


if __name__ == '__main__':
    main()