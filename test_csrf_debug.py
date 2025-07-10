#!/usr/bin/env python3

"""
Debug CSRF middleware issues.
"""

import asyncio
from fastapi import FastAPI
from httpx import AsyncClient
import httpx
from jidelnicek.core.middleware.security import CSRFProtectMiddleware

app = FastAPI()
app.add_middleware(CSRFProtectMiddleware, cookie_name="test_csrf")

@app.get("/")
async def root():
    return {"message": "hello"}

@app.post("/test")
async def test_post():
    return {"status": "ok"}

async def main():
    """Test CSRF middleware behavior."""
    
    async with AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        
        # Test 1: GET request should generate CSRF token
        print("=== Test 1: GET request to generate CSRF token ===")
        get_response = await client.get("/")
        print(f"GET status: {get_response.status_code}")
        print(f"GET response: {get_response.json()}")
        
        # Check for CSRF token in response headers
        csrf_token = get_response.headers.get("X-CSRF-Token")
        print(f"CSRF Token from header: {csrf_token}")
        
        # Check for CSRF token in cookies
        csrf_cookie = get_response.cookies.get("test_csrf")
        print(f"CSRF Cookie: {csrf_cookie}")
        
        print("\n=== Test 2: POST without CSRF token (should fail) ===")
        try:
            post_response = await client.post("/test", json={"data": "test"})
            print(f"POST status: {post_response.status_code}")
            if post_response.status_code != 200:
                print(f"POST response: {post_response.json()}")
        except Exception as e:
            print(f"POST error: {e}")
        
        print("\n=== Test 3: POST with invalid CSRF token (should fail) ===")
        try:
            post_response = await client.post(
                "/test", 
                json={"data": "test"},
                headers={"X-CSRF-Token": "invalid-token"},
                cookies={"test_csrf": csrf_token if csrf_token else "missing"}
            )
            print(f"POST with invalid token status: {post_response.status_code}")
            if post_response.status_code != 200:
                print(f"POST response: {post_response.json()}")
        except Exception as e:
            print(f"POST with invalid token error: {e}")
        
        print("\n=== Test 4: POST with valid CSRF token (should succeed) ===")
        if csrf_token:
            try:
                post_response = await client.post(
                    "/test", 
                    json={"data": "test"},
                    headers={"X-CSRF-Token": csrf_token},
                    cookies={"test_csrf": csrf_token}
                )
                print(f"POST with valid token status: {post_response.status_code}")
                print(f"POST response: {post_response.json()}")
            except Exception as e:
                print(f"POST with valid token error: {e}")
        else:
            print("No CSRF token available for valid test")

if __name__ == "__main__":
    asyncio.run(main())