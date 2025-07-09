"""
Tests for trip text export functionality.
"""

import pytest
from datetime import datetime, timedelta
import tempfile
import os

from jidelnicek.trip.services.export.text_exporter import TripTextExporter
from jidelnicek.trip.services.export.export_manager import ExportOptions, ExportFormat


def create_test_trip_data():
    """Create sample trip data for testing."""
    start_date = datetime.now()
    
    trip_data = {
        'trip': {
            'id': '11111111-1111-1111-1111-111111111111',
            'name': 'Letní dovolená 2024',
            'start_date': start_date.isoformat(),
            'end_date': (start_date + timedelta(days=2)).isoformat(),
            'day_count': 3,
            'participant_count': 2,
            'location': 'Šumava',
            'description': 'Rodinná dovolená v přírodě'
        },
        'participants': [
            {
                'name': 'Jan Novák',
                'age_group': 'adult',
                'diet_restrictions': []
            },
            {
                'name': 'Marie Nováková',
                'age_group': 'adult',
                'diet_restrictions': ['vegetarian']
            }
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
                                'id': 'recipe1',
                                'name': 'Ovesná kaše s ovocem',
                                'servings': 2,
                                'prep_time': 10,
                                'cook_time': 5
                            }
                        ]
                    },
                    {
                        'meal_type': 'Lunch',
                        'recipes': [
                            {
                                'id': 'recipe2',
                                'name': 'Těstovinový salát',
                                'servings': 2,
                                'prep_time': 15,
                                'cook_time': 10
                            }
                        ]
                    }
                ]
            }
        ],
        'recipes': {
            'recipe1': {
                'name': 'Ovesná kaše s ovocem',
                'servings': 2,
                'prep_time': 10,
                'cook_time': 5,
                'difficulty': 'easy',
                'ingredients': [
                    {'amount': 100, 'unit': 'g', 'name': 'ovesné vločky'},
                    {'amount': 400, 'unit': 'ml', 'name': 'mléko'},
                    {'amount': 2, 'unit': 'ks', 'name': 'jablka'},
                    {'amount': 1, 'unit': 'lžíce', 'name': 'med'}
                ],
                'instructions': [
                    'Vločky zalijte mlékem a přiveďte k varu.',
                    'Vařte 5 minut za stálého míchání.',
                    'Přidejte nakrájená jablka a med.'
                ],
                'notes': 'Můžete použít i jiné ovoce podle sezóny.'
            }
        },
        'shopping_list': {
            'categories': {
                'Mléčné výrobky': [
                    {
                        'name': 'mléko',
                        'total_amount': 400,
                        'unit': 'ml',
                        'recipes': ['Ovesná kaše']
                    }
                ],
                'Ovoce': [
                    {
                        'name': 'jablka',
                        'total_amount': 2,
                        'unit': 'ks'
                    }
                ]
            },
            'summary': {
                'total_items': 4,
                'estimated_cost': 150
            }
        },
        'nutrition': {
            'daily_averages': {
                'calories': 2000,
                'proteins': 75,
                'carbs': 250,
                'fats': 65,
                'fiber': 25
            }
        },
        'packing': {
            'containers': [
                {
                    'type': 'plastic container',
                    'size': '1L',
                    'quantity': 2,
                    'for_items': ['salát', 'ovoce']
                }
            ],
            'cooler_size': 25
        }
    }
    
    return trip_data


