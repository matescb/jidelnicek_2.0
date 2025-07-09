# Jidelnicek Export API Documentation

## Overview

The Jidelnicek Export API provides a unified interface for exporting trips, recipes, and shopping lists to various formats. It supports both synchronous (immediate download) and asynchronous (background job) processing, with comprehensive options for customization.

## Features

- **Multiple Export Types**: Trips, Recipes, Shopping Lists
- **Multiple Formats**: PDF, Excel, CSV, JSON, HTML, Text, Markdown
- **Sync/Async Processing**: Choose based on your needs
- **Batch Exports**: Export multiple items at once
- **Export History**: Track all exports with download links
- **Export Presets**: Save and reuse configurations
- **Rate Limiting**: Fair usage limits to ensure stability
- **Preview Support**: Preview exports before generating full files

## Quick Start

### Authentication

All endpoints require authentication via Bearer token:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://api.jidelnicek.cz/api/v1/exports/formats
```

### Export a Single Item

#### Synchronous Export (Immediate Download)

```bash
curl -X POST https://api.jidelnicek.cz/api/v1/exports/single \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "export_type": "trip",
    "export_format": "pdf",
    "item_id": "123",
    "async_export": false,
    "options": {
      "pdf_options": {
        "page_size": "A4",
        "orientation": "portrait"
      }
    }
  }' \
  --output trip_123.pdf
```

#### Asynchronous Export (Background Job)

```bash
# Start export job
curl -X POST https://api.jidelnicek.cz/api/v1/exports/single \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "export_type": "trip",
    "export_format": "excel",
    "item_id": "123",
    "async_export": true
  }'

# Response:
# {
#   "job_id": "550e8400-e29b-41d4-a716-446655440000",
#   "status": "pending",
#   ...
# }

# Check status
curl https://api.jidelnicek.cz/api/v1/exports/status/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer YOUR_TOKEN"

# Download when ready
curl https://api.jidelnicek.cz/api/v1/exports/download/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  --output export.xlsx
```

### Batch Export

```bash
curl -X POST https://api.jidelnicek.cz/api/v1/exports/batch \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "exports": [
      {
        "export_type": "trip",
        "export_format": "pdf",
        "item_ids": ["123", "124", "125"],
        "merge_into_single_file": true
      },
      {
        "export_type": "recipe",
        "export_format": "json",
        "item_ids": ["456", "457"],
        "merge_into_single_file": false
      }
    ]
  }'
```

## Export Types and Formats

### Supported Combinations

| Export Type    | PDF | Excel | CSV | JSON | HTML | Text | Markdown |
|----------------|-----|-------|-----|------|------|------|----------|
| Trip           | ✓   | ✓     | ✗   | ✓    | ✓    | ✓    | ✓        |
| Recipe         | ✓   | ✓     | ✓   | ✓    | ✓    | ✓    | ✓        |
| Shopping List  | ✓   | ✓     | ✓   | ✓    | ✓    | ✓    | ✗        |

### Format-Specific Options

#### PDF Options

```json
{
  "pdf_options": {
    "page_size": "A4",         // A4, letter, legal
    "orientation": "portrait",  // portrait, landscape
    "margin": 25,              // 10-50
    "font_size": 10,           // 8-14
    "include_toc": true,       // Table of contents
    "include_page_numbers": true
  }
}
```

#### Excel Options

```json
{
  "excel_options": {
    "include_formulas": true,   // Calculate totals, etc.
    "include_charts": true,     // Generate charts
    "freeze_headers": true,     // Freeze header rows
    "auto_filter": true,        // Enable filtering
    "separate_sheets": true     // Use multiple sheets
  }
}
```

#### CSV Options

```json
{
  "csv_options": {
    "delimiter": ";",           // , ; \t |
    "quote_char": "\"",         // " '
    "encoding": "utf-8",        // utf-8, utf-16, windows-1250
    "include_headers": true
  }
}
```

#### JSON Options

```json
{
  "json_options": {
    "indent": 2,                // 0-8
    "sort_keys": false,
    "ensure_ascii": false
  }
}
```

#### HTML Options

```json
{
  "html_options": {
    "include_css": true,
    "include_javascript": false,
    "responsive": true,
    "theme": "light"            // light, dark, auto
  }
}
```

#### Text Options

```json
{
  "text_options": {
    "line_width": 80,           // 40-120
    "indent_size": 2,           // 0-8
    "section_separator": "-"    // "", -, =, *
  }
}
```

#### Markdown Options

```json
{
  "markdown_options": {
    "flavor": "github",         // github, commonmark, extended
    "include_toc": true,
    "heading_style": "atx",     // atx (#), setext (underline)
    "code_style": "fenced"      // fenced, indented
  }
}
```

## Export Presets

Save frequently used export configurations:

```bash
# Create preset
curl -X POST https://api.jidelnicek.cz/api/v1/exports/presets \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Trip PDF Complete",
    "description": "Full trip export with all details",
    "export_type": "trip",
    "export_format": "pdf",
    "options": {
      "include_recipes": true,
      "include_shopping": true,
      "include_nutrition": true,
      "page_size": "A4"
    }
  }'

