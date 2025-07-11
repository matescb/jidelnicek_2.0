import redis

try:
    # Test synchronous connection
    r = redis.Redis(host='redis', port=6379, decode_responses=True)
    result = r.ping()
    print(f"Redis ping (sync): {result}")
    
    # Test setting and getting a value
    r.set('test_key', 'test_value')
    value = r.get('test_key')
    print(f"Test key value: {value}")
    
except Exception as e:
    print(f"Error: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()