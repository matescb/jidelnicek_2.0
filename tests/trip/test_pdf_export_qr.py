"""Tests for PDF export with QR code functionality."""

from datetime import datetime
from io import BytesIO
from unittest.mock import MagicMock, patch

import pytest

from jidelnicek.trip.services.export import TripPDFExporter
from jidelnicek.trip.services.export.qr_generator import QRCodeGenerator


class TestPDFExportWithQR:
    """Test PDF export with QR code integration."""

    @pytest.fixture
    def trip_data(self):
        """Sample trip data for testing."""
        return {
            "trip": {
                "id": "trip123",
                "name": "Test Trip",
                "start_date": "2024-01-15T00:00:00",
                "end_date": "2024-01-17T00:00:00",
                "location": "Test Location",
                "day_count": 3,
                "participant_count": 4,
                "trip_type": "family",
                "description": "Test trip description",
            },
            "days": [
                {
                    "date": "2024-01-15",
                    "day_number": 1,
                    "meals": [
                        {
                            "meal_type": "breakfast",
                            "recipe_id": "recipe1",
                            "recipe_name": "Pancakes",
                            "servings": 4,
                        }
                    ],
                }
            ],
            "recipes": [
                {
                    "id": "recipe1",
                    "name": "Pancakes",
                    "ingredients": [
                        {"name": "Flour", "quantity": 200, "unit": "g"},
                        {"name": "Milk", "quantity": 300, "unit": "ml"},
                    ],
                }
            ],
            "shopping_list": {
                "categories": {
                    "Dairy": [
                        {"name": "Milk", "quantity": 300, "unit": "ml"},
                    ],
                    "Dry Goods": [
                        {"name": "Flour", "quantity": 200, "unit": "g"},
                    ],
                },
                "summary": {
                    "total_items": 2,
                    "total_weight": 0.5,
                    "total_volume": 0.3,
                },
            },
            "participants": [
                {"id": "p1", "name": "John", "is_organizer": True},
                {"id": "p2", "name": "Jane", "is_organizer": False},
            ],
        }

    @patch("jidelnicek.trip.services.export.pdf_exporter.REPORTLAB_AVAILABLE", True)
    def test_pdf_export_with_qr_enabled(self, trip_data):
        """Test PDF export with QR codes enabled."""
        with patch("jidelnicek.trip.services.export.pdf_exporter.SimpleDocTemplate"), \
             patch.object(QRCodeGenerator, "generate_trip_share_qr") as mock_trip_qr, \
             patch.object(QRCodeGenerator, "generate_shopping_list_qr") as mock_shopping_qr:
            
            # Mock QR code generation
            mock_trip_qr.return_value = b"fake_trip_qr"
            mock_shopping_qr.return_value = b"fake_shopping_qr"
            
            exporter = TripPDFExporter(options={
                "include_qr": True,
                "include_shopping_qr": True,
                "base_url": "https://test.example.com",
            })
            
            # The export method would fail without full reportlab, but we can test the setup
            assert exporter.qr_generator is not None
            assert exporter.base_url == "https://test.example.com"

    @patch("jidelnicek.trip.services.export.pdf_exporter.REPORTLAB_AVAILABLE", True)
    def test_pdf_export_qr_disabled(self, trip_data):
        """Test PDF export with QR codes disabled."""
        exporter = TripPDFExporter(options={
            "include_qr": False,
            "include_shopping_qr": False,
        })
        
        # QR generator should still be initialized
        assert exporter.qr_generator is not None

    @patch("jidelnicek.trip.services.export.pdf_exporter.REPORTLAB_AVAILABLE", True)
    def test_pdf_export_default_base_url(self):
        """Test PDF export uses default base URL."""
        exporter = TripPDFExporter()
        assert exporter.base_url == "https://jidelnicek.cz"

    @patch("jidelnicek.trip.services.export.pdf_exporter.REPORTLAB_AVAILABLE", True)
    def test_pdf_export_qr_config(self):
        """Test PDF export QR code configuration."""
        exporter = TripPDFExporter()
        
        # Check QR generator configuration
        assert exporter.qr_generator.config.size == 8  # Smaller for PDF
        assert exporter.qr_generator.config.error_correction.value == "M"
        assert exporter.qr_generator.config.border == 2

    @patch("jidelnicek.trip.services.export.pdf_exporter.REPORTLAB_AVAILABLE", False)
    def test_pdf_export_without_reportlab(self):
        """Test PDF export when reportlab is not available."""
        with pytest.raises(ImportError, match="reportlab is required"):
            TripPDFExporter()

    @patch("jidelnicek.trip.services.export.pdf_exporter.REPORTLAB_AVAILABLE", True)
    @patch("jidelnicek.trip.services.export.pdf_exporter.SimpleDocTemplate")
    @patch("jidelnicek.trip.services.export.pdf_exporter.Paragraph")
    @patch("jidelnicek.trip.services.export.pdf_exporter.Image")
    def test_cover_page_with_qr(self, mock_image, mock_paragraph, mock_doc_template, trip_data):
        """Test cover page generation with QR code."""
        # Mock the document build
        mock_doc = MagicMock()
        mock_doc_template.return_value = mock_doc
        
        # Mock QR generation
        with patch.object(QRCodeGenerator, "generate_trip_share_qr") as mock_qr:
            mock_qr.return_value = b"fake_qr_data"
            
            exporter = TripPDFExporter(options={"include_qr": True})
            
            # Create cover page elements
            elements = exporter._create_cover_page(trip_data)
            
            # Verify QR code was generated
            mock_qr.assert_called_once_with("trip123", "https://jidelnicek.cz")
            
            # Verify Image was created with QR data
            # Note: Due to the way the code is structured, we can't easily verify
            # the exact Image call without a full integration test

    @patch("jidelnicek.trip.services.export.pdf_exporter.REPORTLAB_AVAILABLE", True)
    def test_shopping_section_with_qr(self, trip_data):
        """Test shopping section generation with QR code."""
        with patch.object(QRCodeGenerator, "generate_shopping_list_qr") as mock_qr:
            mock_qr.return_value = b"fake_shopping_qr"
            
            exporter = TripPDFExporter(options={"include_shopping_qr": True})
            
            # Create shopping section elements
            elements = exporter._create_shopping_section(trip_data)
            
            # Verify QR code was generated
            mock_qr.assert_called_once_with(trip_data["shopping_list"])
            
            # Verify elements were created
            assert len(elements) > 0

    @patch("jidelnicek.trip.services.export.pdf_exporter.REPORTLAB_AVAILABLE", True)
    def test_shopping_section_no_data(self):
        """Test shopping section with no shopping list data."""
        trip_data = {"shopping_list": {}}
        
        exporter = TripPDFExporter()
        elements = exporter._create_shopping_section(trip_data)
        
        # Should return elements indicating no data available
        assert len(elements) > 0

    @patch("jidelnicek.trip.services.export.pdf_exporter.REPORTLAB_AVAILABLE", True)
    def test_cover_page_no_qr_when_no_id(self, trip_data):
        """Test cover page doesn't add QR when trip has no ID."""
        # Remove trip ID
        del trip_data["trip"]["id"]
        
        with patch.object(QRCodeGenerator, "generate_trip_share_qr") as mock_qr:
            exporter = TripPDFExporter(options={"include_qr": True})
            elements = exporter._create_cover_page(trip_data)
            
            # QR should not be generated without trip ID
            mock_qr.assert_not_called()