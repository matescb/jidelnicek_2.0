"""
Enhanced PDF exporter for trips with ReportLab.

Provides comprehensive PDF export with:
- Trip overview and summary
- Daily meal plans with recipes
- Shopping lists with categories
- Nutritional charts and analysis
- Czech language support
"""

import io
from typing import Dict, Any, Optional, List, Tuple
from datetime import datetime, date
from decimal import Decimal
import logging

try:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4, letter
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import cm, mm, inch
    from reportlab.platypus import (
        SimpleDocTemplate, Table, TableStyle, Paragraph,
        Spacer, PageBreak, KeepTogether, Image,
        ListFlowable, ListItem, Frame, PageTemplate,
        BaseDocTemplate, FrameBreak
    )
    from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT, TA_JUSTIFY
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    from reportlab.graphics.shapes import Drawing
    from reportlab.graphics.charts.piecharts import Pie
    from reportlab.graphics.charts.barcharts import VerticalBarChart
    from reportlab.graphics.charts.legends import Legend
    from reportlab.graphics import renderPDF
    REPORTLAB_AVAILABLE = True
except ImportError:
    REPORTLAB_AVAILABLE = False
    # Define dummy values for type hints
    colors = Any
    A4 = (595.27, 841.89)
    cm = 28.35
    mm = 2.835


logger = logging.getLogger(__name__)


