"""Tests for QR code API endpoints."""

import base64
from unittest.mock import MagicMock, patch

import pytest
from fastapi import status
from fastapi.testclient import TestClient

from jidelnicek.trip.routers.qr_codes import router
from jidelnicek.trip.services.export import QRErrorCorrection


@pytest.fixture
def client():
    """Create test client."""
    from fastapi import FastAPI
    
    app = FastAPI()
    app.include_router(router)
    return TestClient(app)


class TestQRCodeEndpoints:
    """Test QR code API endpoints."""

    @patch("jidelnicek.trip.routers.qr_codes.generate_qr_code_base64")
    def test_generate_qr_code_endpoint_success(self, mock_generate, client):
        """Test successful QR code generation."""
        mock_generate.return_value = "fake_base64_data"
        
        response = client.post(
            "/qr/generate",
            json={
                "content": "https://example.com",
                "format": "base64",
                "size": 10,
                "error_correction": "M",
                "fill_color": "black",
                "back_color": "white",
            }
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["data"] == "fake_base64_data"
        assert data["format"] == "PNG"
        assert data["size_estimate"] == len("https://example.com")

    @patch("jidelnicek.trip.routers.qr_codes.generate_qr_code_base64")
    def test_generate_qr_code_endpoint_failure(self, mock_generate, client):
        """Test QR code generation failure."""
        mock_generate.return_value = None
        
        response = client.post(
            "/qr/generate",
            json={
                "content": "test",
                "format": "base64",
            }
        )
        
        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        assert "Failed to generate QR code" in response.json()["detail"]

    def test_generate_qr_code_unsupported_format(self, client):
        """Test QR code generation with unsupported format."""
        response = client.post(
            "/qr/generate",
            json={
                "content": "test",
                "format": "binary",  # Currently only base64 is supported in POST
            }
        )
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Only base64 format is currently supported" in response.json()["detail"]

    @patch("jidelnicek.trip.routers.qr_codes.QRCodeGenerator")
    def test_generate_trip_qr_code(self, mock_generator_class, client):
        """Test generating QR code for trip."""
        mock_generator = MagicMock()
        mock_generator.generate_trip_share_qr.return_value = b"fake_qr_image"
        mock_generator_class.return_value = mock_generator
        
        response = client.get("/qr/trip/trip123?base_url=https://example.com")
        
        assert response.status_code == status.HTTP_200_OK
        assert response.content == b"fake_qr_image"
        assert response.headers["content-type"] == "image/png"
        assert "trip-trip123-qr.png" in response.headers["content-disposition"]
        
        mock_generator.generate_trip_share_qr.assert_called_once_with(
            "trip123", "https://example.com"
        )

    @patch("jidelnicek.trip.routers.qr_codes.QRCodeGenerator")
    def test_generate_trip_qr_code_failure(self, mock_generator_class, client):
        """Test trip QR code generation failure."""
        mock_generator = MagicMock()
        mock_generator.generate_trip_share_qr.return_value = None
        mock_generator_class.return_value = mock_generator
        
        response = client.get("/qr/trip/trip123")
        
        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        assert "Failed to generate QR code" in response.json()["detail"]

    @patch("jidelnicek.trip.routers.qr_codes.QRCodeGenerator")
    def test_generate_recipe_qr_code(self, mock_generator_class, client):
        """Test generating QR code for recipe."""
        mock_generator = MagicMock()
        mock_generator.generate_recipe_qr.return_value = b"fake_recipe_qr"
        mock_generator_class.return_value = mock_generator
        
        response = client.get("/qr/recipe/recipe456?base_url=https://example.com&size=15")
        
        assert response.status_code == status.HTTP_200_OK
        assert response.content == b"fake_recipe_qr"
        assert response.headers["content-type"] == "image/png"
        assert "recipe-recipe456-qr.png" in response.headers["content-disposition"]
        
        mock_generator.generate_recipe_qr.assert_called_once_with(
            "recipe456", "https://example.com"
        )

    @patch("jidelnicek.trip.routers.qr_codes.QRCodeGenerator")
    def test_generate_export_qr_code(self, mock_generator_class, client):
        """Test generating QR code for export."""
        mock_generator = MagicMock()
        mock_generator.generate_export_download_qr.return_value = b"fake_export_qr"
        mock_generator_class.return_value = mock_generator
        
        response = client.get("/qr/export/export789")
        
        assert response.status_code == status.HTTP_200_OK
        assert response.content == b"fake_export_qr"
        assert response.headers["content-type"] == "image/png"
        assert "export-export789-qr.png" in response.headers["content-disposition"]
        
        # Should use default base URL
        mock_generator.generate_export_download_qr.assert_called_once_with(
            "export789", "https://jidelnicek.cz"
        )

    @patch("jidelnicek.trip.routers.qr_codes.QRCodeGenerator")
    def test_generate_shopping_list_qr_binary(self, mock_generator_class, client):
        """Test generating shopping list QR code as binary."""
        mock_generator = MagicMock()
        mock_generator.generate_shopping_list_qr.return_value = b"fake_shopping_qr"
        mock_generator_class.return_value = mock_generator
        
        shopping_list = {
            "categories": {
                "fruits": [
                    {"name": "Apple", "quantity": 5, "unit": "pcs"}
                ]
            }
        }
        
        response = client.post(
            "/qr/shopping-list?format=binary",
            json=shopping_list
        )
        
        assert response.status_code == status.HTTP_200_OK
        assert response.content == b"fake_shopping_qr"
        assert response.headers["content-type"] == "image/png"
        assert "shopping-list-qr.png" in response.headers["content-disposition"]
        assert response.headers["cache-control"] == "no-cache"
        
        mock_generator.generate_shopping_list_qr.assert_called_once_with(shopping_list)

    @patch("jidelnicek.trip.routers.qr_codes.QRCodeGenerator")
    def test_generate_shopping_list_qr_base64(self, mock_generator_class, client):
        """Test generating shopping list QR code as base64."""
        mock_generator = MagicMock()
        mock_generator.generate_shopping_list_qr.return_value = b"fake_shopping_qr"
        mock_generator_class.return_value = mock_generator
        
        shopping_list = {"items": ["apple", "banana"]}
        
        response = client.post(
            "/qr/shopping-list?format=base64",
            json=shopping_list
        )
        
        assert response.status_code == status.HTTP_200_OK
        expected_base64 = base64.b64encode(b"fake_shopping_qr").decode("utf-8")
        assert response.text == expected_base64
        assert response.headers["content-type"] == "text/plain; charset=utf-8"

    @patch("jidelnicek.trip.routers.qr_codes.QRCodeGenerator")
    def test_generate_shopping_list_qr_failure(self, mock_generator_class, client):
        """Test shopping list QR code generation failure."""
        mock_generator = MagicMock()
        mock_generator.generate_shopping_list_qr.return_value = None
        mock_generator_class.return_value = mock_generator
        
        response = client.post(
            "/qr/shopping-list",
            json={"items": []}
        )
        
        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        assert "Failed to generate QR code" in response.json()["detail"]

    def test_check_qr_availability_available(self, client):
        """Test checking QR code availability when library is installed."""
        with patch("jidelnicek.trip.routers.qr_codes.qrcode") as mock_qrcode:
            mock_qrcode.__version__ = "7.4.2"
            
            response = client.get("/qr/check")
            
            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data["available"] is True
            assert data["version"] == "7.4.2"
            assert "QR code generation is available" in data["message"]

    def test_check_qr_availability_not_available(self, client):
        """Test checking QR code availability when library is not installed."""
        with patch("builtins.__import__", side_effect=ImportError):
            response = client.get("/qr/check")
            
            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data["available"] is False
            assert data["version"] is None
            assert "QR code library not installed" in data["message"]

    def test_qr_code_request_validation(self, client):
        """Test QR code request validation."""
        # Test with invalid size
        response = client.post(
            "/qr/generate",
            json={
                "content": "test",
                "size": 50,  # Max is 40
            }
        )
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        
        # Test with invalid error correction
        response = client.post(
            "/qr/generate",
            json={
                "content": "test",
                "error_correction": "INVALID",
            }
        )
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    @patch("jidelnicek.trip.routers.qr_codes.generate_qr_code_base64")
    def test_generate_qr_code_with_exception(self, mock_generate, client):
        """Test QR code generation with unexpected exception."""
        mock_generate.side_effect = Exception("Unexpected error")
        
        response = client.post(
            "/qr/generate",
            json={"content": "test"}
        )
        
        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        assert "QR code generation failed: Unexpected error" in response.json()["detail"]

    def test_generate_qr_code_minimal_request(self, client):
        """Test QR code generation with minimal request."""
        with patch("jidelnicek.trip.routers.qr_codes.generate_qr_code_base64") as mock_generate:
            mock_generate.return_value = "minimal_qr_data"
            
            response = client.post(
                "/qr/generate",
                json={"content": "minimal test"}
            )
            
            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data["data"] == "minimal_qr_data"
            assert data["format"] == "PNG"

    def test_default_query_parameters(self, client):
        """Test endpoints with default query parameters."""
        with patch("jidelnicek.trip.routers.qr_codes.QRCodeGenerator") as mock_generator_class:
            mock_generator = MagicMock()
            mock_generator.generate_trip_share_qr.return_value = b"default_qr"
            mock_generator_class.return_value = mock_generator
            
            # Test without any query parameters
            response = client.get("/qr/trip/trip999")
            
            assert response.status_code == status.HTTP_200_OK
            # Should use default base_url
            mock_generator.generate_trip_share_qr.assert_called_once_with(
                "trip999", "https://jidelnicek.cz"
            )