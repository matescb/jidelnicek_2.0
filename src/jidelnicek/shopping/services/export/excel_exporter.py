"""
Excel exporter for shopping lists.
"""

import io
from typing import Dict, Any, Optional
from datetime import datetime

try:
    import openpyxl
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    from openpyxl.utils import get_column_letter
    OPENPYXL_AVAILABLE = True
except ImportError:
    OPENPYXL_AVAILABLE = False
    # Define dummy types for type hints
    Workbook = Any

from .base import ShoppingListExporter
from jidelnicek.shopping.services.shopping_list_generator import ShoppingList


class ExcelExporter(ShoppingListExporter):
    """
    Export shopping lists as Excel files.
    
    Creates formatted spreadsheets with:
    - Multiple worksheets for different views
    - Formulas for quantity calculations
    - Color coding by category
    - Checkboxes for items
    - Summary statistics
    """
    
    def __init__(self, options: Optional[Dict[str, Any]] = None):
        """Initialize Excel exporter."""
        super().__init__(options)
        
        if not OPENPYXL_AVAILABLE:
            raise ImportError(
                "openpyxl is required for Excel export. "
                "Install with: pip install openpyxl"
            )
            
        # Define category colors
        self.category_colors = {
            'Produce': 'C7E9B4',
            'Dairy': 'B4D4E9',
            'Meat & Seafood': 'FFB4B4',
            'Bakery': 'FFE4B4',
            'Frozen': 'E4B4FF',
            'Canned & Packaged': 'FFD700',
            'Beverages': 'B4FFE4',
            'Other': 'E0E0E0'
        }
        
    def get_file_extension(self) -> str:
        """Return .xlsx extension."""
        return '.xlsx'
        
    def get_mime_type(self) -> str:
        """Return Excel MIME type."""
        return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        
    def export(self, shopping_list: ShoppingList) -> bytes:
        """
        Export shopping list to Excel format.
        
        Options:
            include_summary: Add summary worksheet
            include_checkboxes: Add checkboxes to items
            color_by_category: Color code by category
            include_formulas: Add calculation formulas
            
        Returns:
            Excel file bytes
        """
        # Create workbook
        wb = Workbook()
        
        # Remove default sheet
        wb.remove(wb.active)
        
        # Create worksheets
        self._create_main_sheet(wb, shopping_list)
        
        if self.options.get('include_summary', True):
            self._create_summary_sheet(wb, shopping_list)
            
        if self.options.get('by_storage', False):
            self._create_storage_sheet(wb, shopping_list)
            
        # Save to bytes
        output = io.BytesIO()
        wb.save(output)
        output.seek(0)
        
        return output.read()
        
    def _create_main_sheet(self, wb: Workbook, shopping_list: ShoppingList):
        """Create main shopping list worksheet."""
        ws = wb.create_sheet("Shopping List")
        
        # Header style
        header_font = Font(bold=True, size=12)
        header_fill = PatternFill(start_color="366092", end_color="366092", fill_type="solid")
        header_alignment = Alignment(horizontal="center", vertical="center")
        
        # Add title
        ws.merge_cells('A1:H1')
        ws['A1'] = "SHOPPING LIST"
        ws['A1'].font = Font(bold=True, size=16)
        ws['A1'].alignment = Alignment(horizontal="center")
        
        # Add metadata
        ws['A2'] = f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}"
        ws['A3'] = f"Total Items: {shopping_list.total_items}"
        
        # Column headers
        headers = ['✓', 'Item', 'Quantity', 'Unit', 'Category', 'Storage', 'Aisle', 'Notes']
        for col, header in enumerate(headers, 1):
            cell = ws.cell(row=5, column=col, value=header)
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = header_alignment
            
        # Add items
        row = 6
        for section in shopping_list.sections:
            # Section header
            ws.merge_cells(f'A{row}:H{row}')
            cell = ws[f'A{row}']
            cell.value = section.title
            cell.font = Font(bold=True, size=11)
            cell.fill = PatternFill(start_color="D0D0D0", end_color="D0D0D0", fill_type="solid")
            row += 1
            
            # Items in section
            for item in section.items:
                # Checkbox column
                if self.options.get('include_checkboxes', True):
                    ws.cell(row=row, column=1, value='☐')
                    
                # Item data
                ws.cell(row=row, column=2, value=item.name)
                ws.cell(row=row, column=3, value=float(item.rounded_quantity))
                ws.cell(row=row, column=4, value=item.unit)
                ws.cell(row=row, column=5, value=item.category.value)
                ws.cell(row=row, column=6, value=item.storage_type.value)
                ws.cell(row=row, column=7, value=item.aisle_number or '')
                ws.cell(row=row, column=8, value=item.package_suggestion or '')
                
                # Color by category if requested
                if self.options.get('color_by_category', True):
                    color = self.category_colors.get(item.category.value, 'FFFFFF')
                    fill = PatternFill(start_color=color, end_color=color, fill_type="solid")
                    for col in range(2, 9):
                        ws.cell(row=row, column=col).fill = fill
                        
                row += 1
                
            # Empty row between sections
            row += 1
            
        # Auto-size columns
        for column in ws.columns:
            max_length = 0
            column_letter = get_column_letter(column[0].column)
            
            for cell in column:
                try:
                    if len(str(cell.value)) > max_length:
                        max_length = len(str(cell.value))
                except:
                    pass
                    
            adjusted_width = min(max_length + 2, 40)
            ws.column_dimensions[column_letter].width = adjusted_width
            
        # Add borders
        thin_border = Border(
            left=Side(style='thin'),
            right=Side(style='thin'),
            top=Side(style='thin'),
            bottom=Side(style='thin')
        )
        
        for row in ws.iter_rows(min_row=5):
            for cell in row:
                if cell.value is not None:
                    cell.border = thin_border
                    
    def _create_summary_sheet(self, wb: Workbook, shopping_list: ShoppingList):
        """Create summary statistics worksheet."""
        ws = wb.create_sheet("Summary")
        
        # Title
        ws['A1'] = "SHOPPING LIST SUMMARY"
        ws['A1'].font = Font(bold=True, size=14)
        
        # Basic stats
        ws['A3'] = "Total Items:"
        ws['B3'] = shopping_list.total_items
        
        ws['A4'] = "Total Weight (kg):"
        ws['B4'] = round(shopping_list.total_weight_g / 1000, 2) if shopping_list.total_weight_g > 0 else 0
        
        ws['A5'] = "Total Volume (L):"
        ws['B5'] = round(shopping_list.total_volume_ml / 1000, 2) if shopping_list.total_volume_ml > 0 else 0
        
        # Category breakdown
        ws['A7'] = "Items by Category:"
        ws['A7'].font = Font(bold=True)
        
        row = 8
        category_counts = {}
        for section in shopping_list.sections:
            for item in section.items:
                category = item.category.value
                category_counts[category] = category_counts.get(category, 0) + 1
                
        for category, count in sorted(category_counts.items()):
            ws[f'A{row}'] = category
            ws[f'B{row}'] = count
            
            # Add percentage formula
            ws[f'C{row}'] = f'=B{row}/$B$3'
            ws[f'C{row}'].number_format = '0.0%'
            
            row += 1
            
        # Storage breakdown
        row += 2
        ws[f'A{row}'] = "Storage Requirements:"
        ws[f'A{row}'].font = Font(bold=True)
        row += 1
        
        for storage_type, count in shopping_list.storage_summary.items():
            ws[f'A{row}'] = storage_type.value
            ws[f'B{row}'] = count
            row += 1
            
        # Format columns
        ws.column_dimensions['A'].width = 20
        ws.column_dimensions['B'].width = 12
        ws.column_dimensions['C'].width = 10
        
    def _create_storage_sheet(self, wb: Workbook, shopping_list: ShoppingList):
        """Create worksheet organized by storage type."""
        ws = wb.create_sheet("By Storage")
        
        # Reorganize items by storage
        storage_items = {}
        for section in shopping_list.sections:
            for item in section.items:
                storage = item.storage_type.value
                if storage not in storage_items:
                    storage_items[storage] = []
                storage_items[storage].append(item)
                
        # Create sections
        row = 1
        for storage_type in ['Frozen', 'Refrigerated', 'Produce', 'Cool & Dry', 'Room Temperature']:
            if storage_type in storage_items:
                # Storage header
                ws.merge_cells(f'A{row}:E{row}')
                cell = ws[f'A{row}']
                cell.value = f"{storage_type.upper()} ITEMS"
                cell.font = Font(bold=True, size=12)
                cell.fill = PatternFill(start_color="808080", end_color="808080", fill_type="solid")
                row += 1
                
                # Items
                for item in storage_items[storage_type]:
                    ws[f'A{row}'] = '☐'
                    ws[f'B{row}'] = item.name
                    ws[f'C{row}'] = float(item.rounded_quantity)
                    ws[f'D{row}'] = item.unit
                    ws[f'E{row}'] = item.category.value
                    row += 1
                    
                # Empty row
                row += 1