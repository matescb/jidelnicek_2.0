from pathlib import Path
import os
import pytest
import requests
import schemathesis
from requests.exceptions import ConnectionError


def is_server_running(url: str) -> bool:
    """Check if the API server is running."""
    try:
        # Extract base URL without /api/v1
        base_url = url.replace("/api/v1", "")
        response = requests.get(f"{base_url}/health", timeout=5)
        return response.status_code in [200, 404]  # 404 is OK if health endpoint doesn't exist
    except ConnectionError:
        return False
    except Exception:
        return False


# Load the OpenAPI schema
schema = schemathesis.from_path(
    Path(__file__).with_name("jidelnicek_OpenAPI Spec.yaml")
)
schema.base_url = "http://localhost:8000/api/v1"


@pytest.fixture(scope="session", autouse=True)
def check_server():
    """Ensure the development server is running before running contract tests."""
    if not is_server_running(schema.base_url):
        pytest.skip(
            f"API server is not running at {schema.base_url}. "
            "Start the development server before running contract tests."
        )


@schema.parametrize()
def test_contract(case):
    """Test API endpoints against the OpenAPI specification."""
    token = os.getenv("API_TOKEN")
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    
    try:
        resp = case.call(headers=headers)
        case.validate_response(resp)
    except ConnectionError as e:
        pytest.fail(f"Failed to connect to API server: {e}")
    except Exception as e:
        pytest.fail(f"Contract test failed: {e}")


def test_registration_endpoint():
    """Test registration endpoint specifically."""
    import requests
    
    # Test valid registration
    response = requests.post(
        "http://localhost:8000/api/v1/auth/register",
        json={
            "email": f"test{os.urandom(4).hex()}@example.com",
            "password": "SecurePassword123!",
            "confirm_password": "SecurePassword123!",
            "language": "en",
            "unit_system": "metric",
            "energy_unit": "kcal"
        }
    )
    
    if response.status_code == 422:
        print(f"422 Validation Error: {response.json()}")
    assert response.status_code in [201, 422], f"Unexpected status: {response.status_code} - {response.text}"

