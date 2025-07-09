#!/usr/bin/env python3
"""
Demonstration of text and markdown export functionality for trips.

This script shows how to use the new text and markdown exporters
to export trip data in different formats.
"""

import sys
import os
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / 'src'))

from datetime import datetime, timedelta
from jidelnicek.trip.services.export.text_exporter import TripTextExporter
from jidelnicek.trip.services.export.markdown_exporter import TripMarkdownExporter
from jidelnicek.trip.services.export.export_manager import TripExportManager, ExportOptions, ExportFormat


def create_sample_trip():
    """Create a sample trip with recipes and shopping list."""
    start_date = datetime.now()
    
    return {
        'trip': {
            'id': '12345678-1234-1234-1234-123456789012',
            'name': 'Letní tábor 2024',
            'start_date': start_date.isoformat(),
            'end_date': (start_date + timedelta(days=3)).isoformat(),
            'day_count': 4,
            'participant_count': 6,
            'location': 'Český ráj',
            'description': 'Tradiční letní tábor pro děti s bohatým programem a zdravou stravou.'
        },
        'participants': [
            {'name': 'Petr Novák', 'age_group': 'adult', 'diet_restrictions': [], 'notes': 'Vedoucí'},
            {'name': 'Jana Svobodová', 'age_group': 'adult', 'diet_restrictions': [], 'notes': 'Kuchařka'},
            {'name': 'Tomáš Dvořák', 'age_group': 'teen', 'diet_restrictions': ['lactose-free']},
            {'name': 'Klára Pospíšilová', 'age_group': 'teen', 'diet_restrictions': ['vegetarian']},
            {'name': 'Martin Krejčí', 'age_group': 'child', 'diet_restrictions': []},
            {'name': 'Tereza Marková', 'age_group': 'child', 'diet_restrictions': ['gluten-free']}
        ],
        'days': [
            {
                'day_number': 1,
                'date': start_date.isoformat(),
                'meals': [
                    {
                        'meal_type': 'Breakfast',
                        'recipes': [
                            {'id': 'r1', 'name': 'Ovesná kaše s ovocem', 'servings': 6, 'prep_time': 10, 'cook_time': 15},
                            {'id': 'r2', 'name': 'Čaj a chléb s máslem', 'servings': 6, 'prep_time': 5, 'cook_time': 0}
                        ]
                    },
                    {
                        'meal_type': 'Lunch',
                        'recipes': [
                            {'id': 'r3', 'name': 'Kuřecí vývar s nudlemi', 'servings': 6, 'prep_time': 20, 'cook_time': 60},
                            {'id': 'r4', 'name': 'Zeleninový salát', 'servings': 6, 'prep_time': 15, 'cook_time': 0}
                        ]
                    },
                    {
                        'meal_type': 'Dinner',
                        'recipes': [
                            {'id': 'r5', 'name': 'Těstoviny s rajčatovou omáčkou', 'servings': 6, 'prep_time': 15, 'cook_time': 25}
                        ]
                    }
                ]
            }
        ],
        'recipes': {
            'r1': {
                'name': 'Ovesná kaše s ovocem',
                'servings': 6,
                'prep_time': 10,
                'cook_time': 15,
                'difficulty': 'easy',
                'ingredients': [
                    {'amount': 300, 'unit': 'g', 'name': 'ovesné vločky'},
                    {'amount': 1.5, 'unit': 'l', 'name': 'mléko'},
                    {'amount': 3, 'unit': 'ks', 'name': 'jablka'},
                    {'amount': 2, 'unit': 'ks', 'name': 'banány'},
                    {'amount': 3, 'unit': 'lžíce', 'name': 'med'},
                    {'name': 'skořice'}
                ],
                'instructions': [
                    'Mléko přiveďte k varu.',
                    'Přidejte ovesné vločky a vařte za stálého míchání 10 minut.',
                    'Mezitím nakrájejte ovoce na kousky.',
                    'Do hotové kaše přimíchejte med a skořici.',
                    'Servírujte s nakrájeným ovocem.'
                ],
                'notes': 'Pro bezlaktózovou variantu použijte rostlinné mléko.',
                'nutrition': {
                    'calories': 320,
                    'proteins': 12,
                    'carbs': 58,
                    'fats': 6,
                    'fiber': 8
                }
            },
            'r3': {
                'name': 'Kuřecí vývar s nudlemi',
                'servings': 6,
                'prep_time': 20,
                'cook_time': 60,
                'difficulty': 'medium',
                'ingredients': [
                    {'amount': 1, 'unit': 'ks', 'name': 'kuře'},
                    {'amount': 2, 'unit': 'l', 'name': 'voda'},
                    {'amount': 2, 'unit': 'ks', 'name': 'mrkev'},
                    {'amount': 1, 'unit': 'ks', 'name': 'celer'},
                    {'amount': 1, 'unit': 'ks', 'name': 'cibule'},
                    {'amount': 200, 'unit': 'g', 'name': 'nudle'},
                    {'name': 'sůl a pepř'}
                ],
                'instructions': [
                    'Kuře omyjte a vložte do hrnce s vodou.',
                    'Přidejte nakrájenou zeleninu a koření.',
                    'Vařte 45 minut na mírném ohni.',
                    'Vyjměte kuře a maso oberte.',
                    'Vývar proceďte a vraťte na oheň.',
                    'Přidejte nudle a vařte 10 minut.',
                    'Maso vraťte do vývaru a dochuťte.'
                ]
            }
        },
        'shopping_list': {
            'categories': {
                'Maso': [
                    {'name': 'kuře', 'total_amount': 1, 'unit': 'ks', 'recipes': ['Kuřecí vývar']}
                ],
                'Mléčné výrobky': [
                    {'name': 'mléko', 'total_amount': 1.5, 'unit': 'l', 'recipes': ['Ovesná kaše']},
                    {'name': 'máslo', 'total_amount': 200, 'unit': 'g', 'recipes': ['Chléb s máslem']}
                ],
                'Ovoce': [
                    {'name': 'jablka', 'total_amount': 3, 'unit': 'ks'},
                    {'name': 'banány', 'total_amount': 2, 'unit': 'ks'}
                ],
                'Zelenina': [
                    {'name': 'mrkev', 'total_amount': 2, 'unit': 'ks'},
                    {'name': 'celer', 'total_amount': 1, 'unit': 'ks'},
                    {'name': 'cibule', 'total_amount': 1, 'unit': 'ks'}
                ],
                'Ostatní': [
                    {'name': 'ovesné vločky', 'total_amount': 300, 'unit': 'g'},
                    {'name': 'nudle', 'total_amount': 200, 'unit': 'g'},
                    {'name': 'med', 'total_amount': 3, 'unit': 'lžíce'}
                ]
            },
            'summary': {
                'total_items': 12,
                'estimated_cost': 450,
                'total_weight': 3.5
            }
        },
        'nutrition': {
            'daily_averages': {
                'calories': 2200,
                'proteins': 85,
                'carbs': 280,
                'fats': 70,
                'fiber': 30,
                'sugar': 45,
                'sodium': 2100
            },
            'daily': {
                '1': {'calories': 2250, 'proteins': 88, 'carbs': 290, 'fats': 72}
            }
        },
        'packing': {
            'containers': [
                {'type': 'plastic container', 'size': '2L', 'quantity': 4, 'for_items': ['kaše', 'salát']},
                {'type': 'bottle', 'size': '1L', 'quantity': 6, 'for_items': ['voda', 'čaj']},
                {'type': 'bag', 'size': 'velký', 'quantity': 2, 'for_items': ['chléb', 'ovoce']}
            ],
            'cooler_size': 40,
            'additional_items': ['vařič', 'hrnce', 'příbory', 'talíře', 'utěrky']
        }
    }