# List presets
curl https://api.jidelnicek.cz/api/v1/exports/presets \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Rate Limits

- **Single exports**: 100 per hour
- **Batch exports**: 10 per hour

Rate limit information is included in response headers:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642089600
```

## Error Handling

The API returns standard HTTP status codes:

- `200 OK` - Success
- `400 Bad Request` - Invalid request parameters
- `401 Unauthorized` - Authentication required
- `404 Not Found` - Resource not found
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error

Error responses include details:

```json
{
  "detail": "Export format pdf not supported for shopping_list",
  "code": "INVALID_FORMAT",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## Best Practices

1. **Use Async for Large Exports**: For trips longer than 7 days or with many recipes, use asynchronous export.

2. **Check Format Support**: Use `/api/v1/exports/formats` to verify supported formats before exporting.

3. **Set Appropriate Options**: Different formats have different options. Check `/api/v1/exports/options/{format}` for details.

4. **Handle Rate Limits**: Implement exponential backoff when receiving 429 responses.

5. **Clean Up Old Exports**: Exports are automatically deleted after 7 days. Download important files promptly.

6. **Use Presets**: For repeated exports with same settings, create presets to ensure consistency.

## Examples

### Export Trip with Shopping List (PDF)

```python
import requests

def export_trip_pdf(trip_id, token):
    url = "https://api.jidelnicek.cz/api/v1/exports/single"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    data = {
        "export_type": "trip",
        "export_format": "pdf",
        "item_id": str(trip_id),
        "async_export": False,
        "options": {
            "include_recipes": True,
            "include_shopping": True,
            "include_nutrition": True,
            "include_costs": True,
            "page_size": "A4",
            "language": "cs"
        }
    }
    
    response = requests.post(url, json=data, headers=headers)
    
    if response.status_code == 200:
        with open(f"trip_{trip_id}.pdf", "wb") as f:
            f.write(response.content)
        print("Export saved successfully")
    else:
        print(f"Export failed: {response.status_code}")
        print(response.json())

# Usage
export_trip_pdf(123, "your_token_here")
```

### Monitor Async Export

```javascript
async function exportWithProgress(exportConfig, token) {
    // Start export
    const startResponse = await fetch('/api/v1/exports/single', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            ...exportConfig,
            async_export: true
        })
    });
    
    const { job_id } = await startResponse.json();
    
    // Poll for status
    let status = 'pending';
    let progress = 0;
    
    while (status === 'pending' || status === 'processing') {
        const statusResponse = await fetch(`/api/v1/exports/status/${job_id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const statusData = await statusResponse.json();
        status = statusData.status;
        progress = statusData.progress || 0;
        
        console.log(`Export progress: ${progress}%`);
        
        if (status === 'completed') {
            // Download file
            const downloadResponse = await fetch(`/api/v1/exports/download/${job_id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            return await downloadResponse.blob();
        } else if (status === 'failed') {
            throw new Error(statusData.error_message);
        }
        
        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
}
```

## API Reference

For complete API documentation, see the [OpenAPI specification](./export_api_specification.yaml).

## Support

For issues or questions about the Export API, please contact:
- Email: support@jidelnicek.cz
- Documentation: https://docs.jidelnicek.cz/api/exports