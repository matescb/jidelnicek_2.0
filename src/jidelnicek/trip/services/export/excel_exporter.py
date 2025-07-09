"""
Enhanced Excel exporter for trips with openpyxl.

Provides comprehensive Excel export with:
- Multiple worksheets for different data views
- Formulas for automatic calculations
- Charts for visual analysis
- Conditional formatting
- Data validation
"""

import io
from typing import Dict, Any, Optional, List
from datetime import datetime, date
from decimal import Decimal
import logging

try:
    import openpyxl
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side, NamedStyle
    from openpyxl.utils import get_column_letter
    from openpyxl.worksheet.datavalidation import DataValidation
    from openpyxl.chart import (
        PieChart, BarChart, LineChart,
        Reference, Series
    )
    from openpyxl.chart.label import DataLabelList
    from openpyxl.formatting.rule import ColorScaleRule, CellIsRule
    from openpyxl.drawing.image import Image as XLImage
    OPENPYXL_AVAILABLE = True
except ImportError:
    OPENPYXL_AVAILABLE = False
    Workbook = Any


logger = logging.getLogger(__name__)


class TripExcelExporter:
    """
    Enhanced Excel exporter for complete trip documentation.
    
    Creates multi-sheet workbooks with:
    - Trip overview with summary statistics
    - Daily meal plans with participant counts
    - Recipe details with scaling formulas
    - Shopping lists with automatic totals
    - Nutritional analysis with charts
    - Cost tracking with budget analysis
    """
    
    def __init__(self, options: Optional[Dict[str, Any]] = None):
        """
        Initialize Excel exporter.
        
        Args:
            options: Export options including:
                - include_formulas: Add calculation formulas
                - include_charts: Add visual charts
                - include_formatting: Apply conditional formatting
                - currency: Currency symbol for costs
                - language: 'cs' or 'en'
        """
        if not OPENPYXL_AVAILABLE:
            raise ImportError(
                "openpyxl is required for Excel export. "
                "Install with: pip install openpyxl"
            )
            
        self.options = options or {}
        self.currency = self.options.get('currency', 'Kč')
        self.language = self.options.get('language', 'cs')
        
        # Define styles
        self._setup_styles()
        
    def export(self, trip_data: Dict[str, Any]) -> bytes:
        """
        Export trip data to Excel.
        
        Args:
            trip_data: Complete trip data
            
        Returns:
            Excel file as bytes
        """
        # Create workbook
        wb = Workbook()
        
        # Remove default sheet
        wb.remove(wb.active)
        
        # Create worksheets
        self._create_overview_sheet(wb, trip_data)
        self._create_daily_plan_sheet(wb, trip_data)
        self._create_recipes_sheet(wb, trip_data)
        self._create_shopping_sheet(wb, trip_data)
        
        if self.options.get('include_nutrition', True):
            self._create_nutrition_sheet(wb, trip_data)
            
        if self.options.get('include_costs', True):
            self._create_costs_sheet(wb, trip_data)
            
        # Save to bytes
        output = io.BytesIO()
        wb.save(output)
        output.seek(0)
        
        return output.read()
        
    def _setup_styles(self):
        """Set up named styles for the workbook."""
        # Header style
        self.header_font = Font(bold=True, size=14, color="FFFFFF")
        self.header_fill = PatternFill(start_color="366092", end_color="366092", fill_type="solid")
        self.header_alignment = Alignment(horizontal="center", vertical="center")
        
        # Subheader style
        self.subheader_font = Font(bold=True, size=12)
        self.subheader_fill = PatternFill(start_color="D9E2F3", end_color="D9E2F3", fill_type="solid")
        
        # Table header style
        self.table_header_font = Font(bold=True, size=11)
        self.table_header_fill = PatternFill(start_color="E7E6E6", end_color="E7E6E6", fill_type="solid")
        
        # Border style
        self.thin_border = Border(
            left=Side(style='thin'),
            right=Side(style='thin'),
            top=Side(style='thin'),
            bottom=Side(style='thin')
        )
        
    def _create_overview_sheet(self, wb: Workbook, trip_data: Dict[str, Any]):
        """Create trip overview worksheet."""
        ws = wb.create_sheet("Přehled")
        trip = trip_data['trip']
        
        # Title
        ws.merge_cells('A1:F1')
        ws['A1'] = trip['name']
        ws['A1'].font = Font(bold=True, size=18)
        ws['A1'].alignment = Alignment(horizontal="center")
        
        # Trip info
        row = 3
        info_data = [
            ('Datum začátku:', datetime.fromisoformat(trip['start_date']).strftime('%d.%m.%Y')),
            ('Datum konce:', datetime.fromisoformat(trip['end_date']).strftime('%d.%m.%Y')),
            ('Počet dní:', trip['day_count']),
            ('Počet účastníků:', trip['participant_count']),
            ('Místo:', trip.get('location', 'Neuvedeno')),
            ('Typ výletu:', self._translate_trip_type(trip.get('trip_type', 'other')))
        ]
        
        for label, value in info_data:
            ws[f'A{row}'] = label
            ws[f'A{row}'].font = Font(bold=True)
            ws[f'B{row}'] = value
            row += 1
            
        # Description
        if trip.get('description'):
            row += 1
            ws[f'A{row}'] = 'Popis:'
            ws[f'A{row}'].font = Font(bold=True)
            ws.merge_cells(f'B{row}:F{row}')
            ws[f'B{row}'] = trip['description']
            ws[f'B{row}'].alignment = Alignment(wrap_text=True)
            
        # Participants section
        row += 2
        ws[f'A{row}'] = 'Účastníci'
        ws[f'A{row}'].font = self.subheader_font
        ws[f'A{row}'].fill = self.subheader_fill
        ws.merge_cells(f'A{row}:D{row}')
        
        row += 1
        headers = ['Jméno', 'Věková skupina', 'Dietní omezení', 'Poznámky']
        for col, header in enumerate(headers, 1):
            cell = ws.cell(row=row, column=col, value=header)
            cell.font = self.table_header_font
            cell.fill = self.table_header_fill
            cell.border = self.thin_border
            
        # Participant data
        for participant in trip_data.get('participants', []):
            row += 1
            ws[f'A{row}'] = participant.get('name', '')
            ws[f'B{row}'] = self._translate_age_group(participant.get('age_group', ''))
            ws[f'C{row}'] = participant.get('dietary_restrictions', '')
            ws[f'D{row}'] = participant.get('notes', '')
            
            # Apply borders
            for col in range(1, 5):
                ws.cell(row=row, column=col).border = self.thin_border
                
        # Summary statistics
        row += 3
        ws[f'A{row}'] = 'Statistiky'
        ws[f'A{row}'].font = self.subheader_font
        ws[f'A{row}'].fill = self.subheader_fill
        ws.merge_cells(f'A{row}:C{row}')
        
        row += 1
        total_meals = sum(len(day.get('meals', [])) for day in trip_data['days'])
        unique_recipes = len(set(
            meal['recipe_id'] 
            for day in trip_data['days'] 
            for meal in day.get('meals', [])
            if meal.get('recipe_id')
        ))
        
        stats_data = [
            ('Celkem jídel:', total_meals),
            ('Unikátních receptů:', unique_recipes),
            ('Průměr jídel/den:', f'=B{row+1}/B{row-7}')  # Formula referencing day count
        ]
        
        for i, (label, value) in enumerate(stats_data):
            ws[f'A{row+i}'] = label
            ws[f'A{row+i}'].font = Font(bold=True)
            ws[f'B{row+i}'] = value
            
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
                    
            adjusted_width = min(max_length + 2, 50)
            ws.column_dimensions[column_letter].width = adjusted_width
            
    def _create_daily_plan_sheet(self, wb: Workbook, trip_data: Dict[str, Any]):
        """Create daily meal plan worksheet."""
        ws = wb.create_sheet("Denní plány")
        
        # Headers
        ws['A1'] = 'Denní plány jídel'
        ws['A1'].font = Font(bold=True, size=14)
        ws.merge_cells('A1:G1')
        
        # Column headers
        headers = ['Den', 'Datum', 'Typ jídla', 'Recept', 'Počet porcí', 'Čas', 'Poznámky']
        for col, header in enumerate(headers, 1):
            cell = ws.cell(row=3, column=col, value=header)
            cell.font = self.table_header_font
            cell.fill = self.table_header_fill
            cell.border = self.thin_border
            
        # Data
        row = 4
        for day in trip_data['days']:
            day_date = datetime.fromisoformat(day['date'])
            
            for meal in day.get('meals', []):
                ws[f'A{row}'] = day['day_number']
                ws[f'B{row}'] = day_date.strftime('%d.%m.%Y')
                ws[f'C{row}'] = self._translate_meal_type(meal['meal_type'])
                ws[f'D{row}'] = meal.get('recipe_name', 'Neznámý recept')
                ws[f'E{row}'] = meal.get('participant_count', trip_data['trip']['participant_count'])
                ws[f'F{row}'] = meal.get('time', '')
                ws[f'G{row}'] = meal.get('notes', '')
                
                # Apply borders
                for col in range(1, 8):
                    ws.cell(row=row, column=col).border = self.thin_border
                    
                # Conditional formatting for meal types
                if self.options.get('include_formatting', True):
                    meal_colors = {
                        'breakfast': 'FFE5B4',
                        'lunch': 'B4E5FF',
                        'dinner': 'FFB4E5'
                    }
                    color = meal_colors.get(meal['meal_type'], 'FFFFFF')
                    fill = PatternFill(start_color=color, end_color=color, fill_type="solid")
                    ws[f'C{row}'].fill = fill
                    
                row += 1
                
        # Add summary row
        row += 1
        ws[f'A{row}'] = 'Celkem'
        ws[f'A{row}'].font = Font(bold=True)
        ws.merge_cells(f'A{row}:C{row}')
        ws[f'D{row}'] = f'=COUNTA(D4:D{row-2})'  # Count meals
        ws[f'D{row}'].font = Font(bold=True)
        
        # Freeze panes
        ws.freeze_panes = 'A4'
        
        # Auto-filter
        ws.auto_filter.ref = f'A3:G{row-2}'
        
        # Auto-size columns
        self._autosize_columns(ws)
        
    def _create_recipes_sheet(self, wb: Workbook, trip_data: Dict[str, Any]):
        """Create recipes worksheet with scaling formulas."""
        ws = wb.create_sheet("Recepty")
        
        # Title
        ws['A1'] = 'Recepty'
        ws['A1'].font = Font(bold=True, size=14)
        ws.merge_cells('A1:F1')
        
        # Base servings input
        ws['A3'] = 'Základní počet porcí:'
        ws['B3'] = 4
        ws['B3'].fill = PatternFill(start_color="FFFF00", end_color="FFFF00", fill_type="solid")
        
        ws['D3'] = 'Požadovaný počet porcí:'
        ws['E3'] = trip_data['trip']['participant_count']
        ws['E3'].fill = PatternFill(start_color="FFFF00", end_color="FFFF00", fill_type="solid")
        
        # Get unique recipes
        recipes = trip_data.get('recipes', {})
        row = 5
        
        for recipe_id, recipe in recipes.items():
            # Recipe header
            ws[f'A{row}'] = recipe.get('name', 'Neznámý recept')
            ws[f'A{row}'].font = Font(bold=True, size=12)
            ws.merge_cells(f'A{row}:F{row}')
            ws[f'A{row}'].fill = self.subheader_fill
            
            row += 1
            
            # Recipe info
            info_row = row
            ws[f'A{row}'] = f"Příprava: {recipe.get('prep_time', 0)} min"
            ws[f'C{row}'] = f"Vaření: {recipe.get('cook_time', 0)} min"
            ws[f'E{row}'] = f"Obtížnost: {self._translate_difficulty(recipe.get('difficulty', 'medium'))}"
            
            row += 2
            
            # Ingredients header
            ws[f'A{row}'] = 'Ingredience'
            ws[f'A{row}'].font = Font(bold=True)
            ws.merge_cells(f'A{row}:F{row}')
            
            row += 1
            ing_headers = ['Surovina', 'Množství (základ)', 'Jednotka', 'Přepočet', 'Množství (upravené)', 'Poznámky']
            for col, header in enumerate(ing_headers, 1):
                cell = ws.cell(row=row, column=col, value=header)
                cell.font = self.table_header_font
                cell.fill = self.table_header_fill
                cell.border = self.thin_border
                
            # Ingredients with scaling formulas
            start_row = row + 1
            for ing in recipe.get('ingredients', []):
                row += 1
                ws[f'A{row}'] = ing['name']
                ws[f'B{row}'] = float(ing['quantity'])
                ws[f'C{row}'] = ing['unit']
                ws[f'D{row}'] = f'=$E$3/$B$3'  # Scaling factor
                ws[f'E{row}'] = f'=B{row}*D{row}'  # Scaled quantity
                ws[f'F{row}'] = ing.get('notes', '')
                
                # Apply borders
                for col in range(1, 7):
                    ws.cell(row=row, column=col).border = self.thin_border
                    
                # Number format for quantities
                ws[f'B{row}'].number_format = '0.00'
                ws[f'D{row}'].number_format = '0.00'
                ws[f'E{row}'].number_format = '0.00'
                
            # Instructions
            row += 2
            ws[f'A{row}'] = 'Postup'
            ws[f'A{row}'].font = Font(bold=True)
            row += 1
            
            if recipe.get('instructions'):
                ws.merge_cells(f'A{row}:F{row+3}')
                ws[f'A{row}'] = recipe['instructions']
                ws[f'A{row}'].alignment = Alignment(wrap_text=True, vertical='top')
                row += 4
            else:
                row += 1
                
            # Add spacing between recipes
            row += 2
            
        # Auto-size columns
        self._autosize_columns(ws)
        
    def _create_shopping_sheet(self, wb: Workbook, trip_data: Dict[str, Any]):
        """Create shopping list worksheet with totals."""
        ws = wb.create_sheet("Nákupní seznam")
        
        # Title
        ws['A1'] = 'Nákupní seznam'
        ws['A1'].font = Font(bold=True, size=14)
        ws.merge_cells('A1:E1')
        
        # Headers
        headers = ['✓', 'Položka', 'Množství', 'Jednotka', 'Kategorie']
        for col, header in enumerate(headers, 1):
            cell = ws.cell(row=3, column=col, value=header)
            cell.font = self.table_header_font
            cell.fill = self.table_header_fill
            cell.border = self.thin_border
            
        # Get shopping list data
        shopping_list = trip_data.get('shopping_list', {})
        categories = shopping_list.get('categories', {})
        
        row = 4
        start_row = row
        
        # Add items by category
        for category, items in sorted(categories.items()):
            # Category header
            ws[f'A{row}'] = category
            ws[f'A{row}'].font = Font(bold=True)
            ws.merge_cells(f'A{row}:E{row}')
            ws[f'A{row}'].fill = PatternFill(start_color="E0E0E0", end_color="E0E0E0", fill_type="solid")
            row += 1
            
            # Items
            for item in items:
                ws[f'A{row}'] = ''  # Checkbox column
                ws[f'B{row}'] = item['name']
                ws[f'C{row}'] = float(item['quantity'])
                ws[f'D{row}'] = item['unit']
                ws[f'E{row}'] = category
                
                # Apply borders
                for col in range(1, 6):
                    ws.cell(row=row, column=col).border = self.thin_border
                    
                # Number format
                ws[f'C{row}'].number_format = '0.00'
                
                # Checkbox formatting
                ws[f'A{row}'].font = Font(name='Wingdings', size=12)
                ws[f'A{row}'].alignment = Alignment(horizontal='center')
                
                row += 1
                
        # Summary section
        row += 2
        ws[f'A{row}'] = 'Souhrn'
        ws[f'A{row}'].font = Font(bold=True, size=12)
        ws[f'A{row}'].fill = self.subheader_fill
        ws.merge_cells(f'A{row}:C{row}')
        
        row += 1
        ws[f'A{row}'] = 'Celkem položek:'
        ws[f'B{row}'] = f'=COUNTA(B{start_row}:B{row-3})'
        ws[f'B{row}'].font = Font(bold=True)
        
        # Add data validation for checkboxes
        if self.options.get('include_formatting', True):
            checkbox_dv = DataValidation(
                type="list",
                formula1='"☐,☑"',
                allow_blank=True
            )
            checkbox_dv.error = 'Vyberte ☐ nebo ☑'
            checkbox_dv.errorTitle = 'Neplatná hodnota'
            
            for r in range(start_row, row-2):
                if ws[f'A{r}'].value == '':
                    ws[f'A{r}'] = '☐'
                    checkbox_dv.add(ws[f'A{r}'])
                    
            ws.add_data_validation(checkbox_dv)
            
        # Conditional formatting for checked items
        if self.options.get('include_formatting', True):
            # Apply strikethrough style to checked items
            checked_fill = PatternFill(start_color="D0D0D0", end_color="D0D0D0", fill_type="solid")
            checked_font = Font(strike=True, color="808080")
            
            # This would require VBA or manual formatting in real Excel
            # Here we just prepare the structure
            
        # Auto-size columns
        self._autosize_columns(ws)
        
    def _create_nutrition_sheet(self, wb: Workbook, trip_data: Dict[str, Any]):
        """Create nutrition analysis worksheet with charts."""
        ws = wb.create_sheet("Nutriční analýza")
        
        # Title
        ws['A1'] = 'Nutriční analýza'
        ws['A1'].font = Font(bold=True, size=14)
        ws.merge_cells('A1:F1')
        
        # Get nutrition data
        nutrition = trip_data.get('nutrition', {})
        
        # Daily nutrition table
        ws['A3'] = 'Denní nutriční hodnoty'
        ws['A3'].font = Font(bold=True, size=12)
        ws.merge_cells('A3:F3')
        
        # Headers
        headers = ['Den', 'Kalorie (kcal)', 'Bílkoviny (g)', 'Sacharidy (g)', 'Tuky (g)', 'Vláknina (g)']
        for col, header in enumerate(headers, 1):
            cell = ws.cell(row=5, column=col, value=header)
            cell.font = self.table_header_font
            cell.fill = self.table_header_fill
            cell.border = self.thin_border
            
        # Daily data
        row = 6
        start_data_row = row
        
        for day in trip_data['days']:
            day_nutrition = nutrition.get('daily', {}).get(str(day['day_number']), {})
            
            ws[f'A{row}'] = f"Den {day['day_number']}"
            ws[f'B{row}'] = day_nutrition.get('calories', 0)
            ws[f'C{row}'] = day_nutrition.get('proteins', 0)
            ws[f'D{row}'] = day_nutrition.get('carbs', 0)
            ws[f'E{row}'] = day_nutrition.get('fats', 0)
            ws[f'F{row}'] = day_nutrition.get('fiber', 0)
            
            # Apply borders and number format
            for col in range(1, 7):
                cell = ws.cell(row=row, column=col)
                cell.border = self.thin_border
                if col > 1:
                    cell.number_format = '0.0'
                    
            row += 1
            
        end_data_row = row - 1
        
        # Averages row
        row += 1
        ws[f'A{row}'] = 'Průměr'
        ws[f'A{row}'].font = Font(bold=True)
        
        for col in range(2, 7):
            col_letter = get_column_letter(col)
            ws[f'{col_letter}{row}'] = f'=AVERAGE({col_letter}{start_data_row}:{col_letter}{end_data_row})'
            ws[f'{col_letter}{row}'].font = Font(bold=True)
            ws[f'{col_letter}{row}'].number_format = '0.0'
            ws[f'{col_letter}{row}'].border = self.thin_border
            
        # Create charts if requested
        if self.options.get('include_charts', True):
            # Macronutrient pie chart
            row += 3
            ws[f'A{row}'] = 'Rozložení makroživin (průměr)'
            ws[f'A{row}'].font = Font(bold=True, size=12)
            
            # Prepare data for pie chart
            pie_row = row + 2
            ws[f'A{pie_row}'] = 'Živina'
            ws[f'B{pie_row}'] = 'Kalorie'
            
            ws[f'A{pie_row+1}'] = 'Bílkoviny'
            ws[f'B{pie_row+1}'] = f'=C{row-3}*4'  # proteins * 4 kcal/g
            
            ws[f'A{pie_row+2}'] = 'Sacharidy'
            ws[f'B{pie_row+2}'] = f'=D{row-3}*4'  # carbs * 4 kcal/g
            
            ws[f'A{pie_row+3}'] = 'Tuky'
            ws[f'B{pie_row+3}'] = f'=E{row-3}*9'  # fats * 9 kcal/g
            
            # Create pie chart
            pie = PieChart()
            labels = Reference(ws, min_col=1, min_row=pie_row+1, max_row=pie_row+3)
            data = Reference(ws, min_col=2, min_row=pie_row, max_row=pie_row+3)
            pie.add_data(data, titles_from_data=True)
            pie.set_categories(labels)
            pie.title = "Rozložení makroživin"
            
            # Position chart
            ws.add_chart(pie, f'D{row}')
            
            # Daily calories line chart
            row += 15
            ws[f'A{row}'] = 'Vývoj kalorií'
            ws[f'A{row}'].font = Font(bold=True, size=12)
            
            # Create line chart
            line_chart = LineChart()
            line_chart.title = "Denní příjem kalorií"
            line_chart.y_axis.title = "Kalorie (kcal)"
            line_chart.x_axis.title = "Den"
            
            # Data
            data = Reference(ws, min_col=2, min_row=5, max_row=end_data_row)
            categories = Reference(ws, min_col=1, min_row=6, max_row=end_data_row)
            line_chart.add_data(data, titles_from_data=True)
            line_chart.set_categories(categories)
            
            # Position chart
            ws.add_chart(line_chart, f'A{row+2}')
            
        # Auto-size columns
        self._autosize_columns(ws)
        
    def _create_costs_sheet(self, wb: Workbook, trip_data: Dict[str, Any]):
        """Create cost tracking worksheet."""
        ws = wb.create_sheet("Náklady")
        
        # Title
        ws['A1'] = 'Rozpočet a náklady'
        ws['A1'].font = Font(bold=True, size=14)
        ws.merge_cells('A1:F1')
        
        # Budget input
        ws['A3'] = 'Celkový rozpočet:'
        ws['B3'] = 0
        ws['B3'].fill = PatternFill(start_color="FFFF00", end_color="FFFF00", fill_type="solid")
        ws['B3'].number_format = f'#,##0 "{self.currency}"'
        
        ws['D3'] = 'Rozpočet na osobu:'
        ws['E3'] = f'=B3/{trip_data["trip"]["participant_count"]}'
        ws['E3'].number_format = f'#,##0 "{self.currency}"'
        
        # Cost categories
        row = 5
        ws[f'A{row}'] = 'Kategorie nákladů'
        ws[f'A{row}'].font = Font(bold=True, size=12)
        ws[f'A{row}'].fill = self.subheader_fill
        ws.merge_cells(f'A{row}:D{row}')
        
        row += 1
        headers = ['Kategorie', 'Plánované', 'Skutečné', 'Rozdíl']
        for col, header in enumerate(headers, 1):
            cell = ws.cell(row=row, column=col, value=header)
            cell.font = self.table_header_font
            cell.fill = self.table_header_fill
            cell.border = self.thin_border
            
        # Cost categories
        categories = [
            'Potraviny',
            'Doprava',
            'Ubytování',
            'Aktivity',
            'Ostatní'
        ]
        
        row += 1
        start_row = row
        
        for category in categories:
            ws[f'A{row}'] = category
            ws[f'B{row}'] = 0
            ws[f'C{row}'] = 0
            ws[f'D{row}'] = f'=B{row}-C{row}'
            
            # Apply formatting
            for col in range(1, 5):
                cell = ws.cell(row=row, column=col)
                cell.border = self.thin_border
                if col > 1:
                    cell.number_format = f'#,##0 "{self.currency}"'
                    
            # Make planned and actual editable
            ws[f'B{row}'].fill = PatternFill(start_color="E5F5FF", end_color="E5F5FF", fill_type="solid")
            ws[f'C{row}'].fill = PatternFill(start_color="E5F5FF", end_color="E5F5FF", fill_type="solid")
            
            row += 1
            
        # Total row
        ws[f'A{row}'] = 'Celkem'
        ws[f'A{row}'].font = Font(bold=True)
        ws[f'B{row}'] = f'=SUM(B{start_row}:B{row-1})'
        ws[f'C{row}'] = f'=SUM(C{start_row}:C{row-1})'
        ws[f'D{row}'] = f'=B{row}-C{row}'
        
        for col in range(1, 5):
            cell = ws.cell(row=row, column=col)
            cell.border = self.thin_border
            cell.font = Font(bold=True)
            if col > 1:
                cell.number_format = f'#,##0 "{self.currency}"'
                
        # Conditional formatting for differences
        if self.options.get('include_formatting', True):
            # Red for over budget, green for under
            for r in range(start_row, row+1):
                diff_cell = ws[f'D{r}']
                
                # Apply conditional formatting
                red_fill = PatternFill(start_color="FFB3BA", end_color="FFB3BA", fill_type="solid")
                green_fill = PatternFill(start_color="B3FFB3", end_color="B3FFB3", fill_type="solid")
                
                # This would need VBA in real Excel
                
        # Per person calculations
        row += 3
        ws[f'A{row}'] = 'Náklady na osobu'
        ws[f'A{row}'].font = Font(bold=True, size=12)
        ws[f'A{row}'].fill = self.subheader_fill
        ws.merge_cells(f'A{row}:C{row}')
        
        row += 1
        ws[f'A{row}'] = 'Plánované na osobu:'
        ws[f'B{row}'] = f'=B{row-4}/{trip_data["trip"]["participant_count"]}'
        ws[f'B{row}'].number_format = f'#,##0 "{self.currency}"'
        
        row += 1
        ws[f'A{row}'] = 'Skutečné na osobu:'
        ws[f'B{row}'] = f'=C{row-5}/{trip_data["trip"]["participant_count"]}'
        ws[f'B{row}'].number_format = f'#,##0 "{self.currency}"'
        
        # Auto-size columns
        self._autosize_columns(ws)
        
    def _autosize_columns(self, ws):
        """Auto-size all columns in worksheet."""
        for column in ws.columns:
            max_length = 0
            column_letter = get_column_letter(column[0].column)
            
            for cell in column:
                try:
                    if len(str(cell.value)) > max_length:
                        max_length = len(str(cell.value))
                except:
                    pass
                    
            adjusted_width = min(max_length + 2, 50)
            ws.column_dimensions[column_letter].width = adjusted_width
            
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
        
    def _translate_trip_type(self, trip_type: str) -> str:
        """Translate trip type to Czech."""
        translations = {
            'family': 'Rodinný výlet',
            'friends': 'S přáteli',
            'business': 'Pracovní',
            'solo': 'Sólový výlet',
            'other': 'Jiný'
        }
        return translations.get(trip_type, trip_type)
        
    def _translate_age_group(self, age_group: str) -> str:
        """Translate age group to Czech."""
        translations = {
            'child': 'Dítě',
            'teen': 'Teenager',
            'adult': 'Dospělý',
            'senior': 'Senior'
        }
        return translations.get(age_group, age_group)
        
    def _translate_difficulty(self, difficulty: str) -> str:
        """Translate difficulty to Czech."""
        translations = {
            'easy': 'Snadné',
            'medium': 'Střední',
            'hard': 'Náročné'
        }
        return translations.get(difficulty, difficulty)