def demo_text_export():
    """Demonstrate text export functionality."""
    print("TEXT EXPORT DEMO")
    print("=" * 60)
    
    trip_data = create_sample_trip()
    
    # Export in Czech
    exporter_cs = TripTextExporter({
        'language': 'cs',
        'include_recipes': True,
        'include_shopping': True,
        'include_nutrition': True,
        'include_packing': True,
        'currency': 'Kč'
    })
    
    result_cs = exporter_cs.export(trip_data)
    
    # Save to file
    output_dir = Path('output')
    output_dir.mkdir(exist_ok=True)
    
    with open(output_dir / 'trip_export_cs.txt', 'wb') as f:
        f.write(result_cs)
    
    print(f"✓ Czech text export saved to: {output_dir / 'trip_export_cs.txt'}")
    
    # Export in English
    exporter_en = TripTextExporter({
        'language': 'en',
        'include_recipes': True,
        'include_shopping': True,
        'include_nutrition': True,
        'include_packing': True,
        'compact': True,
        'currency': 'CZK'
    })
    
    result_en = exporter_en.export(trip_data)
    
    with open(output_dir / 'trip_export_en.txt', 'wb') as f:
        f.write(result_en)
    
    print(f"✓ English text export saved to: {output_dir / 'trip_export_en.txt'}")
    
    # Show preview
    print("\nPreview (first 500 characters):")
    print("-" * 40)
    print(result_cs[:500].decode('utf-8'))


