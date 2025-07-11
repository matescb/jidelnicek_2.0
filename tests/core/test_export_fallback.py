"""Tests for export fallback implementations."""

import pytest
import json
import csv
from datetime import datetime, date
from io import StringIO

from jidelnicek.core.services.export_fallback import (
    FallbackExporter,
    FallbackPDFExporter,
    FallbackQRCodeGenerator
)
from jidelnicek.core.exceptions.export_exceptions import ExportGenerationError


class TestFallbackExporter:
    """Test fallback export implementations."""
    
    @pytest.mark.asyncio
    async def test_export_to_json_simple(self):
        """Test JSON export with simple data."""
        data = {
            "name": "Test Recipe",
            "ingredients": ["flour", "water", "salt"],
            "created_at": datetime(2024, 1, 1, 12, 0)
        }
        
        result = await FallbackExporter.export_to_json(data)
        
        # Verify result is bytes
        assert isinstance(result, bytes)
        
        # Parse and verify content
        parsed = json.loads(result.decode("utf-8"))
        assert parsed["name"] == "Test Recipe"
        assert parsed["ingredients"] == ["flour", "water", "salt"]
        assert parsed["created_at"] == "2024-01-01T12:00:00"
    
    @pytest.mark.asyncio
    async def test_export_to_json_complex_objects(self):
        """Test JSON export with complex objects."""
        class CustomObject:
            def __init__(self, value):
                self.value = value
            
            def to_dict(self):
                return {"custom_value": self.value}
        
        data = {
            "object": CustomObject("test"),
            "date": date(2024, 1, 1)
        }
        
        result = await FallbackExporter.export_to_json(data, pretty=False)
        parsed = json.loads(result.decode("utf-8"))
        
        assert parsed["object"]["custom_value"] == "test"
        assert parsed["date"] == "2024-01-01"
    
    @pytest.mark.asyncio
    async def test_export_to_csv_basic(self):
        """Test CSV export with basic data."""
        data = [
            {"name": "Recipe 1", "prep_time": 30, "servings": 4},
            {"name": "Recipe 2", "prep_time": 45, "servings": 6}
        ]
        
        result = await FallbackExporter.export_to_csv(data)
        
        # Parse CSV
        csv_content = result.decode("utf-8")
        reader = csv.DictReader(StringIO(csv_content))
        rows = list(reader)
        
        assert len(rows) == 2
        assert rows[0]["name"] == "Recipe 1"
        assert rows[0]["prep_time"] == "30"
        assert rows[1]["servings"] == "6"
    
    @pytest.mark.asyncio
    async def test_export_to_csv_with_complex_types(self):
        """Test CSV export with complex data types."""
        data = [
            {
                "id": 1,
                "created": datetime(2024, 1, 1, 12, 0),
                "tags": ["vegan", "gluten-free"],
                "metadata": {"author": "test"}
            }
        ]
        
        result = await FallbackExporter.export_to_csv(data)
        csv_content = result.decode("utf-8")
        reader = csv.DictReader(StringIO(csv_content))
        row = next(reader)
        
        assert row["id"] == "1"
        assert row["created"] == "2024-01-01T12:00:00"
        assert row["tags"] == '["vegan", "gluten-free"]'
        assert row["metadata"] == '{"author": "test"}'
    
    @pytest.mark.asyncio
    async def test_export_to_csv_custom_headers(self):
        """Test CSV export with custom headers."""
        data = [
            {"a": 1, "b": 2, "c": 3},
            {"a": 4, "b": 5, "c": 6}
        ]
        headers = ["a", "c"]  # Only include a and c
        
        result = await FallbackExporter.export_to_csv(data, headers)
        csv_content = result.decode("utf-8")
        
        lines = csv_content.strip().split("\n")
        assert lines[0] == "a,c"
        assert lines[1] == "1,3"
        assert lines[2] == "4,6"
    
    @pytest.mark.asyncio
    async def test_export_to_txt_with_dict(self):
        """Test text export with dictionary data."""
        data = {
            "Recipe": "Test Recipe",
            "Ingredients": ["flour", "water"],
            "Instructions": "Mix and bake"
        }
        
        result = await FallbackExporter.export_to_txt(data)
        text = result.decode("utf-8")
        
        assert "Recipe: Test Recipe" in text
        assert "Ingredients: [\n  \"flour\",\n  \"water\"\n]" in text
        assert "Instructions: Mix and bake" in text
    
    @pytest.mark.asyncio
    async def test_export_to_txt_with_template(self):
        """Test text export with template."""
        data = {
            "name": "Chocolate Cake",
            "servings": 8,
            "time": "45 minutes"
        }
        template = """Recipe: {name}
Servings: {servings}
Time: {time}"""
        
        result = await FallbackExporter.export_to_txt(data, template)
        text = result.decode("utf-8")
        
        assert "Recipe: Chocolate Cake" in text
        assert "Servings: 8" in text
        assert "Time: 45 minutes" in text
    
    @pytest.mark.asyncio
    async def test_export_to_txt_table_format(self):
        """Test text export with table-like data."""
        data = [
            {"item": "Flour", "amount": "2 cups"},
            {"item": "Sugar", "amount": "1 cup"},
            {"item": "Eggs", "amount": "3"}
        ]
        
        result = await FallbackExporter.export_to_txt(data)
        text = result.decode("utf-8")
        
        # Should create a table-like format
        assert "item | amount" in text
        assert "Flour | 2 cups" in text
        assert "Sugar | 1 cup" in text
    
    @pytest.mark.asyncio
    async def test_export_to_html_basic(self):
        """Test HTML export with basic data."""
        data = {
            "title": "Recipe Export",
            "recipes": [
                {"name": "Recipe 1", "time": 30},
                {"name": "Recipe 2", "time": 45}
            ]
        }
        
        result = await FallbackExporter.export_to_html(
            data,
            title="My Recipes"
        )
        html = result.decode("utf-8")
        
        assert "<title>My Recipes</title>" in html
        assert "<h1>My Recipes</h1>" in html
        assert "<h2>recipes</h2>" in html
        assert "<table>" in html
        assert "Recipe 1" in html
        assert "Recipe 2" in html
    
    @pytest.mark.asyncio
    async def test_export_to_html_with_custom_css(self):
        """Test HTML export with custom CSS."""
        data = {"content": "Test"}
        custom_css = "body { background: #f0f0f0; }"
        
        result = await FallbackExporter.export_to_html(
            data,
            title="Test",
            css=custom_css
        )
        html = result.decode("utf-8")
        
        assert custom_css in html
    
    @pytest.mark.asyncio
    async def test_export_error_handling(self):
        """Test error handling in exports."""
        # Test with data that causes JSON serialization error
        class BadObject:
            def __repr__(self):
                raise Exception("Cannot serialize")
        
        with pytest.raises(ExportGenerationError) as exc_info:
            await FallbackExporter.export_to_json(BadObject())
        
        assert exc_info.value.details["file_type"] == "JSON"


