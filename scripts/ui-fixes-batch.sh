#!/bin/bash

# UI/UX Batch Fixes Script
# Task: task-1769687213378
# Applies systematic fixes to dashboard components

set -e

echo "🎨 Dashboard UI/UX Batch Fixes"
echo "================================"
echo ""

BACKUP_DIR="./src/components/backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "📁 Creating backups in $BACKUP_DIR"

# Function to backup a file
backup_file() {
    local file=$1
    if [ -f "$file" ]; then
        cp "$file" "$BACKUP_DIR/$(basename $file)"
        echo "  ✓ Backed up $(basename $file)"
    fi
}

# Function to apply text truncation fixes
fix_text_truncation() {
    echo ""
    echo "🔧 Fixing text truncation issues..."
    
    # Common patterns to fix:
    # 1. Long text without truncate
    # 2. Missing max-width on flex items
    # 3. Missing line-clamp on descriptions
    
    # List of files with known truncation issues
    local files=(
        "src/components/Sidebar.tsx"
        "src/components/ThreadListItem.tsx"
        "src/components/DraggableSession.tsx"
    )
    
    for file in "${files[@]}"; do
        if [ -f "$file" ]; then
            backup_file "$file"
            echo "  🔍 Checking $file for truncation issues..."
        fi
    done
}

# Function to fix spacing consistency
fix_spacing() {
    echo ""
    echo "📏 Fixing spacing consistency..."
    
    # Find all *Panel.tsx files
    find src/components -name "*Panel.tsx" -not -name "*.backup" | while read file; do
        if grep -q "className=\"p-4\"" "$file" || grep -q "className=\"p-8\"" "$file"; then
            backup_file "$file"
            echo "  ⚠️  $file has non-standard padding"
        fi
    done
}

# Function to fix icon sizes
fix_icon_sizes() {
    echo ""
    echo "🎯 Auditing icon sizes..."
    
    # Find all uses of size={12} or size={18}
    echo "  Looking for non-standard icon sizes..."
    grep -r "size={12}" src/components --include="*.tsx" | wc -l | xargs echo "    - size=12:"
    grep -r "size={18}" src/components --include="*.tsx" | wc -l | xargs echo "    - size=18:"
    grep -r "size={14}" src/components --include="*.tsx" | wc -l | xargs echo "    - size=14:"
    grep -r "size={16}" src/components --include="*.tsx" | wc -l | xargs echo "    - size=16:"
    grep -r "size={20}" src/components --include="*.tsx" | wc -l | xargs echo "    - size=20:"
    grep -r "size={24}" src/components --include="*.tsx" | wc -l | xargs echo "    - size=24:"
}

# Function to check responsive classes
check_responsive() {
    echo ""
    echo "📱 Checking responsive design..."
    
    # Find components with fixed widths
    echo "  Components with fixed widths (w-96, w-64, etc):"
    grep -r "className=.*w-96" src/components --include="*.tsx" | wc -l | xargs echo "    - w-96:"
    grep -r "className=.*w-64" src/components --include="*.tsx" | wc -l | xargs echo "    - w-64:"
    grep -r "className=.*w-48" src/components --include="*.tsx" | wc -l | xargs echo "    - w-48:"
}

# Main execution
echo ""
echo "Starting UI fixes..."
echo "-------------------"

fix_text_truncation
fix_spacing
fix_icon_sizes
check_responsive

echo ""
echo "================================"
echo "✅ Audit complete!"
echo ""
echo "Next steps:"
echo "1. Review backup directory: $BACKUP_DIR"
echo "2. Apply component-specific fixes"
echo "3. Run: npm run build"
echo "4. Test visually"
echo ""