class TestTripTextExporter:
    """Test text export functionality."""
    
    def test_basic_export(self):
        """Test basic text export."""
        exporter = TripTextExporter()
        trip_data = create_test_trip_data()
        
        # Export to text
        result = exporter.export(trip_data)
        
        # Check it's bytes
        assert isinstance(result, bytes)
        
        # Decode and check content
        content = result.decode('utf-8')
        assert 'Letní dovolená 2024' in content
        assert 'Šumava' in content
        assert 'Jan Novák' in content
        assert 'Marie Nováková' in content
    
    def test_export_with_options(self):
        """Test export with various options."""
        options = {
            'include_recipes': True,
            'include_shopping': True,
            'include_nutrition': True,
            'include_packing': True,
            'language': 'cs',
            'compact': False
        }
        
        exporter = TripTextExporter(options)
        trip_data = create_test_trip_data()
        
        result = exporter.export(trip_data)
        content = result.decode('utf-8')
        
        # Check sections are included
        assert 'Recepty' in content
        assert 'Nákupní seznam' in content
        assert 'Nutriční informace' in content
        assert 'Doporučení k balení' in content
        
        # Check recipe details
        assert 'Ovesná kaše s ovocem' in content
        assert 'ovesné vločky' in content
        assert 'Postup' in content
    
    def test_export_english(self):
        """Test export in English."""
        options = {
            'language': 'en',
            'include_recipes': True
        }
        
        exporter = TripTextExporter(options)
        trip_data = create_test_trip_data()
        
        result = exporter.export(trip_data)
        content = result.decode('utf-8')
        
        # Check English labels
        assert 'Trip Overview' in content
        assert 'Start Date' in content
        assert 'Participants' in content
        assert 'Recipes' in content
        assert 'Ingredients' in content
    
    def test_compact_export(self):
        """Test compact export format."""
        options = {
            'compact': True,
            'include_toc': False
        }
        
        exporter = TripTextExporter(options)
        trip_data = create_test_trip_data()
        
        result = exporter.export(trip_data)
        content = result.decode('utf-8')
        
        # Check no table of contents
        assert 'Obsah' not in content
        
        # Check compact formatting
        lines = content.split('\n')
        # Should have fewer decorative lines
        assert content.count('=' * 80) < 2
    
    def test_export_to_file(self):
        """Test exporting to actual file."""
        exporter = TripTextExporter({'language': 'cs'})
        trip_data = create_test_trip_data()
        
        # Export
        result = exporter.export(trip_data)
        
        # Write to temp file
        with tempfile.NamedTemporaryFile(mode='wb', suffix='.txt', delete=False) as f:
            f.write(result)
            temp_path = f.name
        
        try:
            # Read back and verify
            with open(temp_path, 'r', encoding='utf-8') as f:
                content = f.read()
                assert 'Letní dovolená 2024' in content
                assert len(content) > 100
        finally:
            os.unlink(temp_path)
    
    def test_missing_optional_data(self):
        """Test export with missing optional sections."""
        exporter = TripTextExporter()
        
        # Minimal trip data
        trip_data = {
            'trip': {
                'name': 'Test Trip',
                'start_date': datetime.now().isoformat(),
                'end_date': datetime.now().isoformat(),
                'day_count': 1
            },
            'days': []
        }
        
        # Should not raise error
        result = exporter.export(trip_data)
        content = result.decode('utf-8')
        
        assert 'Test Trip' in content
        assert 'Denní plány' in content
    
    def test_date_formatting(self):
        """Test date formatting for different locales."""
        # Czech
        exporter_cs = TripTextExporter({'language': 'cs'})
        date_str = exporter_cs._format_date(datetime(2024, 3, 15))
        assert date_str == '15. 3. 2024'
        
        # English
        exporter_en = TripTextExporter({'language': 'en'})
        date_str = exporter_en._format_date(datetime(2024, 3, 15))
        assert 'March 15, 2024' in date_str
    
    def test_translations(self):
        """Test translation functionality."""
        # Czech translations
        exporter_cs = TripTextExporter({'language': 'cs'})
        assert exporter_cs._t('Breakfast') == 'Snídaně'
        assert exporter_cs._t('Recipes') == 'Recepty'
        
        # English (no translation needed)
        exporter_en = TripTextExporter({'language': 'en'})
        assert exporter_en._t('Breakfast') == 'Breakfast'
        assert exporter_en._t('Unknown Key') == 'Unknown Key'