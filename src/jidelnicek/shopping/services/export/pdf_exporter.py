"""
PDF exporter for shopping lists.
"""

import io
from typing import Dict, Any, Optional, Tuple
from datetime import datetime

try:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import letter, A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch
    from reportlab.platypus import (
        SimpleDocTemplate, Table, TableStyle, Paragraph,
        Spacer, PageBreak, KeepTogether
    )
    from reportlab.lib.enums import TA_CENTER, TA_RIGHT
    REPORTLAB_AVAILABLE = True
except ImportError:
    REPORTLAB_AVAILABLE = False
    # Define dummy values for type hints
    colors = Any
    letter = A4 = (612, 792)  # Default page size
    inch = 72  # Points per inch

from .base import ShoppingListExporter
from jidelnicek.shopping.services.shopping_list_generator import ShoppingList


class PDFExporter(ShoppingListExporter):
    """
    Export shopping lists as PDF files.
    
    Creates professional PDFs with:
    - Formatted layout with headers and footers
    - Checkboxes for items
    - Color coding by category
    - Page breaks between sections
    - Summary statistics
    """
    
    def __init__(self, options: Optional[Dict[str, Any]] = None):
        """Initialize PDF exporter."""
        super().__init__(options)
        
        if not REPORTLAB_AVAILABLE:
            raise ImportError(
                "reportlab is required for PDF export. "
                "Install with: pip install reportlab"
            )
            
        # Define styles
        self.styles = getSampleStyleSheet()
        self._setup_custom_styles()
        
        # Category colors
        self.category_colors = {
            'Produce': colors.lightgreen,
            'Dairy': colors.lightblue,
            'Meat & Seafood': colors.lightsalmon,
            'Bakery': colors.wheat,
            'Frozen': colors.lavender,
            'Canned & Packaged': colors.gold,
            'Beverages': colors.lightcyan,
            'Other': colors.lightgrey
        }
        
    def get_file_extension(self) -> str:
        """Return .pdf extension."""
        return '.pdf'
        
    def get_mime_type(self) -> str:
        """Return application/pdf MIME type."""
        return 'application/pdf'
        
    def export(self, shopping_list: ShoppingList) -> bytes:
        """
        Export shopping list to PDF format.
        
        Options:
            page_size: 'letter' or 'A4'
            include_checkboxes: Add checkboxes to items
            color_by_category: Color code by category
            compact: Use compact layout
            include_summary: Add summary page
            
        Returns:
            PDF file bytes
        """
        # Create PDF buffer
        buffer = io.BytesIO()
        
        # Page setup
        page_size = A4 if self.options.get('page_size', 'A4') == 'A4' else letter
        
        # Create document
        doc = SimpleDocTemplate(
            buffer,
            pagesize=page_size,
            rightMargin=0.5*inch,
            leftMargin=0.5*inch,
            topMargin=0.75*inch,
            bottomMargin=0.5*inch
        )
        
        # Build content
        story = []
        
        # Title page
        story.extend(self._create_title_page(shopping_list))
        
        # Shopping list sections
        for i, section in enumerate(shopping_list.sections):
            # Page break between sections if not compact
            if i > 0 and not self.options.get('compact', False):
                story.append(PageBreak())
                
            section_elements = self._create_section(section)
            
            # Keep section together if possible
            if len(section_elements) < 20:  # Rough estimate
                story.append(KeepTogether(section_elements))
            else:
                story.extend(section_elements)
                
        # Summary page if requested
        if self.options.get('include_summary', True):
            story.append(PageBreak())
            story.extend(self._create_summary_page(shopping_list))
            
        # Build PDF
        doc.build(story)
        
        # Get bytes
        buffer.seek(0)
        return buffer.read()
        
    def _setup_custom_styles(self):
        """Set up custom paragraph styles."""
        # Title style
        self.styles.add(ParagraphStyle(
            name='CustomTitle',
            parent=self.styles['Title'],
            fontSize=24,
            textColor=colors.HexColor('#2C3E50'),
            spaceAfter=12,
            alignment=TA_CENTER
        ))
        
        # Section header style
        self.styles.add(ParagraphStyle(
            name='SectionHeader',
            parent=self.styles['Heading1'],
            fontSize=16,
            textColor=colors.HexColor('#34495E'),
            spaceAfter=6
        ))
        
        # Metadata style
        self.styles.add(ParagraphStyle(
            name='Metadata',
            parent=self.styles['Normal'],
            fontSize=10,
            textColor=colors.grey,
            alignment=TA_CENTER
        ))
        
    def _create_title_page(self, shopping_list: ShoppingList) -> list:
        """Create title page elements."""
        elements = []
        
        # Title
        elements.append(Paragraph("Shopping List", self.styles['CustomTitle']))
        elements.append(Spacer(1, 0.2*inch))
        
        # Metadata
        metadata_text = f"""
        Generated: {datetime.now().strftime('%B %d, %Y at %I:%M %p')}<br/>
        Total Items: {shopping_list.total_items}<br/>
        Format: {shopping_list.format.value.replace('_', ' ').title()}
        """
        elements.append(Paragraph(metadata_text, self.styles['Metadata']))
        
        elements.append(Spacer(1, 0.5*inch))
        
        # Quick stats table
        if shopping_list.total_weight_g > 0 or shopping_list.total_volume_ml > 0:
            stats_data = []
            
            if shopping_list.total_weight_g > 0:
                weight_kg = shopping_list.total_weight_g / 1000
                stats_data.append(['Total Weight:', f'{weight_kg:.1f} kg'])
                
            if shopping_list.total_volume_ml > 0:
                volume_l = shopping_list.total_volume_ml / 1000
                stats_data.append(['Total Volume:', f'{volume_l:.1f} L'])
                
            stats_table = Table(stats_data, colWidths=[2*inch, 2*inch])
            stats_table.setStyle(TableStyle([
                ('ALIGN', (0, 0), (0, -1), 'RIGHT'),
                ('ALIGN', (1, 0), (1, -1), 'LEFT'),
                ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
                ('FONTSIZE', (0, 0), (-1, -1), 12),
                ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#2C3E50'))
            ]))
            
            elements.append(stats_table)
            
        return elements
        
    def _create_section(self, section) -> list:
        """Create elements for a shopping list section."""
        elements = []
        
        # Section header
        elements.append(Paragraph(section.title, self.styles['SectionHeader']))
        elements.append(Spacer(1, 0.1*inch))
        
        # Items table
        table_data = []
        
        # Table headers if not compact
        if not self.options.get('compact', False):
            headers = ['✓', 'Item', 'Quantity', 'Notes']
            table_data.append(headers)
            
        # Add items
        for item in section.items:
            row = self._create_item_row(item)
            table_data.append(row)
            
        # Create table
        col_widths = self._get_column_widths()
        table = Table(table_data, colWidths=col_widths)
        
        # Apply table style
        table_style = self._get_table_style(section, len(table_data))
        table.setStyle(table_style)
        
        elements.append(table)
        elements.append(Spacer(1, 0.2*inch))
        
        return elements
        
    def _create_item_row(self, item) -> list:
        """Create a table row for an item."""
        row = []
        
        # Checkbox
        if self.options.get('include_checkboxes', True):
            row.append('☐')
        else:
            row.append('')
            
        # Item name
        row.append(item.name)
        
        # Quantity
        row.append(item.display_text)
        
        # Notes (package suggestion or sources)
        notes = []
        if item.package_suggestion:
            notes.append(item.package_suggestion)
            
        if self.options.get('include_sources', False) and item.sources:
            source_text = f"({', '.join(s['recipe'] for s in item.sources[:2])})"
            notes.append(source_text)
            
        row.append(' '.join(notes))
        
        return row
        
    def _get_column_widths(self) -> list:
        """Get column widths based on page size and options."""
        # Total width available (accounting for margins)
        page_width = 7.5 * inch  # A4 width minus margins
        
        if self.options.get('compact', False):
            # Compact: checkbox, item, quantity
            return [0.4*inch, 4.5*inch, 2.6*inch]
        else:
            # Full: checkbox, item, quantity, notes
            return [0.4*inch, 3.5*inch, 1.5*inch, 2.1*inch]
            
    def _get_table_style(self, section, row_count: int):
        """Get table style for a section."""
        style_commands = [
            # Headers
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('ALIGN', (0, 0), (0, -1), 'CENTER'),  # Checkbox column
            
            # Data rows
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 9),
            ('ALIGN', (2, 1), (2, -1), 'RIGHT'),  # Quantity column
            
            # Grid
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            
            # Padding
            ('LEFTPADDING', (0, 0), (-1, -1), 3),
            ('RIGHTPADDING', (0, 0), (-1, -1), 3),
            ('TOPPADDING', (0, 0), (-1, -1), 2),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ]
        
        # Color by category if requested
        if self.options.get('color_by_category', True):
            # Get first item's category for section color
            if section.items:
                category = section.items[0].category.value
                color = self.category_colors.get(category, colors.white)
                
                # Apply subtle background color to data rows
                style_commands.append(
                    ('BACKGROUND', (1, 1), (-1, -1), color)
                )
                
        return TableStyle(style_commands)
        
    def _create_summary_page(self, shopping_list: ShoppingList) -> list:
        """Create summary page elements."""
        elements = []
        
        # Title
        elements.append(Paragraph("Shopping List Summary", self.styles['SectionHeader']))
        elements.append(Spacer(1, 0.2*inch))
        
        # Storage requirements
        if shopping_list.storage_summary:
            elements.append(Paragraph("Storage Requirements:", self.styles['Heading2']))
            
            storage_data = []
            for storage_type, count in shopping_list.storage_summary.items():
                storage_data.append([storage_type.value, f"{count} items"])
                
            storage_table = Table(storage_data, colWidths=[3*inch, 2*inch])
            storage_table.setStyle(TableStyle([
                ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
                ('FONTSIZE', (0, 0), (-1, -1), 10),
                ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.grey)
            ]))
            
            elements.append(storage_table)
            elements.append(Spacer(1, 0.3*inch))
            
        # Notes section
        elements.append(Paragraph("Notes:", self.styles['Heading2']))
        elements.append(Spacer(1, 0.1*inch))
        
        # Lines for notes
        for _ in range(10):
            elements.append(Paragraph("_" * 70, self.styles['Normal']))
            elements.append(Spacer(1, 0.2*inch))
            
        return elements