import asyncio
import redis.asyncio as redis_async

async def test_redis():
    try:
        # Test without password
        r = redis_async.Redis(host='redis', port=6379, decode_responses=True)
        result = await r.ping()
        print(f"Redis ping (no password): {result}")
        await r.close()
        
        # Test with empty password
        r2 = redis_async.Redis(host='redis', port=6379, password='', decode_responses=True)
        result2 = await r2.ping()
        print(f"Redis ping (empty password): {result2}")
        await r2.close()
        
        # Test with URL
        pool = redis_async.ConnectionPool.from_url('redis://redis:6379/0')
        r3 = redis_async.Redis(connection_pool=pool)
        result3 = await r3.ping()
        print(f"Redis ping (URL): {result3}")
        await r3.close()
        
    except Exception as e:
        print(f"Error: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_redis())