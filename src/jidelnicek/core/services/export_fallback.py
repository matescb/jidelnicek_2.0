"""Fallback implementations for export formats when dependencies are missing."""

import json
import csv
import io
import logging
from typing import Any, Dict, List, Optional
from datetime import datetime, date

from ..exceptions.export_exceptions import ExportGenerationError

logger = logging.getLogger(__name__)


class FallbackExporter:
    """Provides fallback export implementations."""
    
    @staticmethod
    async def export_to_json(
        data: Any,
        pretty: bool = True
    ) -> bytes:
        """Export data to JSON format (always available)."""
        try:
            # Custom JSON encoder for dates and complex types
            class DateTimeEncoder(json.JSONEncoder):
                def default(self, obj):
                    if isinstance(obj, (datetime, date)):
                        return obj.isoformat()
                    if hasattr(obj, "to_dict"):
                        return obj.to_dict()
                    if hasattr(obj, "__dict__"):
                        # Don't auto-serialize objects with problematic __repr__
                        try:
                            # Test if the object can be converted to string
                            str(obj)
                            return obj.__dict__
                        except Exception:
                            # Re-raise to trigger the exception handling
                            raise TypeError(f"Object of type {type(obj).__name__} is not JSON serializable")
                    return super().default(obj)
            
            json_str = json.dumps(
                data,
                cls=DateTimeEncoder,
                ensure_ascii=False,
                indent=2 if pretty else None
            )
            return json_str.encode("utf-8")
            
        except Exception as e:
            logger.error(f"JSON export failed: {e}")
            raise ExportGenerationError("JSON", str(e))
    
    @staticmethod
    async def export_to_csv(
        data: List[Dict[str, Any]],
        headers: Optional[List[str]] = None
    ) -> bytes:
        """Export data to CSV format (always available)."""
        try:
            if not data:
                return b""
            
            # Determine headers
            if not headers:
                headers = list(data[0].keys()) if data else []
            
            # Create CSV in memory
            output = io.StringIO()
            writer = csv.DictWriter(output, fieldnames=headers, lineterminator='\n')
            
            writer.writeheader()
            for row in data:
                # Convert complex types to strings
                cleaned_row = {}
                for key, value in row.items():
                    if key in headers:
                        if isinstance(value, (datetime, date)):
                            cleaned_row[key] = value.isoformat()
                        elif isinstance(value, (list, dict)):
                            cleaned_row[key] = json.dumps(value)
                        else:
                            cleaned_row[key] = str(value) if value is not None else ""
                writer.writerow(cleaned_row)
            
            return output.getvalue().encode("utf-8")
            
        except Exception as e:
            logger.error(f"CSV export failed: {e}")
            raise ExportGenerationError("CSV", str(e))
    
    @staticmethod
    async def export_to_txt(
        data: Any,
        template: Optional[str] = None
    ) -> bytes:
        """Export data to plain text format (always available)."""
        try:
            if template:
                # Use template if provided
                text = template.format(**data) if isinstance(data, dict) else template
            else:
                # Default text representation
                text = FallbackExporter._generate_text_representation(data)
            
            return text.encode("utf-8")
            
        except Exception as e:
            logger.error(f"Text export failed: {e}")
            raise ExportGenerationError("TXT", str(e))
    
    @staticmethod
    async def export_to_html(
        data: Any,
        title: str = "Export",
        css: Optional[str] = None
    ) -> bytes:
        """Export data to HTML format (always available)."""
        try:
            # Basic HTML template
            html_template = """<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>{title}</title>
    <style>
        {css}
    </style>
</head>
<body>
    <h1>{title}</h1>
    <div class="content">
        {content}
    </div>
</body>
</html>"""
            
            # Default CSS if not provided
            if not css:
                css = """
                body { font-family: Arial, sans-serif; margin: 20px; }
                table { border-collapse: collapse; width: 100%; margin: 20px 0; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #f2f2f2; font-weight: bold; }
                tr:nth-child(even) { background-color: #f9f9f9; }
                .section { margin: 20px 0; }
                .label { font-weight: bold; }
                """
            
            # Generate content based on data type
            content = FallbackExporter._generate_html_content(data)
            
            html = html_template.format(
                title=title,
                css=css,
                content=content
            )
            
            return html.encode("utf-8")
            
        except Exception as e:
            logger.error(f"HTML export failed: {e}")
            raise ExportGenerationError("HTML", str(e))
    
    @staticmethod
    def _generate_text_representation(data: Any) -> str:
        """Generate text representation of data."""
        if isinstance(data, dict):
            lines = []
            for key, value in data.items():
                if isinstance(value, (datetime, date)):
                    value = value.isoformat()
                elif isinstance(value, (list, dict)):
                    # Handle complex objects with date-aware JSON encoder
                    class DateTimeEncoder(json.JSONEncoder):
                        def default(self, obj):
                            if isinstance(obj, (datetime, date)):
                                return obj.isoformat()
                            if hasattr(obj, "to_dict"):
                                return obj.to_dict()
                            if hasattr(obj, "__dict__"):
                                return obj.__dict__
                            return super().default(obj)
                    
                    value = json.dumps(value, cls=DateTimeEncoder, indent=2, ensure_ascii=False)
                lines.append(f"{key}: {value}")
            return "\n".join(lines)
        
        elif isinstance(data, list):
            if all(isinstance(item, dict) for item in data):
                # Table-like representation for list of dicts
                if not data:
                    return "No data"
                
                headers = list(data[0].keys())
                lines = [" | ".join(headers)]
                lines.append("-" * len(lines[0]))
                
                for item in data:
                    row = []
                    for header in headers:
                        value = item.get(header, "")
                        if isinstance(value, (datetime, date)):
                            value = value.isoformat()
                        row.append(str(value))
                    lines.append(" | ".join(row))
                
                return "\n".join(lines)
            else:
                # Simple list representation
                return "\n".join(str(item) for item in data)
        
        else:
            return str(data)
    
    @staticmethod
    def _generate_html_content(data: Any) -> str:
        """Generate HTML content from data."""
        if isinstance(data, dict):
            sections = []
            for key, value in data.items():
                if isinstance(value, list) and all(isinstance(item, dict) for item in value):
                    # Generate table for list of dicts
                    sections.append(f'<div class="section">')
                    sections.append(f'<h2>{key}</h2>')
                    sections.append(FallbackExporter._generate_html_table(value))
                    sections.append('</div>')
                else:
                    # Generate key-value pair
                    if isinstance(value, (list, dict)):
                        try:
                            # Handle date objects in JSON serialization
                            if isinstance(value, dict):
                                # Check for date values and convert them
                                clean_value = {}
                                for k, v in value.items():
                                    if isinstance(v, (datetime, date)):
                                        clean_value[k] = v.isoformat()
                                    else:
                                        clean_value[k] = v
                                value = f"<pre>{json.dumps(clean_value, indent=2, ensure_ascii=False)}</pre>"
                            else:
                                value = f"<pre>{json.dumps(value, indent=2, ensure_ascii=False)}</pre>"
                        except (TypeError, ValueError):
                            value = f"<pre>{str(value)}</pre>"
                    elif isinstance(value, (datetime, date)):
                        value = value.isoformat()
                    sections.append(
                        f'<div class="section">'
                        f'<span class="label">{key}:</span> {value}'
                        f'</div>'
                    )
            return "\n".join(sections)
        
        elif isinstance(data, list):
            if all(isinstance(item, dict) for item in data):
                return FallbackExporter._generate_html_table(data)
            else:
                items = [f"<li>{item}</li>" for item in data]
                return f"<ul>{''.join(items)}</ul>"
        
        else:
            return f"<p>{data}</p>"
    
    @staticmethod
    def _generate_html_table(data: List[Dict[str, Any]]) -> str:
        """Generate HTML table from list of dictionaries."""
        if not data:
            return "<p>No data</p>"
        
        headers = list(data[0].keys())
        
        # Build table
        table = ["<table>"]
        
        # Headers
        table.append("<thead><tr>")
        for header in headers:
            table.append(f"<th>{header}</th>")
        table.append("</tr></thead>")
        
        # Body
        table.append("<tbody>")
        for row in data:
            table.append("<tr>")
            for header in headers:
                value = row.get(header, "")
                if isinstance(value, (datetime, date)):
                    value = value.isoformat()
                elif isinstance(value, (list, dict)):
                    value = json.dumps(value)
                table.append(f"<td>{value}</td>")
            table.append("</tr>")
        table.append("</tbody>")
        
        table.append("</table>")
        
        return "\n".join(table)


