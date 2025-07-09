"""
HTML exporter for shopping lists.
"""

from typing import Dict, Any
from datetime import datetime
import html

from .base import ShoppingListExporter
from jidelnicek.shopping.services.shopping_list_generator import ShoppingList


class HTMLExporter(ShoppingListExporter):
    """
    Export shopping lists as HTML files.
    
    Creates responsive HTML with:
    - Mobile-friendly layout
    - Interactive checkboxes
    - Print-friendly styling
    - Collapsible sections
    - Search functionality
    """
    
    def get_file_extension(self) -> str:
        """Return .html extension."""
        return '.html'
        
    def get_mime_type(self) -> str:
        """Return text/html MIME type."""
        return 'text/html'
        
    def export(self, shopping_list: ShoppingList) -> bytes:
        """
        Export shopping list to HTML format.
        
        Options:
            include_css: Include inline CSS styling
            include_javascript: Add interactive features
            theme: 'light' or 'dark' theme
            responsive: Mobile-responsive design
            
        Returns:
            UTF-8 encoded HTML bytes
        """
        # Build HTML structure
        html_parts = []
        
        # DOCTYPE and head
        html_parts.append(self._generate_head(shopping_list))
        
        # Body
        html_parts.append('<body>')
        
        # Container
        html_parts.append('<div class="container">')
        
        # Header
        html_parts.append(self._generate_header(shopping_list))
        
        # Search box if interactive
        if self.options.get('include_javascript', True):
            html_parts.append(self._generate_search_box())
            
        # Sections
        html_parts.append('<div class="sections">')
        for section in shopping_list.sections:
            html_parts.append(self._generate_section(section))
        html_parts.append('</div>')
        
        # Summary
        if self.options.get('include_summary', True):
            html_parts.append(self._generate_summary(shopping_list))
            
        html_parts.append('</div>')  # container
        
        # JavaScript if included
        if self.options.get('include_javascript', True):
            html_parts.append(self._generate_javascript())
            
        html_parts.append('</body>')
        html_parts.append('</html>')
        
        # Join and encode
        html_content = '\n'.join(html_parts)
        return html_content.encode('utf-8')
        
    def _generate_head(self, shopping_list: ShoppingList) -> str:
        """Generate HTML head section."""
        title = f"Shopping List - {datetime.now().strftime('%Y-%m-%d')}"
        
        head = f'''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{html.escape(title)}</title>'''
        
        if self.options.get('include_css', True):
            head += f'\n    <style>\n{self._generate_css()}\n    </style>'
            
        head += '\n</head>'
        return head
        
    def _generate_css(self) -> str:
        """Generate CSS styles."""
        theme = self.options.get('theme', 'light')
        
        if theme == 'dark':
            colors = {
                'bg': '#1a1a1a',
                'fg': '#e0e0e0',
                'card': '#2a2a2a',
                'border': '#404040',
                'accent': '#4a9eff',
                'hover': '#353535'
            }
        else:
            colors = {
                'bg': '#f5f5f5',
                'fg': '#333333',
                'card': '#ffffff',
                'border': '#ddd',
                'accent': '#2196F3',
                'hover': '#f0f0f0'
            }
            
        return f'''
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background-color: {colors['bg']};
            color: {colors['fg']};
            line-height: 1.6;
        }}
        
        .container {{
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
        }}
        
        header {{
            text-align: center;
            margin-bottom: 30px;
        }}
        
        h1 {{
            color: {colors['accent']};
            margin-bottom: 10px;
        }}
        
        .metadata {{
            color: #666;
            font-size: 0.9em;
        }}
        
        .search-box {{
            margin-bottom: 20px;
        }}
        
        .search-box input {{
            width: 100%;
            padding: 10px;
            font-size: 16px;
            border: 1px solid {colors['border']};
            border-radius: 5px;
            background-color: {colors['card']};
            color: {colors['fg']};
        }}
        
        .section {{
            background-color: {colors['card']};
            border-radius: 8px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }}
        
        .section-header {{
            padding: 15px;
            background-color: {colors['accent']};
            color: white;
            border-radius: 8px 8px 0 0;
            cursor: pointer;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }}
        
        .section-header:hover {{
            opacity: 0.9;
        }}
        
        .section-content {{
            padding: 15px;
        }}
        
        .item {{
            display: flex;
            align-items: center;
            padding: 10px 0;
            border-bottom: 1px solid {colors['border']};
        }}
        
        .item:last-child {{
            border-bottom: none;
        }}
        
        .item:hover {{
            background-color: {colors['hover']};
        }}
        
        .item input[type="checkbox"] {{
            margin-right: 15px;
            width: 20px;
            height: 20px;
            cursor: pointer;
        }}
        
        .item-name {{
            flex: 1;
            font-weight: 500;
        }}
        
        .item-quantity {{
            margin-right: 15px;
            color: #666;
        }}
        
        .item-note {{
            font-size: 0.9em;
            color: #888;
            font-style: italic;
        }}
        
        .item.checked {{
            opacity: 0.5;
        }}
        
        .item.checked .item-name {{
            text-decoration: line-through;
        }}
        
        .summary {{
            background-color: {colors['card']};
            padding: 20px;
            border-radius: 8px;
            margin-top: 30px;
        }}
        
        .summary h2 {{
            color: {colors['accent']};
            margin-bottom: 15px;
        }}
        
        .summary-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
        }}
        
        .summary-item {{
            display: flex;
            justify-content: space-between;
            padding: 5px 0;
        }}
        
        @media print {{
            body {{
                background-color: white;
                color: black;
            }}
            
            .search-box {{
                display: none;
            }}
            
            .section {{
                break-inside: avoid;
                box-shadow: none;
                border: 1px solid #ddd;
            }}
            
            .section-header {{
                background-color: #f0f0f0;
                color: black;
            }}
        }}
        
        @media (max-width: 600px) {{
            .container {{
                padding: 10px;
            }}
            
            .item {{
                flex-wrap: wrap;
            }}
            
            .item-note {{
                width: 100%;
                margin-top: 5px;
                margin-left: 35px;
            }}
        }}
        '''
        
    def _generate_header(self, shopping_list: ShoppingList) -> str:
        """Generate HTML header."""
        return f'''
        <header>
            <h1>Shopping List</h1>
            <div class="metadata">
                <p>Generated: {datetime.now().strftime('%B %d, %Y at %I:%M %p')}</p>
                <p>Total Items: {shopping_list.total_items} | 
                   Format: {shopping_list.format.value.replace('_', ' ').title()}</p>
            </div>
        </header>
        '''
        
    def _generate_search_box(self) -> str:
        """Generate search box HTML."""
        return '''
        <div class="search-box">
            <input type="text" id="searchInput" placeholder="Search items..." 
                   onkeyup="filterItems()">
        </div>
        '''
        
    def _generate_section(self, section) -> str:
        """Generate HTML for a section."""
        section_id = section.title.replace(' ', '_').lower()
        
        html_parts = [f'<div class="section" id="section_{section_id}">']
        
        # Section header
        html_parts.append(f'''
            <div class="section-header" onclick="toggleSection('{section_id}')">
                <h2>{html.escape(section.title)}</h2>
                <span class="toggle-icon">▼</span>
            </div>
        ''')
        
        # Section content
        html_parts.append(f'<div class="section-content" id="content_{section_id}">')
        
        # Items
        for i, item in enumerate(section.items):
            item_id = f"{section_id}_item_{i}"
            html_parts.append(self._generate_item(item, item_id))
            
        html_parts.append('</div>')  # section-content
        html_parts.append('</div>')  # section
        
        return '\n'.join(html_parts)
        
    def _generate_item(self, item, item_id: str) -> str:
        """Generate HTML for an item."""
        checkbox = '<input type="checkbox" onchange="toggleItem(this)">' if self.options.get('include_javascript', True) else '☐'
        
        note = ''
        if item.package_suggestion:
            note = f'<span class="item-note">{html.escape(item.package_suggestion)}</span>'
            
        return f'''
        <div class="item" id="{item_id}">
            {checkbox}
            <span class="item-name">{html.escape(item.name)}</span>
            <span class="item-quantity">{html.escape(item.display_text)}</span>
            {note}
        </div>
        '''
        
    def _generate_summary(self, shopping_list: ShoppingList) -> str:
        """Generate summary section."""
        html_parts = ['<div class="summary">']
        html_parts.append('<h2>Summary</h2>')
        
        html_parts.append('<div class="summary-grid">')
        
        # Storage requirements
        if shopping_list.storage_summary:
            html_parts.append('<div>')
            html_parts.append('<h3>Storage Requirements</h3>')
            
            for storage_type, count in shopping_list.storage_summary.items():
                html_parts.append(f'''
                    <div class="summary-item">
                        <span>{storage_type.value}:</span>
                        <span>{count} items</span>
                    </div>
                ''')
                
            html_parts.append('</div>')
            
        # Weight/Volume if available
        if shopping_list.total_weight_g > 0 or shopping_list.total_volume_ml > 0:
            html_parts.append('<div>')
            html_parts.append('<h3>Total Amounts</h3>')
            
            if shopping_list.total_weight_g > 0:
                weight_kg = shopping_list.total_weight_g / 1000
                html_parts.append(f'''
                    <div class="summary-item">
                        <span>Weight:</span>
                        <span>{weight_kg:.1f} kg</span>
                    </div>
                ''')
                
            if shopping_list.total_volume_ml > 0:
                volume_l = shopping_list.total_volume_ml / 1000
                html_parts.append(f'''
                    <div class="summary-item">
                        <span>Volume:</span>
                        <span>{volume_l:.1f} L</span>
                    </div>
                ''')
                
            html_parts.append('</div>')
            
        html_parts.append('</div>')  # summary-grid
        html_parts.append('</div>')  # summary
        
        return '\n'.join(html_parts)
        
    def _generate_javascript(self) -> str:
        """Generate JavaScript for interactivity."""
        return '''
        <script>
        function toggleSection(sectionId) {
            const content = document.getElementById('content_' + sectionId);
            const icon = document.querySelector('#section_' + sectionId + ' .toggle-icon');
            
            if (content.style.display === 'none') {
                content.style.display = 'block';
                icon.textContent = '▼';
            } else {
                content.style.display = 'none';
                icon.textContent = '▶';
            }
        }
        
        function toggleItem(checkbox) {
            const item = checkbox.closest('.item');
            if (checkbox.checked) {
                item.classList.add('checked');
            } else {
                item.classList.remove('checked');
            }
            updateProgress();
        }
        
        function updateProgress() {
            const total = document.querySelectorAll('.item').length;
            const checked = document.querySelectorAll('.item.checked').length;
            
            // Update title or header with progress
            const title = document.querySelector('h1');
            if (total > 0) {
                const percent = Math.round((checked / total) * 100);
                title.textContent = `Shopping List (${percent}% complete)`;
            }
        }
        
        function filterItems() {
            const searchTerm = document.getElementById('searchInput').value.toLowerCase();
            const items = document.querySelectorAll('.item');
            
            items.forEach(item => {
                const name = item.querySelector('.item-name').textContent.toLowerCase();
                if (name.includes(searchTerm)) {
                    item.style.display = 'flex';
                } else {
                    item.style.display = 'none';
                }
            });
            
            // Show all sections
            document.querySelectorAll('.section-content').forEach(content => {
                content.style.display = 'block';
            });
        }
        
        // Initialize
        updateProgress();
        </script>
        '''