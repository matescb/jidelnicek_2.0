"""
Integration tests for trip export manager with text and markdown formats.
"""

import pytest
from datetime import datetime, timedelta
import tempfile
import os

from jidelnicek.trip.services.export.export_manager import TripExportManager, ExportOptions, ExportFormat
from jidelnicek.trip.services.export.text_exporter import TripTextExporter
from jidelnicek.trip.services.export.markdown_exporter import TripMarkdownExporter


def create_test_trip_data():
    """Create sample trip data for testing."""
    start_date = datetime.now()
    
    return {
        'trip': {
            'id': '11111111-1111-1111-1111-111111111111',
            'name': 'Test Trip Export',
            'start_date': start_date.isoformat(),
            'end_date': (start_date + timedelta(days=1)).isoformat(),
            'day_count': 2,
            'description': 'Testing export functionality'
        },
        'participants': [
            {'name': 'Test User', 'diet_restrictions': []}
        ],
        'days': [
            {
                'day_number': 1,
                'date': start_date.isoformat(),
                'meals': [
                    {
                        'meal_type': 'Breakfast',
                        'recipes': [
                            {
                                'id': 'r1',
                                'name': 'Test Recipe',
                                'servings': 2
                            }
                        ]
                    }
                ]
            }
        ],
        'recipes': {
            'r1': {
                'name': 'Test Recipe',
                'servings': 2,
                'ingredients': [
                    {'amount': 100, 'unit': 'g', 'name': 'ingredient1'}
                ],
                'instructions': ['Step 1', 'Step 2']
            }
        }
    }


class TestTripExportManagerTextMarkdown:
    """Test export manager with text and markdown formats."""
    
    def test_text_format_available(self):
        """Test that text format is available in export manager."""
        manager = TripExportManager()
        
        # Check text format is registered
        assert ExportFormat.TEXT in manager.get_available_formats()
        assert manager.is_format_available(ExportFormat.TEXT)
        
        # Check file extension
        assert manager.get_file_extension(ExportFormat.TEXT) == '.txt'
        assert manager.get_mime_type(ExportFormat.TEXT) == 'text/plain'
    
    def test_markdown_format_available(self):
        """Test that markdown format is available in export manager."""
        manager = TripExportManager()
        
        # Check markdown format is registered
        assert ExportFormat.MARKDOWN in manager.get_available_formats()
        assert manager.is_format_available(ExportFormat.MARKDOWN)
        
        # Check file extension
        assert manager.get_file_extension(ExportFormat.MARKDOWN) == '.md'
        assert manager.get_mime_type(ExportFormat.MARKDOWN) == 'text/markdown'
    
    def test_export_text_via_manager(self):
        """Test exporting to text format via manager."""
        manager = TripExportManager()
        trip_data = create_test_trip_data()
        
        options = ExportOptions(
            format=ExportFormat.TEXT,
            include_recipes=True,
            include_shopping=True,
            language='cs'
        )
        
        # Export
        result = manager.export(trip_data, options)
        
        # Verify
        assert isinstance(result, bytes)
        content = result.decode('utf-8')
        assert 'Test Trip Export' in content
        assert 'Test Recipe' in content
        assert 'Denní plány' in content  # Czech language
    
    def test_export_markdown_via_manager(self):
        """Test exporting to markdown format via manager."""
        manager = TripExportManager()
        trip_data = create_test_trip_data()
        
        options = ExportOptions(
            format=ExportFormat.MARKDOWN,
            include_recipes=True,
            include_toc=True,
            language='en'
        )
        
        # Export
        result = manager.export(trip_data, options)
        
        # Verify
        assert isinstance(result, bytes)
        content = result.decode('utf-8')
        assert '# Test Trip Export' in content
        assert '## Daily Plans' in content  # English language
        assert '## Table of Contents' in content
        assert '| ' in content  # Markdown tables
    
    def test_export_options_passed_correctly(self):
        """Test that export options are passed correctly to exporters."""
        manager = TripExportManager()
        trip_data = create_test_trip_data()
        
        # Test various option combinations
        test_cases = [
            (ExportFormat.TEXT, {'compact': True, 'currency': 'EUR'}),
            (ExportFormat.MARKDOWN, {'include_nutrition': False, 'include_packing': False}),
        ]
        
        for format, extra_options in test_cases:
            options = ExportOptions(
                format=format,
                language='cs',
                **extra_options
            )
            
            result = manager.export(trip_data, options)
            assert isinstance(result, bytes)
            assert len(result) > 100
    
    def test_export_all_formats(self):
        """Test exporting to all available formats."""
        manager = TripExportManager()
        trip_data = create_test_trip_data()
        
        # Test all formats that should be available
        formats = [ExportFormat.TEXT, ExportFormat.MARKDOWN]
        
        for format in formats:
            if manager.is_format_available(format):
                options = ExportOptions(format=format)
                result = manager.export(trip_data, options)
                
                assert isinstance(result, bytes)
                assert len(result) > 100
                
                # Save to temp file with correct extension
                ext = manager.get_file_extension(format)
                with tempfile.NamedTemporaryFile(mode='wb', suffix=ext, delete=False) as f:
                    f.write(result)
                    temp_path = f.name
                
                try:
                    # Verify file is readable
                    with open(temp_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                        assert 'Test Trip Export' in content
                finally:
                    os.unlink(temp_path)
    
    def test_missing_data_handling(self):
        """Test export with missing optional data."""
        manager = TripExportManager()
        
        # Minimal trip data
        minimal_data = {
            'trip': {
                'name': 'Minimal Trip',
                'start_date': datetime.now().isoformat(),
                'end_date': datetime.now().isoformat()
            }
        }
        
        # Should work for both formats
        for format in [ExportFormat.TEXT, ExportFormat.MARKDOWN]:
            options = ExportOptions(format=format)
            result = manager.export(minimal_data, options)
            
            assert isinstance(result, bytes)
            content = result.decode('utf-8')
            assert 'Minimal Trip' in content
    
    def test_language_switching(self):
        """Test language switching for both formats."""
        manager = TripExportManager()
        trip_data = create_test_trip_data()
        
        languages = [
            ('cs', 'Denní plány', 'Recepty'),
            ('en', 'Daily Plans', 'Recipes')
        ]
        
        for format in [ExportFormat.TEXT, ExportFormat.MARKDOWN]:
            for lang, daily_label, recipe_label in languages:
                options = ExportOptions(
                    format=format,
                    language=lang,
                    include_recipes=True
                )
                
                result = manager.export(trip_data, options)
                content = result.decode('utf-8')
                
                assert daily_label in content
                assert recipe_label in content
    
    def test_exporter_initialization(self):
        """Test that exporters are properly initialized."""
        manager = TripExportManager()
        
        # Access private _exporters to verify registration
        assert ExportFormat.TEXT in manager._exporters
        assert ExportFormat.MARKDOWN in manager._exporters
        
        # Verify exporter classes
        assert manager._exporters[ExportFormat.TEXT] == TripTextExporter
        assert manager._exporters[ExportFormat.MARKDOWN] == TripMarkdownExporter