class TestFallbackPDFExporter:
    """Test fallback PDF exporter."""
    
    @pytest.mark.asyncio
    async def test_simple_pdf_generation(self):
        """Test simple PDF generation without dependencies."""
        result = await FallbackPDFExporter.export_to_simple_pdf(
            "Test content",
            "Test Title"
        )
        
        # Check PDF header
        assert result.startswith(b"%PDF-1.4")
        assert b"Test Title" in result
        assert b"%%EOF" in result


class TestFallbackQRCodeGenerator:
    """Test fallback QR code generator."""
    
    @pytest.mark.asyncio
    async def test_ascii_qr_generation(self):
        """Test ASCII QR code generation."""
        data = "https://example.com/recipe/123"
        result = await FallbackQRCodeGenerator.generate_ascii_qr(data)
        
        assert isinstance(result, str)
        assert "▄▄▄▄▄" in result  # QR pattern
        assert data in result
    
    @pytest.mark.asyncio
    async def test_ascii_qr_truncation(self):
        """Test ASCII QR with long data."""
        long_data = "https://example.com/" + "x" * 50
        result = await FallbackQRCodeGenerator.generate_ascii_qr(long_data)
        
        assert "..." in result  # Should truncate long data


class TestFallbackIntegration:
    """Test integration of fallback exporters."""
    
    @pytest.mark.asyncio
    async def test_fallback_chain(self):
        """Test chaining fallback formats."""
        # Simulate a scenario where PDF fails, falls back to HTML
        data = {
            "menu": {
                "date": date(2024, 1, 1),
                "recipes": [
                    {"name": "Breakfast", "calories": 350},
                    {"name": "Lunch", "calories": 650},
                    {"name": "Dinner", "calories": 750}
                ]
            }
        }
        
        # Try different formats
        formats = ["json", "csv", "html", "txt"]
        results = {}
        
        for format_type in formats:
            if format_type == "json":
                results[format_type] = await FallbackExporter.export_to_json(data)
            elif format_type == "csv":
                # CSV needs list of dicts
                results[format_type] = await FallbackExporter.export_to_csv(
                    data["menu"]["recipes"]
                )
            elif format_type == "html":
                results[format_type] = await FallbackExporter.export_to_html(data)
            elif format_type == "txt":
                results[format_type] = await FallbackExporter.export_to_txt(data)
        
        # Verify all formats produced output
        for format_type, result in results.items():
            assert isinstance(result, bytes)
            assert len(result) > 0
    
    @pytest.mark.asyncio
    async def test_unicode_handling(self):
        """Test Unicode handling in fallback exports."""
        data = {
            "recipe": "Pâté de Campagne",
            "ingredients": ["foie gras", "crème fraîche", "café"],
            "notes": "Contains émojis: 🍷🧀🥖"
        }
        
        # Test all formats handle Unicode properly
        json_result = await FallbackExporter.export_to_json(data)
        assert "Pâté" in json_result.decode("utf-8")
        assert "🍷" in json_result.decode("utf-8")
        
        csv_result = await FallbackExporter.export_to_csv([data])
        csv_text = csv_result.decode("utf-8")
        # CSV encodes the list as JSON, so check for the encoded version
        assert "crème fraîche" in csv_text or "cr\\u00e8me fra\\u00eeche" in csv_text
        
        html_result = await FallbackExporter.export_to_html(data)
        assert "café" in html_result.decode("utf-8")
        
        txt_result = await FallbackExporter.export_to_txt(data)
        assert "émojis" in txt_result.decode("utf-8")