class TripPDFExporter:
    """
    Enhanced PDF exporter for complete trip documentation.
    
    Creates professional PDFs with:
    - Cover page with trip summary
    - Table of contents
    - Daily meal plans
    - Recipe details
    - Shopping lists
    - Nutritional analysis
    - Packing recommendations
    """
    
    def __init__(self, options: Optional[Dict[str, Any]] = None):
        """
        Initialize PDF exporter.
        
        Args:
            options: Export options including:
                - page_size: 'A4' or 'letter'
                - language: 'cs' or 'en'
                - include_recipes: Include full recipe details
                - include_nutrition: Include nutritional charts
                - include_shopping: Include shopping lists
                - include_packing: Include packing recommendations
        """
        if not REPORTLAB_AVAILABLE:
            raise ImportError(
                "reportlab is required for PDF export. "
                "Install with: pip install reportlab"
            )
            
        self.options = options or {}
        self.page_size = A4 if self.options.get('page_size', 'A4') == 'A4' else letter
        self.language = self.options.get('language', 'cs')
        
        # Set up styles
        self.styles = getSampleStyleSheet()
        self._setup_custom_styles()
        
        # Try to register Czech fonts if available
        self._register_fonts()
        
    def export(self, trip_data: Dict[str, Any]) -> bytes:
        """
        Export trip data to PDF.
        
        Args:
            trip_data: Complete trip data including:
                - trip: Trip information
                - days: List of trip days with meals
                - recipes: Recipe details
                - shopping_list: Aggregated shopping data
                - participants: Participant information
                
        Returns:
            PDF file as bytes
        """
        # Create PDF buffer
        buffer = io.BytesIO()
        
        # Create document with custom page templates
        doc = self._create_document(buffer)
        
        # Build content
        story = []
        
        # Cover page
        story.extend(self._create_cover_page(trip_data))
        story.append(PageBreak())
        
        # Table of contents
        if self.options.get('include_toc', True):
            story.extend(self._create_table_of_contents(trip_data))
            story.append(PageBreak())
            
        # Trip overview
        story.extend(self._create_trip_overview(trip_data))
        story.append(PageBreak())
        
        # Daily meal plans
        story.extend(self._create_daily_plans(trip_data))
        
        # Recipe details
        if self.options.get('include_recipes', True):
            story.append(PageBreak())
            story.extend(self._create_recipe_section(trip_data))
            
        # Shopping lists
        if self.options.get('include_shopping', True):
            story.append(PageBreak())
            story.extend(self._create_shopping_section(trip_data))
            
        # Nutritional analysis
        if self.options.get('include_nutrition', True):
            story.append(PageBreak())
            story.extend(self._create_nutrition_section(trip_data))
            
        # Packing recommendations
        if self.options.get('include_packing', True):
            story.append(PageBreak())
            story.extend(self._create_packing_section(trip_data))
            
        # Build PDF
        doc.build(story, onFirstPage=self._header_footer, onLaterPages=self._header_footer)
        
        # Get bytes
        buffer.seek(0)
        return buffer.read()
        
    def _create_document(self, buffer: io.BytesIO):
        """Create document with custom settings."""
        doc = SimpleDocTemplate(
            buffer,
            pagesize=self.page_size,
            rightMargin=2*cm,
            leftMargin=2*cm,
            topMargin=3*cm,
            bottomMargin=2.5*cm,
            title="Trip Plan",
            author="Jidelnicek 2.0"
        )
        return doc
        
    def _setup_custom_styles(self):
        """Set up custom paragraph styles."""
        # Title style
        self.styles.add(ParagraphStyle(
            name='CoverTitle',
            parent=self.styles['Title'],
            fontSize=32,
            textColor=colors.HexColor('#1a5490'),
            spaceAfter=24,
            alignment=TA_CENTER
        ))
        
        # Subtitle
        self.styles.add(ParagraphStyle(
            name='CoverSubtitle',
            parent=self.styles['Title'],
            fontSize=20,
            textColor=colors.HexColor('#2c3e50'),
            spaceAfter=12,
            alignment=TA_CENTER
        ))
        
        # Section header
        self.styles.add(ParagraphStyle(
            name='SectionHeader',
            parent=self.styles['Heading1'],
            fontSize=18,
            textColor=colors.HexColor('#1a5490'),
            spaceBefore=12,
            spaceAfter=6,
            borderColor=colors.HexColor('#1a5490'),
            borderWidth=2,
            borderPadding=4,
            borderRadius=2
        ))
        
        # Day header
        self.styles.add(ParagraphStyle(
            name='DayHeader',
            parent=self.styles['Heading2'],
            fontSize=16,
            textColor=colors.HexColor('#34495e'),
            spaceBefore=12,
            spaceAfter=6
        ))
        
        # Meal header
        self.styles.add(ParagraphStyle(
            name='MealHeader',
            parent=self.styles['Heading3'],
            fontSize=14,
            textColor=colors.HexColor('#7f8c8d'),
            spaceBefore=6,
            spaceAfter=3
        ))
        
        # Recipe title
        self.styles.add(ParagraphStyle(
            name='RecipeTitle',
            parent=self.styles['Heading3'],
            fontSize=14,
            textColor=colors.HexColor('#27ae60'),
            spaceBefore=6,
            spaceAfter=3
        ))
        
    def _register_fonts(self):
        """Register fonts for better Unicode support."""
        # This is a placeholder - in production, you would register
        # actual TTF fonts that support Czech characters
        pass
        
    def _header_footer(self, canvas, doc):
        """Add header and footer to pages."""
        canvas.saveState()
        
        # Header
        if hasattr(doc, 'trip_name'):
            canvas.setFont('Helvetica', 9)
            canvas.drawString(
                doc.leftMargin,
                doc.height + doc.topMargin - 0.5*cm,
                doc.trip_name
            )
            
        # Footer with page numbers
        canvas.setFont('Helvetica', 8)
        canvas.drawRightString(
            doc.width + doc.leftMargin,
            doc.bottomMargin - 0.5*cm,
            f"Strana {doc.page}"
        )
        
        # Footer center - date
        canvas.drawCentredString(
            doc.width / 2 + doc.leftMargin,
            doc.bottomMargin - 0.5*cm,
            datetime.now().strftime('%d.%m.%Y')
        )
        
        canvas.restoreState()
        
    def _create_cover_page(self, trip_data: Dict[str, Any]) -> List:
        """Create cover page elements."""
        elements = []
        trip = trip_data['trip']
        
        # Title
        elements.append(Spacer(1, 3*cm))
        elements.append(Paragraph(
            trip['name'],
            self.styles['CoverTitle']
        ))
        
        # Date range
        start_date = datetime.fromisoformat(trip['start_date']).strftime('%d.%m.%Y')
        end_date = datetime.fromisoformat(trip['end_date']).strftime('%d.%m.%Y')
        elements.append(Paragraph(
            f"{start_date} - {end_date}",
            self.styles['CoverSubtitle']
        ))
        
        elements.append(Spacer(1, 2*cm))
        
        # Trip info table
        info_data = []
        
        if trip.get('location'):
            info_data.append(['Místo:', trip['location']])
            
        info_data.append(['Počet dní:', str(trip['day_count'])])
        info_data.append(['Počet účastníků:', str(trip['participant_count'])])
        
        if trip.get('trip_type'):
            trip_types = {
                'family': 'Rodinný výlet',
                'friends': 'S přáteli',
                'business': 'Pracovní',
                'solo': 'Sólový výlet',
                'other': 'Jiný'
            }
            info_data.append(['Typ výletu:', trip_types.get(trip['trip_type'], trip['trip_type'])])
            
        if info_data:
            info_table = Table(info_data, colWidths=[5*cm, 8*cm])
            info_table.setStyle(TableStyle([
                ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
                ('FONTSIZE', (0, 0), (-1, -1), 12),
                ('ALIGN', (0, 0), (0, -1), 'RIGHT'),
                ('ALIGN', (1, 0), (1, -1), 'LEFT'),
                ('TEXTCOLOR', (0, 0), (0, -1), colors.grey),
                ('TOPPADDING', (0, 0), (-1, -1), 6),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ]))
            elements.append(info_table)
            
        # Description if available
        if trip.get('description'):
            elements.append(Spacer(1, 1*cm))
            elements.append(Paragraph(
                trip['description'],
                self.styles['BodyText']
            ))
            
        return elements
        
    def _create_table_of_contents(self, trip_data: Dict[str, Any]) -> List:
        """Create table of contents."""
        elements = []
        
        elements.append(Paragraph("Obsah", self.styles['SectionHeader']))
        elements.append(Spacer(1, 0.5*cm))
        
        toc_data = []
        page_num = 3  # Assuming cover and TOC take 2 pages
        
        # Trip overview
        toc_data.append(['Přehled výletu', str(page_num)])
        page_num += 1
        
        # Daily plans
        toc_data.append(['Denní plány', str(page_num)])
        page_num += len(trip_data['days'])
        
        # Optional sections
        if self.options.get('include_recipes', True):
            toc_data.append(['Recepty', str(page_num)])
            page_num += self._estimate_recipe_pages(trip_data)
            
        if self.options.get('include_shopping', True):
            toc_data.append(['Nákupní seznam', str(page_num)])
            page_num += 2
            
        if self.options.get('include_nutrition', True):
            toc_data.append(['Nutriční analýza', str(page_num)])
            page_num += 2
            
        if self.options.get('include_packing', True):
            toc_data.append(['Doporučení pro balení', str(page_num)])
            
        # Create TOC table
        toc_table = Table(toc_data, colWidths=[12*cm, 2*cm])
        toc_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 11),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('LINEBELOW', (0, 0), (-1, -1), 0.5, colors.grey),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ]))
        
        elements.append(toc_table)
        return elements
        
    def _create_trip_overview(self, trip_data: Dict[str, Any]) -> List:
        """Create trip overview section."""
        elements = []
        
        elements.append(Paragraph("Přehled výletu", self.styles['SectionHeader']))
        elements.append(Spacer(1, 0.5*cm))
        
        # Participant list
        if 'participants' in trip_data:
            elements.append(Paragraph("Účastníci:", self.styles['Heading3']))
            
            participant_items = []
            for p in trip_data['participants']:
                age_info = f" ({p['age_group']})" if p.get('age_group') else ""
                dietary_info = f" - {p['dietary_restrictions']}" if p.get('dietary_restrictions') else ""
                participant_items.append(ListItem(
                    Paragraph(f"{p['name']}{age_info}{dietary_info}", self.styles['BodyText'])
                ))
                
            elements.append(ListFlowable(participant_items, bulletType='bullet'))
            elements.append(Spacer(1, 0.5*cm))
            
        # Meal summary
        total_meals = sum(len(day.get('meals', [])) for day in trip_data['days'])
        unique_recipes = len(set(
            meal['recipe_id'] 
            for day in trip_data['days'] 
            for meal in day.get('meals', [])
            if meal.get('recipe_id')
        ))
        
        summary_data = [
            ['Celkový počet jídel:', str(total_meals)],
            ['Počet unikátních receptů:', str(unique_recipes)],
            ['Průměr jídel na den:', f"{total_meals / len(trip_data['days']):.1f}"]
        ]
        
        summary_table = Table(summary_data, colWidths=[6*cm, 4*cm])
        summary_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('ALIGN', (0, 0), (0, -1), 'RIGHT'),
            ('ALIGN', (1, 0), (1, -1), 'LEFT'),
            ('TEXTCOLOR', (0, 0), (0, -1), colors.grey),
        ]))
        
        elements.append(summary_table)
        return elements
        
    def _create_daily_plans(self, trip_data: Dict[str, Any]) -> List:
        """Create daily meal plan pages."""
        elements = []
        
        elements.append(Paragraph("Denní plány", self.styles['SectionHeader']))
        
        for day in trip_data['days']:
            elements.append(Spacer(1, 0.5*cm))
            
            # Day header
            day_date = datetime.fromisoformat(day['date']).strftime('%A %d.%m.%Y')
            elements.append(Paragraph(
                f"Den {day['day_number']}: {day_date}",
                self.styles['DayHeader']
            ))
            
            # Meals for the day
            if day.get('meals'):
                meal_data = []
                for meal in day['meals']:
                    meal_type = self._translate_meal_type(meal['meal_type'])
                    recipe_name = meal.get('recipe_name', 'Neznámý recept')
                    servings = meal.get('participant_count', trip_data['trip']['participant_count'])
                    
                    meal_data.append([
                        meal_type,
                        recipe_name,
                        f"{servings} porcí"
                    ])
                    
                meal_table = Table(meal_data, colWidths=[3*cm, 8*cm, 3*cm])
                meal_table.setStyle(TableStyle([
                    ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
                    ('FONTSIZE', (0, 0), (-1, -1), 10),
                    ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
                    ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f8f9fa')),
                    ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                    ('ALIGN', (2, 0), (2, -1), 'CENTER'),
                    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                    ('TOPPADDING', (0, 0), (-1, -1), 6),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                ]))
                
                elements.append(meal_table)
            else:
                elements.append(Paragraph(
                    "Žádná jídla naplánována",
                    self.styles['BodyText']
                ))
                
            # Don't break page for each day in compact mode
            if not self.options.get('compact', False):
                elements.append(PageBreak())
                
        return elements
        
    def _create_recipe_section(self, trip_data: Dict[str, Any]) -> List:
        """Create detailed recipe section."""
        elements = []
        
        elements.append(Paragraph("Recepty", self.styles['SectionHeader']))
        
        # Get unique recipes
        recipe_ids = set()
        for day in trip_data['days']:
            for meal in day.get('meals', []):
                if meal.get('recipe_id'):
                    recipe_ids.add(meal['recipe_id'])
                    
        # Get recipe details
        recipes = trip_data.get('recipes', {})
        
        for recipe_id in sorted(recipe_ids):
            recipe = recipes.get(str(recipe_id), {})
            if not recipe:
                continue
                
            elements.append(Spacer(1, 0.5*cm))
            
            # Recipe name
            elements.append(Paragraph(
                recipe.get('name', 'Neznámý recept'),
                self.styles['RecipeTitle']
            ))
            
            # Recipe info
            info_parts = []
            if recipe.get('prep_time'):
                info_parts.append(f"Příprava: {recipe['prep_time']} min")
            if recipe.get('cook_time'):
                info_parts.append(f"Vaření: {recipe['cook_time']} min")
            if recipe.get('difficulty'):
                diff_map = {'easy': 'Snadné', 'medium': 'Střední', 'hard': 'Náročné'}
                info_parts.append(f"Obtížnost: {diff_map.get(recipe['difficulty'], recipe['difficulty'])}")
                
            if info_parts:
                elements.append(Paragraph(
                    " | ".join(info_parts),
                    self.styles['BodyText']
                ))
                
            # Ingredients
            if recipe.get('ingredients'):
                elements.append(Paragraph("Ingredience:", self.styles['Heading4']))
                
                ing_items = []
                for ing in recipe['ingredients']:
                    text = f"{ing['name']} - {ing['quantity']} {ing['unit']}"
                    if ing.get('notes'):
                        text += f" ({ing['notes']})"
                    ing_items.append(ListItem(Paragraph(text, self.styles['BodyText'])))
                    
                elements.append(ListFlowable(ing_items, bulletType='bullet'))
                
            # Instructions
            if recipe.get('instructions'):
                elements.append(Paragraph("Postup:", self.styles['Heading4']))
                elements.append(Paragraph(
                    recipe['instructions'],
                    self.styles['BodyText']
                ))
                
            # Page break between recipes
            if not self.options.get('compact', False):
                elements.append(PageBreak())
                
        return elements
        
    def _create_shopping_section(self, trip_data: Dict[str, Any]) -> List:
        """Create shopping list section."""
        elements = []
        
        elements.append(Paragraph("Nákupní seznam", self.styles['SectionHeader']))
        elements.append(Spacer(1, 0.5*cm))
        
        shopping_list = trip_data.get('shopping_list', {})
        
        if not shopping_list:
            elements.append(Paragraph(
                "Nákupní seznam není k dispozici",
                self.styles['BodyText']
            ))
            return elements
            
        # Group items by category
        categories = shopping_list.get('categories', {})
        
        for category, items in categories.items():
            if not items:
                continue
                
            elements.append(Paragraph(category, self.styles['MealHeader']))
            
            # Create table for items
            item_data = []
            for item in items:
                checkbox = '☐'
                name = item['name']
                quantity = f"{item['quantity']} {item['unit']}"
                item_data.append([checkbox, name, quantity])
                
            item_table = Table(item_data, colWidths=[0.8*cm, 9*cm, 3*cm])
            item_table.setStyle(TableStyle([
                ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
                ('FONTSIZE', (0, 0), (-1, -1), 10),
                ('ALIGN', (0, 0), (0, -1), 'CENTER'),
                ('ALIGN', (2, 0), (2, -1), 'RIGHT'),
                ('LINEBELOW', (0, 0), (-1, -1), 0.25, colors.lightgrey),
                ('TOPPADDING', (0, 0), (-1, -1), 4),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ]))
            
            elements.append(item_table)
            elements.append(Spacer(1, 0.3*cm))
            
        # Summary
        if shopping_list.get('summary'):
            elements.append(Spacer(1, 0.5*cm))
            elements.append(Paragraph("Souhrn:", self.styles['Heading4']))
            
            summary = shopping_list['summary']
            summary_text = []
            
            if summary.get('total_items'):
                summary_text.append(f"Celkem položek: {summary['total_items']}")
            if summary.get('total_weight'):
                summary_text.append(f"Celková váha: {summary['total_weight']:.1f} kg")
            if summary.get('total_volume'):
                summary_text.append(f"Celkový objem: {summary['total_volume']:.1f} L")
                
            elements.append(Paragraph(
                " | ".join(summary_text),
                self.styles['BodyText']
            ))
            
        return elements
        
    def _create_nutrition_section(self, trip_data: Dict[str, Any]) -> List:
        """Create nutritional analysis section with charts."""
        elements = []
        
        elements.append(Paragraph("Nutriční analýza", self.styles['SectionHeader']))
        elements.append(Spacer(1, 0.5*cm))
        
        # Get nutrition data
        nutrition = trip_data.get('nutrition', {})
        
        if not nutrition:
            elements.append(Paragraph(
                "Nutriční data nejsou k dispozici",
                self.styles['BodyText']
            ))
            return elements
            
        # Daily averages
        if nutrition.get('daily_averages'):
            elements.append(Paragraph("Denní průměry:", self.styles['Heading3']))
            
            avg_data = []
            averages = nutrition['daily_averages']
            
            if averages.get('calories'):
                avg_data.append(['Kalorie:', f"{averages['calories']:.0f} kcal"])
            if averages.get('proteins'):
                avg_data.append(['Bílkoviny:', f"{averages['proteins']:.1f} g"])
            if averages.get('carbs'):
                avg_data.append(['Sacharidy:', f"{averages['carbs']:.1f} g"])
            if averages.get('fats'):
                avg_data.append(['Tuky:', f"{averages['fats']:.1f} g"])
            if averages.get('fiber'):
                avg_data.append(['Vláknina:', f"{averages['fiber']:.1f} g"])
                
            avg_table = Table(avg_data, colWidths=[4*cm, 3*cm])
            avg_table.setStyle(TableStyle([
                ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
                ('FONTSIZE', (0, 0), (-1, -1), 10),
                ('ALIGN', (0, 0), (0, -1), 'RIGHT'),
                ('ALIGN', (1, 0), (1, -1), 'LEFT'),
            ]))
            
            elements.append(avg_table)
            elements.append(Spacer(1, 0.5*cm))
            
        # Macronutrient pie chart
        if all(k in nutrition.get('daily_averages', {}) for k in ['proteins', 'carbs', 'fats']):
            elements.append(Paragraph("Rozložení makroživin:", self.styles['Heading3']))
            
            # Create pie chart
            drawing = Drawing(400, 200)
            pie = Pie()
            pie.x = 50
            pie.y = 50
            pie.width = 100
            pie.height = 100
            
            # Data
            data = [
                nutrition['daily_averages']['proteins'] * 4,  # kcal from protein
                nutrition['daily_averages']['carbs'] * 4,     # kcal from carbs
                nutrition['daily_averages']['fats'] * 9       # kcal from fats
            ]
            pie.data = data
            pie.labels = ['Bílkoviny', 'Sacharidy', 'Tuky']
            pie.slices.strokeWidth = 0.5
            pie.slices[0].fillColor = colors.HexColor('#3498db')
            pie.slices[1].fillColor = colors.HexColor('#2ecc71')
            pie.slices[2].fillColor = colors.HexColor('#f39c12')
            
            drawing.add(pie)
            
            # Add legend
            legend = Legend()
            legend.x = 200
            legend.y = 100
            legend.deltax = 75
            legend.deltay = 20
            legend.autoXPadding = 5
            legend.columnMaximum = 1
            legend.strokeWidth = 0
            legend.strokeColor = colors.black
            legend.fontName = 'Helvetica'
            legend.fontSize = 10
            legend.alignment = 'right'
            legend.colorNamePairs = [
                (colors.HexColor('#3498db'), 'Bílkoviny'),
                (colors.HexColor('#2ecc71'), 'Sacharidy'),
                (colors.HexColor('#f39c12'), 'Tuky')
            ]
            
            drawing.add(legend)
            elements.append(drawing)
            
        return elements
        
    def _create_packing_section(self, trip_data: Dict[str, Any]) -> List:
        """Create packing recommendations section."""
        elements = []
        
        elements.append(Paragraph("Doporučení pro balení", self.styles['SectionHeader']))
        elements.append(Spacer(1, 0.5*cm))
        
        packing = trip_data.get('packing', {})
        
        if not packing:
            # Generate basic recommendations
            elements.append(Paragraph(
                "Základní doporučení pro balení:",
                self.styles['Heading3']
            ))
            
            recommendations = [
                "Chladicí box pro čerstvé potraviny",
                "Kontejnery na uskladnění potravin",
                "Základní kuchyňské náčiní",
                "Čisticí prostředky",
                "Ubrousky a papírové utěrky"
            ]
            
            rec_items = [
                ListItem(Paragraph(rec, self.styles['BodyText']))
                for rec in recommendations
            ]
            
            elements.append(ListFlowable(rec_items, bulletType='bullet'))
            
        else:
            # Container recommendations
            if packing.get('containers'):
                elements.append(Paragraph("Doporučené kontejnery:", self.styles['Heading3']))
                
                container_data = []
                for container in packing['containers']:
                    container_data.append([
                        container['type'],
                        container['size'],
                        f"{container['quantity']}x"
                    ])
                    
                container_table = Table(container_data, colWidths=[5*cm, 5*cm, 2*cm])
                container_table.setStyle(TableStyle([
                    ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
                    ('FONTSIZE', (0, 0), (-1, -1), 10),
                    ('ALIGN', (2, 0), (2, -1), 'CENTER'),
                    ('GRID', (0, 0), (-1, -1), 0.5, colors.lightgrey),
                    ('TOPPADDING', (0, 0), (-1, -1), 4),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
                ]))
                
                elements.append(container_table)
                elements.append(Spacer(1, 0.5*cm))
                
            # Cooler size
            if packing.get('cooler_size'):
                elements.append(Paragraph(
                    f"Doporučená velikost chladicího boxu: {packing['cooler_size']} litrů",
                    self.styles['BodyText']
                ))
                
        return elements
        
    def _translate_meal_type(self, meal_type: str) -> str:
        """Translate meal type to Czech."""
        translations = {
            'breakfast': 'Snídaně',
            'morning_snack': 'Dopolední svačina',
            'lunch': 'Oběd',
            'afternoon_snack': 'Odpolední svačina',
            'dinner': 'Večeře',
            'evening_snack': 'Večerní svačina'
        }
        return translations.get(meal_type, meal_type.title())
        
    def _estimate_recipe_pages(self, trip_data: Dict[str, Any]) -> int:
        """Estimate number of pages for recipe section."""
        unique_recipes = len(set(
            meal['recipe_id'] 
            for day in trip_data['days'] 
            for meal in day.get('meals', [])
            if meal.get('recipe_id')
        ))
        
        # Assume average 1 page per recipe in normal mode, 0.5 in compact
        if self.options.get('compact', False):
            return max(1, unique_recipes // 2)
        return unique_recipes