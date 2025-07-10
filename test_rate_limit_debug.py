#!/usr/bin/env python3

"""
Debug rate limiting middleware issues.
"""

import asyncio
from fastapi import FastAPI
from httpx import AsyncClient
import httpx
from unittest.mock import AsyncMock
from jidelnicek.core.middleware.security import RateLimitMiddleware
from jidelnicek.core.dependencies import get_redis_client

app = FastAPI()

# Mock Redis for testing
mock_redis = AsyncMock()
mock_redis.pipeline.return_value = mock_redis
mock_redis.execute.return_value = [None, 0, None, None]  # [zremrangebyscore, zcard, zadd, expire]

async def get_mock_redis():
    return mock_redis

app.dependency_overrides[get_redis_client] = get_mock_redis

app.add_middleware(
    RateLimitMiddleware,
    requests_per_window=5,
    window_seconds=60,
    burst_size=1
)

@app.get("/test")
async def test_endpoint():
    return {"status": "ok"}

async def main():
    """Test rate limiting middleware behavior."""
    
    async with AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        
        print("=== Test 1: First request (should have rate limit headers) ===")
        response = await client.get("/test")
        print(f"Status: {response.status_code}")
        print(f"Headers: {dict(response.headers)}")
        
        print("\n=== Test 2: Make multiple requests up to limit ===")
        for i in range(5):
            response = await client.get("/test")
            print(f"Request {i+1}: Status {response.status_code}")
            if "X-RateLimit-Remaining" in response.headers:
                print(f"  Remaining: {response.headers['X-RateLimit-Remaining']}")
            else:
                print("  No rate limit headers")
        
        print("\n=== Test 3: Request that should be rate limited ===")
        mock_redis.execute.return_value = [None, 5, None, None]  # Simulate hitting the limit
        response = await client.get("/test")
        print(f"Status: {response.status_code}")
        print(f"Response: {response.json() if response.status_code != 200 else 'OK'}")

if __name__ == "__main__":
    asyncio.run(main())