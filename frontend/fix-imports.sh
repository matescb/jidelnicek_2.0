#!/bin/bash

# Find all TypeScript/TSX files and fix UI component imports
find src -name "*.tsx" -o -name "*.ts" | while read file; do
  echo "Processing $file..."
  
  # Fix common UI component imports
  sed -i 's|ui/Button|ui/button|g' "$file"
  sed -i 's|ui/Input|ui/input|g' "$file"
  sed -i 's|ui/Select|ui/select|g' "$file"
  sed -i 's|ui/Checkbox|ui/checkbox|g' "$file"
  sed -i 's|ui/Badge|ui/badge|g' "$file"
  sed -i 's|ui/Card|ui/card|g' "$file"
  sed -i 's|ui/Dialog|ui/dialog|g' "$file"
  sed -i 's|ui/Spinner|ui/loading/Spinner|g' "$file"
  sed -i 's|ui/Avatar|ui/avatar|g' "$file"
  sed -i 's|ui/Progress|ui/progress|g' "$file"
  sed -i 's|ui/Skeleton|ui/skeleton|g' "$file"
  sed -i 's|ui/Toast|ui/toast|g' "$file"
  sed -i 's|ui/Tooltip|ui/tooltip|g' "$file"
  sed -i 's|ui/Alert|ui/alert|g' "$file"
  sed -i 's|ui/Drawer|ui/drawer|g' "$file"
  sed -i 's|ui/Sheet|ui/sheet|g' "$file"
  sed -i 's|ui/Popover|ui/popover|g' "$file"
  sed -i 's|ui/Calendar|ui/calendar|g' "$file"
  sed -i 's|ui/Textarea|ui/textarea|g' "$file"
  sed -i 's|ui/Label|ui/label|g' "$file"
  sed -i 's|ui/Switch|ui/switch|g' "$file"
  sed -i 's|ui/Slider|ui/slider|g' "$file"
  sed -i 's|ui/Table|ui/table|g' "$file"
  sed -i 's|ui/Tabs|ui/tabs|g' "$file"
  sed -i 's|ui/Carousel|ui/carousel|g' "$file"
  sed -i 's|ui/Collapsible|ui/collapsible|g' "$file"
  sed -i 's|ui/Separator|ui/separator|g' "$file"
  sed -i 's|ui/ScrollArea|ui/scroll-area|g' "$file"
  sed -i 's|ui/DropdownMenu|ui/dropdown-menu|g' "$file"
  sed -i 's|ui/AlertDialog|ui/alert-dialog|g' "$file"
  sed -i 's|ui/ComboBox|ui/combobox|g' "$file"
done

echo "Import fixing complete!"