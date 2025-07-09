"""
Tests for trip markdown export functionality.
"""

import pytest
from datetime import datetime, timedelta
import tempfile
import os
import re

from jidelnicek.trip.services.export.markdown_exporter import TripMarkdownExporter
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
                'diet_restrictions': ['vegetarian', 'gluten-free']
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
                'notes': 'Můžete použít i jiné ovoce podle sezóny.',
                'nutrition': {
                    'calories': 350,
                    'proteins': 12,
                    'carbs': 58,
                    'fats': 8,
                    'fiber': 6
                }
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
                'estimated_cost': 150,
                'total_weight': 2.5
            }
        },
        'nutrition': {
            'daily_averages': {
                'calories': 2000,
                'proteins': 75,
                'carbs': 250,
                'fats': 65,
                'fiber': 25,
                'sugar': 50,
                'sodium': 2000
            },
            'daily': {
                '1': {
                    'calories': 2100,
                    'proteins': 78,
                    'carbs': 260,
                    'fats': 68
                },
                '2': {
                    'calories': 1900,
                    'proteins': 72,
                    'carbs': 240,
                    'fats': 62
                }
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
            'cooler_size': 25,
            'additional_items': ['cutting board', 'knife', 'can opener']
        }
    }
    
    return trip_data


class TestTripMarkdownExporter:
    """Test markdown export functionality."""
    
    def test_basic_export(self):
        """Test basic markdown export."""
        exporter = TripMarkdownExporter()
        trip_data = create_test_trip_data()
        
        # Export to markdown
        result = exporter.export(trip_data)
        
        # Check it's bytes
        assert isinstance(result, bytes)
        
        # Decode and check content
        content = result.decode('utf-8')
        assert '# Letní dovolená 2024' in content
        assert 'Šumava' in content
        assert 'Jan Novák' in content
        assert 'Marie Nováková' in content
    
    def test_markdown_formatting(self):
        """Test markdown-specific formatting."""
        exporter = TripMarkdownExporter()
        trip_data = create_test_trip_data()
        
        result = exporter.export(trip_data)
        content = result.decode('utf-8')
        
        # Check markdown elements
        assert '## ' in content  # Headers
        assert '### ' in content  # Subheaders
        assert '| ' in content   # Tables
        assert '- ' in content   # Lists
        assert '**' in content   # Bold text
        assert '[ ]' in content  # Checkboxes
    
    def test_table_of_contents(self):
        """Test table of contents with links."""
        options = {'include_toc': True}
        exporter = TripMarkdownExporter(options)
        trip_data = create_test_trip_data()
        
        result = exporter.export(trip_data)
        content = result.decode('utf-8')
        
        # Check TOC
        assert '## Obsah' in content
        assert '[Přehled výletu](#trip-overview)' in content
        assert '[Denní plány](#daily-plans)' in content
        assert '[Recepty](#recipes)' in content
    
    def test_recipe_links(self):
        """Test recipe cross-references."""
        exporter = TripMarkdownExporter({'include_recipes': True})
        trip_data = create_test_trip_data()
        
        result = exporter.export(trip_data)
        content = result.decode('utf-8')
        
        # Check recipe links in daily plans
        assert '[Ovesná kaše s ovocem](#' in content
        
        # Check recipe anchors
        assert '<a name="ovesná-kaše-s-ovocem"></a>' in content
    
    def test_nutrition_tables(self):
        """Test nutrition information in tables."""
        exporter = TripMarkdownExporter({'include_nutrition': True})
        trip_data = create_test_trip_data()
        
        result = exporter.export(trip_data)
        content = result.decode('utf-8')
        
        # Check nutrition table
        assert '| **Kalorie** |' in content
        assert '| **Bílkoviny** |' in content
        assert 'kcal' in content
        assert '2000' in content  # Daily average calories
        
        # Check daily breakdown table
        assert '| Den 1 |' in content
        assert '2100 kcal' in content
    
    def test_shopping_list_checkboxes(self):
        """Test shopping list with checkboxes."""
        exporter = TripMarkdownExporter({'include_shopping': True})
        trip_data = create_test_trip_data()
        
        result = exporter.export(trip_data)
        content = result.decode('utf-8')
        
        # Check checkbox format
        assert '- [ ] **mléko**' in content
        assert '- [ ] **jablka**' in content
        
        # Check recipe references
        assert '_(Ovesná kaše)_' in content
    
    def test_metadata_header(self):
        """Test YAML metadata header."""
        exporter = TripMarkdownExporter({'compact': False})
        trip_data = create_test_trip_data()
        
        result = exporter.export(trip_data)
        content = result.decode('utf-8')
        
        # Check metadata
        assert '---' in content
        assert 'title: Letní dovolená 2024' in content
        assert 'language: cs' in content
    
    def test_english_export(self):
        """Test export in English."""
        options = {
            'language': 'en',
            'include_recipes': True,
            'include_nutrition': True
        }
        
        exporter = TripMarkdownExporter(options)
        trip_data = create_test_trip_data()
        
        result = exporter.export(trip_data)
        content = result.decode('utf-8')
        
        # Check English labels
        assert '## Trip Overview' in content
        assert '**Start Date**' in content
        assert '## Recipes' in content
        assert '#### Ingredients' in content
        assert '## Nutritional Information' in content
    
    def test_compact_mode(self):
        """Test compact mode without extra formatting."""
        options = {
            'compact': True,
            'include_toc': False
        }
        
        exporter = TripMarkdownExporter(options)
        trip_data = create_test_trip_data()
        
        result = exporter.export(trip_data)
        content = result.decode('utf-8')
        
        # No metadata header
        assert 'title: Letní dovolená' not in content
        
        # No table of contents
        assert '## Obsah' not in content
        
        # Fewer dividers
        assert content.count('---') < 3
    
    def test_export_to_file(self):
        """Test exporting to actual markdown file."""
        exporter = TripMarkdownExporter({'language': 'cs'})
        trip_data = create_test_trip_data()
        
        # Export
        result = exporter.export(trip_data)
        
        # Write to temp file
        with tempfile.NamedTemporaryFile(mode='wb', suffix='.md', delete=False) as f:
            f.write(result)
            temp_path = f.name
        
        try:
            # Read back and verify
            with open(temp_path, 'r', encoding='utf-8') as f:
                content = f.read()
                assert '# Letní dovolená 2024' in content
                assert '## Přehled výletu' in content
                
                # Check it's valid markdown structure
                headers = re.findall(r'^#+\s+.+$', content, re.MULTILINE)
                assert len(headers) > 5
        finally:
            os.unlink(temp_path)
    
    def test_anchor_generation(self):
        """Test anchor generation for recipe links."""
        exporter = TripMarkdownExporter()
        
        # Test various recipe names
        assert exporter._make_anchor('Simple Recipe') == 'simple-recipe'
        assert exporter._make_anchor('Česnečka') == 'česnečka'
        assert exporter._make_anchor('Recipe with 123 numbers') == 'recipe-with-123-numbers'
        assert exporter._make_anchor('Special!@# Characters') == 'special-characters'
    
    def test_participant_restrictions(self):
        """Test participant dietary restrictions formatting."""
        exporter = TripMarkdownExporter()
        trip_data = create_test_trip_data()
        
        result = exporter.export(trip_data)
        content = result.decode('utf-8')
        
        # Check participant with restrictions
        assert '**Marie Nováková** _(vegetarian, gluten-free)_' in content
    
    def test_packing_checklist(self):
        """Test packing recommendations with checkboxes."""
        exporter = TripMarkdownExporter({'include_packing': True})
        trip_data = create_test_trip_data()
        
        result = exporter.export(trip_data)
        content = result.decode('utf-8')
        
        # Check packing items
        assert '- [ ] **2x** plastová nádoba (1L)' in content
        assert 'Pro: _salát, ovoce_' in content
        assert '**Doporučená velikost chladicího boxu**: 25L' in content
        
        # Check additional items
        assert '- [ ] cutting board' in content
        assert '**Celkem položek k zabalení**: 4' in content
    
    def test_nutritional_balance(self):
        """Test nutritional balance calculation."""
        exporter = TripMarkdownExporter({'include_nutrition': True, 'compact': False})
        trip_data = create_test_trip_data()
        
        result = exporter.export(trip_data)
        content = result.decode('utf-8')
        
        # Check balance section
        assert '### Nutriční bilance' in content
        assert '**Bílkoviny**:' in content
        assert '%' in content  # Percentage values