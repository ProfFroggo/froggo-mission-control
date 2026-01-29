#!/bin/bash

# Icon Size Standardization Script
# Replace non-standard icon sizes (12px, 18px) with standard sizes (14px, 16px, 20px, 24px)

set -e

echo "🎯 Icon Size Standardization"
echo "============================="
echo ""

# Strategy:
# size={18} → size={16} (default) or size={20} (emphasis)
# size={12} → size={14} (minimum for accessibility)

BACKUP_DIR="./src/components/backup-icon-fixes-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "📁 Backup directory: $BACKUP_DIR"
echo ""

# Count instances
echo "📊 Current icon size distribution:"
echo "  size=12: $(grep -r 'size={12}' src/components --include="*.tsx" | wc -l | tr -d ' ')"
echo "  size=14: $(grep -r 'size={14}' src/components --include="*.tsx" | wc -l | tr -d ' ')"
echo "  size=16: $(grep -r 'size={16}' src/components --include="*.tsx" | wc -l | tr -d ' ')"
echo "  size=18: $(grep -r 'size={18}' src/components --include="*.tsx" | wc -l | tr -d ' ')"
echo "  size=20: $(grep -r 'size={20}' src/components --include="*.tsx" | wc -l | tr -d ' ')"
echo "  size=24: $(grep -r 'size={24}' src/components --include="*.tsx" | wc -l | tr -d ' ')"
echo ""

# Decision matrix documented in UI_FIXES_APPLIED.md:
# - Navigation items: 20px
# - List items: 16px
# - Inline with text: 16px
# - Small indicators: 14px (min)
# - Headers: 24px
# - Buttons: 20px

echo "🔧 Applying icon size fixes..."
echo ""

# Fix 1: size=12 → size=14 (accessibility minimum)
echo "  Fixing size=12 → size=14..."
find src/components -name "*.tsx" -not -path "*/backup*" | while read file; do
  if grep -q 'size={12}' "$file"; then
    cp "$file" "$BACKUP_DIR/$(basename $file).bak"
    sed -i '' 's/size={12}/size={14}/g' "$file"
    echo "    ✓ Fixed $(basename $file)"
  fi
done

# Fix 2: size=18 → size=16 (default) or size=20 (contextual)
echo ""
echo "  Fixing size=18 → size=16/20..."
echo "  (Manual review needed for context-specific decisions)"

# For now, convert all size=18 to size=16 as the safe default
# Components that need emphasis can be manually adjusted to size=20
find src/components -name "*.tsx" -not -path "*/backup*" | while read file; do
  if grep -q 'size={18}' "$file"; then
    if [ ! -f "$BACKUP_DIR/$(basename $file).bak" ]; then
      cp "$file" "$BACKUP_DIR/$(basename $file).bak"
    fi
    sed -i '' 's/size={18}/size={16}/g' "$file"
    echo "    ✓ Fixed $(basename $file)"
  fi
done

echo ""
echo "📊 New icon size distribution:"
echo "  size=12: $(grep -r 'size={12}' src/components --include="*.tsx" | wc -l | tr -d ' ')"
echo "  size=14: $(grep -r 'size={14}' src/components --include="*.tsx" | wc -l | tr -d ' ')"
echo "  size=16: $(grep -r 'size={16}' src/components --include="*.tsx" | wc -l | tr -d ' ')"
echo "  size=18: $(grep -r 'size={18}' src/components --include="*.tsx" | wc -l | tr -d ' ')"
echo "  size=20: $(grep -r 'size={20}' src/components --include="*.tsx" | wc -l | tr -d ' ')"
echo "  size=24: $(grep -r 'size={24}' src/components --include="*.tsx" | wc -l | tr -d ' ')"
echo ""

echo "✅ Icon size fixes applied!"
echo ""
echo "Next steps:"
echo "1. Review changes: git diff src/components"
echo "2. Manual review for emphasis icons (upgrade 16→20 where needed)"
echo "3. Build test: npm run build"
echo "4. Visual inspection"
echo ""
echo "Backup location: $BACKUP_DIR"