class FallbackPDFExporter:
    """Fallback PDF exporter using HTML to PDF conversion or text-based PDF."""
    
    @staticmethod
    async def export_to_simple_pdf(
        content: str,
        title: str = "Export"
    ) -> bytes:
        """Create a simple text-based PDF without external dependencies."""
        # This is a minimal PDF implementation
        # In production, you would use a proper library or service
        
        pdf_content = f"""%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >>
   /MediaBox [0 0 612 792] /Contents 5 0 R >>
endobj
4 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
5 0 obj
<< /Length {len(content)} >>
stream
BT
/F1 12 Tf
50 750 Td
({title}) Tj
0 -20 Td
({content}) Tj
ET
endstream
endobj
xref
0 6
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000262 00000 n
0000000341 00000 n
trailer
<< /Size 6 /Root 1 0 R >>
startxref
{len(content) + 500}
%%EOF"""
        
        return pdf_content.encode("latin-1")


class FallbackQRCodeGenerator:
    """Fallback QR code generator using ASCII art."""
    
    @staticmethod
    async def generate_ascii_qr(data: str) -> str:
        """Generate ASCII representation of QR code."""
        # This is a placeholder - in production, you'd use a proper algorithm
        # or call an external service
        
        # Simple ASCII art representation
        ascii_qr = f"""
╔═══════════════════╗
║ ▄▄▄▄▄ ▄ ▄ ▄▄▄▄▄ ║
║ █   █ █▄█ █   █ ║
║ █▄▄▄█ ▄▄▄ █▄▄▄█ ║
║ ▄▄▄▄▄ █▄█ ▄▄▄▄▄ ║
║ █████ ▄▄▄ █████ ║
║ ▄▄▄▄▄▄▄█▄▄▄▄▄▄▄ ║
╚═══════════════════╝
Data: {data[:30]}{'...' if len(data) > 30 else ''}
"""
        return ascii_qr