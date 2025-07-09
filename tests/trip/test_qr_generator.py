"""Tests for QR code generator."""

import base64
import gzip
import json
from unittest.mock import MagicMock, patch

import pytest

from jidelnicek.trip.services.export import (
    QRCodeConfig,
    QRCodeData,
    QRCodeGenerator,
    QRErrorCorrection,
    generate_qr_code,
    generate_qr_code_base64,
)


class TestQRCodeGenerator:
    """Test QR code generator functionality."""

    def test_qr_code_config_defaults(self):
        """Test QR code configuration defaults."""
        config = QRCodeConfig()
        assert config.size == 10
        assert config.border == 4
        assert config.error_correction == QRErrorCorrection.MEDIUM
        assert config.fill_color == "black"
        assert config.back_color == "white"
        assert config.image_format == "PNG"

    def test_qr_code_config_custom(self):
        """Test QR code configuration with custom values."""
        config = QRCodeConfig(
            size=20,
            border=2,
            error_correction=QRErrorCorrection.HIGH,
            fill_color="blue",
            back_color="yellow",
        )
        assert config.size == 20
        assert config.border == 2
        assert config.error_correction == QRErrorCorrection.HIGH
        assert config.fill_color == "blue"
        assert config.back_color == "yellow"

    def test_qr_code_data_url(self):
        """Test QR code data for URL."""
        data = QRCodeData(type="url", content="https://example.com")
        assert data.type == "url"
        assert data.content == "https://example.com"
        assert data.compress is False

    def test_qr_code_data_json_compressed(self):
        """Test QR code data for compressed JSON."""
        json_content = {"items": ["apple", "banana", "orange"]}
        data = QRCodeData(type="json", content=json_content, compress=True)
        assert data.type == "json"
        assert data.content == json_content
        assert data.compress is True

    @patch("jidelnicek.trip.services.export.qr_generator.logger")
    def test_qr_generator_no_library(self, mock_logger):
        """Test QR generator when qrcode library is not available."""
        with patch.dict("sys.modules", {"qrcode": None}):
            generator = QRCodeGenerator()
            assert generator._qrcode_available is False
            mock_logger.warning.assert_called_once()

    def test_prepare_data_url(self):
        """Test preparing URL data for QR code."""
        generator = QRCodeGenerator()
        data = QRCodeData(type="url", content="https://example.com")
        result = generator._prepare_data(data)
        assert result == "https://example.com"

    def test_prepare_data_text(self):
        """Test preparing text data for QR code."""
        generator = QRCodeGenerator()
        data = QRCodeData(type="text", content="Hello World")
        result = generator._prepare_data(data)
        assert result == "Hello World"

    def test_prepare_data_json_uncompressed(self):
        """Test preparing uncompressed JSON data for QR code."""
        generator = QRCodeGenerator()
        json_content = {"key": "value", "number": 42}
        data = QRCodeData(type="json", content=json_content, compress=False)
        result = generator._prepare_data(data)
        assert result == '{"key":"value","number":42}'

    def test_prepare_data_json_compressed(self):
        """Test preparing compressed JSON data for QR code."""
        generator = QRCodeGenerator()
        json_content = {"key": "value", "items": list(range(100))}
        data = QRCodeData(type="json", content=json_content, compress=True)
        result = generator._prepare_data(data)
        
        assert result.startswith("gzip:")
        # Decode and verify the compressed data
        compressed_b64 = result[5:]  # Remove "gzip:" prefix
        compressed = base64.b64decode(compressed_b64)
        decompressed = gzip.decompress(compressed).decode("utf-8")
        assert json.loads(decompressed) == json_content

    def test_prepare_data_invalid_type(self):
        """Test preparing data with invalid type."""
        generator = QRCodeGenerator()
        data = QRCodeData(type="invalid", content="test")
        result = generator._prepare_data(data)
        assert result is None

    def test_estimate_data_size(self):
        """Test estimating data size for QR code."""
        generator = QRCodeGenerator()
        
        # Small URL
        data = QRCodeData(type="url", content="https://example.com")
        size, fits = generator.estimate_data_size(data)
        assert size == len("https://example.com")
        assert fits is True
        
        # Large data that might not fit
        large_content = "x" * 3000
        data = QRCodeData(type="text", content=large_content)
        size, fits = generator.estimate_data_size(data)
        assert size == 3000
        # With MEDIUM error correction, max is 2331 bytes
        assert fits is False

    @patch("qrcode.QRCode")
    def test_generate_with_mock(self, mock_qr_class):
        """Test QR code generation with mocked qrcode library."""
        # Mock the QRCode instance
        mock_qr = MagicMock()
        mock_qr_class.return_value = mock_qr
        
        # Mock the image
        mock_image = MagicMock()
        mock_qr.make_image.return_value = mock_image
        
        # Mock image save
        saved_format = None
        def mock_save(buffer, format=None):
            nonlocal saved_format
            saved_format = format
            buffer.write(b"fake_qr_image_data")
        
        mock_image.save = mock_save
        
        generator = QRCodeGenerator()
        generator._qrcode_available = True
        
        data = QRCodeData(type="url", content="https://example.com")
        result = generator.generate(data)
        
        assert result == b"fake_qr_image_data"
        assert saved_format == "PNG"
        mock_qr.add_data.assert_called_once_with("https://example.com")
        mock_qr.make.assert_called_once_with(fit=True)

    @patch("qrcode.QRCode")
    def test_generate_base64(self, mock_qr_class):
        """Test QR code generation as base64."""
        # Mock the QRCode instance
        mock_qr = MagicMock()
        mock_qr_class.return_value = mock_qr
        
        # Mock the image
        mock_image = MagicMock()
        mock_qr.make_image.return_value = mock_image
        
        # Mock image save
        def mock_save(buffer, format=None):
            buffer.write(b"fake_qr_image_data")
        
        mock_image.save = mock_save
        
        generator = QRCodeGenerator()
        generator._qrcode_available = True
        
        data = QRCodeData(type="url", content="https://example.com")
        result = generator.generate_base64(data)
        
        expected = base64.b64encode(b"fake_qr_image_data").decode("utf-8")
        assert result == expected

    def test_generate_trip_share_qr(self):
        """Test generating QR code for trip share link."""
        generator = QRCodeGenerator()
        generator._qrcode_available = False  # Disable to test logic
        
        # Test the URL construction
        with patch.object(generator, "generate") as mock_generate:
            generator.generate_trip_share_qr("trip123", "https://example.com")
            
            mock_generate.assert_called_once()
            call_args = mock_generate.call_args[0][0]
            assert call_args.type == "url"
            assert call_args.content == "https://example.com/trips/trip123/share"

    def test_generate_shopping_list_qr(self):
        """Test generating QR code for shopping list."""
        generator = QRCodeGenerator()
        generator._qrcode_available = False  # Disable to test logic
        
        shopping_list = {
            "categories": {
                "fruits": [
                    {"name": "Apple", "quantity": 5, "unit": "pcs"},
                    {"name": "Banana", "quantity": 1, "unit": "kg"},
                ]
            }
        }
        
        with patch.object(generator, "generate") as mock_generate:
            generator.generate_shopping_list_qr(shopping_list)
            
            mock_generate.assert_called_once()
            call_args = mock_generate.call_args[0][0]
            assert call_args.type == "json"
            assert call_args.content == shopping_list
            assert call_args.compress is True  # Shopping lists are compressed

    def test_generate_recipe_qr(self):
        """Test generating QR code for recipe link."""
        generator = QRCodeGenerator()
        generator._qrcode_available = False  # Disable to test logic
        
        with patch.object(generator, "generate") as mock_generate:
            generator.generate_recipe_qr("recipe456", "https://example.com")
            
            mock_generate.assert_called_once()
            call_args = mock_generate.call_args[0][0]
            assert call_args.type == "url"
            assert call_args.content == "https://example.com/recipes/recipe456"

    def test_generate_export_download_qr(self):
        """Test generating QR code for export download link."""
        generator = QRCodeGenerator()
        generator._qrcode_available = False  # Disable to test logic
        
        with patch.object(generator, "generate") as mock_generate:
            generator.generate_export_download_qr("export789", "https://example.com")
            
            mock_generate.assert_called_once()
            call_args = mock_generate.call_args[0][0]
            assert call_args.type == "url"
            assert call_args.content == "https://example.com/exports/export789/download"

    @patch("qrcode.QRCode")
    def test_convenience_generate_qr_code(self, mock_qr_class):
        """Test convenience function for QR code generation."""
        # Mock the QRCode instance
        mock_qr = MagicMock()
        mock_qr_class.return_value = mock_qr
        
        # Mock the image
        mock_image = MagicMock()
        mock_qr.make_image.return_value = mock_image
        
        # Mock image save
        def mock_save(buffer, format=None):
            buffer.write(b"fake_qr_image_data")
        
        mock_image.save = mock_save
        
        # Test URL detection
        result = generate_qr_code("https://example.com")
        assert result == b"fake_qr_image_data"
        
        # Test JSON detection
        result = generate_qr_code({"key": "value"})
        assert result == b"fake_qr_image_data"
        
        # Test plain text
        result = generate_qr_code("Hello World")
        assert result == b"fake_qr_image_data"

    def test_error_correction_levels(self):
        """Test all error correction levels."""
        assert QRErrorCorrection.LOW == "L"
        assert QRErrorCorrection.MEDIUM == "M"
        assert QRErrorCorrection.QUARTILE == "Q"
        assert QRErrorCorrection.HIGH == "H"

    @patch("qrcode.constants")
    def test_get_error_correction_constant(self, mock_constants):
        """Test mapping error correction to qrcode constants."""
        # Mock the constants
        mock_constants.ERROR_CORRECT_L = 1
        mock_constants.ERROR_CORRECT_M = 2
        mock_constants.ERROR_CORRECT_Q = 3
        mock_constants.ERROR_CORRECT_H = 4
        
        generator = QRCodeGenerator()
        generator._qrcode_available = True
        
        # Test each level
        generator.config.error_correction = QRErrorCorrection.LOW
        assert generator._get_error_correction_constant() == 1
        
        generator.config.error_correction = QRErrorCorrection.MEDIUM
        assert generator._get_error_correction_constant() == 2
        
        generator.config.error_correction = QRErrorCorrection.QUARTILE
        assert generator._get_error_correction_constant() == 3
        
        generator.config.error_correction = QRErrorCorrection.HIGH
        assert generator._get_error_correction_constant() == 4