def demo_markdown_export():
    """Demonstrate markdown export functionality."""
    print("\n\nMARKDOWN EXPORT DEMO")
    print("=" * 60)
    
    trip_data = create_sample_trip()
    
    # Export in Czech with full features
    exporter_cs = TripMarkdownExporter({
        'language': 'cs',
        'include_recipes': True,
        'include_shopping': True,
        'include_nutrition': True,
        'include_packing': True,
        'include_toc': True,
        'currency': 'Kč'
    })
    
    result_cs = exporter_cs.export(trip_data)
    
    # Save to file
    output_dir = Path('output')
    output_dir.mkdir(exist_ok=True)
    
    with open(output_dir / 'trip_export_cs.md', 'wb') as f:
        f.write(result_cs)
    
    print(f"✓ Czech markdown export saved to: {output_dir / 'trip_export_cs.md'}")
    
    # Export in English, compact mode
    exporter_en = TripMarkdownExporter({
        'language': 'en',
        'include_recipes': True,
        'include_shopping': True,
        'compact': True,
        'currency': 'CZK'
    })
    
    result_en = exporter_en.export(trip_data)
    
    with open(output_dir / 'trip_export_en.md', 'wb') as f:
        f.write(result_en)
    
    print(f"✓ English markdown export saved to: {output_dir / 'trip_export_en.md'}")
    
    # Show preview
    print("\nPreview (first 500 characters):")
    print("-" * 40)
    print(result_cs[:500].decode('utf-8'))


def demo_export_manager():
    """Demonstrate using export manager for both formats."""
    print("\n\nEXPORT MANAGER DEMO")
    print("=" * 60)
    
    trip_data = create_sample_trip()
    manager = TripExportManager()
    
    # Check available formats
    print("Available formats:", [f.value for f in manager.get_available_formats()])
    
    # Export to text
    options_text = ExportOptions(
        format=ExportFormat.TEXT,
        language='cs',
        include_recipes=True,
        include_shopping=True,
        include_nutrition=True,
        include_packing=True
    )
    
    text_result = manager.export(trip_data, options_text)
    
    output_dir = Path('output')
    output_dir.mkdir(exist_ok=True)
    
    with open(output_dir / 'trip_manager_export.txt', 'wb') as f:
        f.write(text_result)
    
    print(f"✓ Text export via manager saved to: {output_dir / 'trip_manager_export.txt'}")
    
    # Export to markdown
    options_md = ExportOptions(
        format=ExportFormat.MARKDOWN,
        language='cs',
        include_recipes=True,
        include_shopping=True,
        include_nutrition=True,
        include_packing=True
    )
    
    md_result = manager.export(trip_data, options_md)
    
    with open(output_dir / 'trip_manager_export.md', 'wb') as f:
        f.write(md_result)
    
    print(f"✓ Markdown export via manager saved to: {output_dir / 'trip_manager_export.md'}")
    
    # Show file info
    print(f"\nText file size: {len(text_result):,} bytes")
    print(f"Markdown file size: {len(md_result):,} bytes")


if __name__ == '__main__':
    print("Trip Export Demo - Text and Markdown Formats")
    print("=" * 60)
    print("This demo shows the new text and markdown export functionality.")
    print()
    
    demo_text_export()
    demo_markdown_export()
    demo_export_manager()
    
    print("\n✓ Demo complete! Check the 'output' directory for exported files.")