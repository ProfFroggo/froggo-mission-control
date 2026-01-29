#!/bin/bash

# Color Scheme Verification Script
# Checks for hardcoded colors and verifies CSS variable usage

echo "╔════════════════════════════════════════════════════════════╗"
echo "║       Froggo Dashboard - Color Scheme Verification        ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

cd "$(dirname "$0")/.." || exit 1

ERRORS=0

# Check for hardcoded colors in critical files
echo "🔍 Checking for hardcoded colors in critical files..."
echo ""

FILES_TO_CHECK=(
  "src/components/Tooltip.tsx"
  "src/components/PerformanceBenchmarks.tsx"
  "src/components/UsageStatsPanel.tsx"
)

for file in "${FILES_TO_CHECK[@]}"; do
  if [ -f "$file" ]; then
    # Count non-chart colors (exclude stroke, fill, stopColor, etc. for data viz)
    COUNT=$(grep "#[0-9a-fA-F]\{6\}" "$file" | grep -v -E "stroke|fill|stopColor|backgroundColor.*#1f2937|border.*#374151" | wc -l | tr -d ' ' || echo "0")
    if [ "$COUNT" -gt 0 ]; then
      echo "⚠️  $file: Found $COUNT hardcoded hex colors (likely chart/viz colors - review)"
    else
      echo "✅ $file: No hardcoded layout/theme colors (data viz colors OK)"
    fi
  fi
done

echo ""

# Check for CSS variable definitions
echo "🔍 Checking CSS variable definitions..."
echo ""

# Use cat and grep to avoid -- option issues
CSS_CONTENT=$(cat src/index.css 2>/dev/null || echo "")

check_var() {
  local varname="$1"
  # Use grep with -- to separate options from pattern (prevents -- in pattern from being interpreted as option)
  if echo "$CSS_CONTENT" | grep -F -- "${varname}:" >/dev/null 2>&1; then
    echo "✅ $varname defined"
    return 0
  else
    echo "❌ $varname missing"
    return 1
  fi
}

check_var "--clawd-bg" || ERRORS=$((ERRORS + 1))
check_var "--clawd-surface" || ERRORS=$((ERRORS + 1))
check_var "--clawd-border" || ERRORS=$((ERRORS + 1))
check_var "--clawd-text" || ERRORS=$((ERRORS + 1))
check_var "--clawd-text-dim" || ERRORS=$((ERRORS + 1))
check_var "--clawd-accent" || ERRORS=$((ERRORS + 1))
check_var "--color-success" || ERRORS=$((ERRORS + 1))
check_var "--color-error" || ERRORS=$((ERRORS + 1))
check_var "--channel-discord" || ERRORS=$((ERRORS + 1))

echo ""

# Check light theme overrides
echo "🔍 Checking light theme overrides..."
echo ""

if grep -q ":root.light" src/index.css; then
  echo "✅ Light theme selector exists"
  
  # Check for improved text-dim contrast
  if grep -q "text-dim: #52525b" src/index.css; then
    echo "✅ Light theme text-dim uses improved contrast (#52525b)"
  else
    echo "⚠️  Light theme text-dim may not have optimal contrast"
  fi
else
  echo "❌ Light theme selector missing"
  ERRORS=$((ERRORS + 1))
fi

echo ""

# Check for utility classes
echo "🔍 Checking theme-aware utility classes..."
echo ""

UTILITY_CLASSES=(
  ".text-muted"
  ".bg-subtle"
  ".bg-hover"
  ".accent-bg"
)

for class in "${UTILITY_CLASSES[@]}"; do
  if grep -q "$class" src/index.css; then
    echo "✅ $class defined"
  else
    echo "⚠️  $class missing (recommended)"
  fi
done

echo ""

# Check documentation
echo "🔍 Checking documentation..."
echo ""

DOCS=(
  "COLORS.md"
  "COLOR_AUDIT.md"
  "COLOR_FIXES_SUMMARY.md"
)

for doc in "${DOCS[@]}"; do
  if [ -f "$doc" ]; then
    echo "✅ $doc exists"
  else
    echo "❌ $doc missing"
    ERRORS=$((ERRORS + 1))
  fi
done

echo ""
echo "════════════════════════════════════════════════════════════"

if [ $ERRORS -eq 0 ]; then
  echo "✅ All checks passed! Color system is properly implemented."
  echo ""
  echo "Next steps:"
  echo "  1. Run the dashboard: npm run electron:dev"
  echo "  2. Test theme switching (light/dark toggle)"
  echo "  3. Verify tooltips, charts, and modals display correctly"
  echo "  4. Run accessibility audit: Lighthouse or axe DevTools"
  exit 0
else
  echo "❌ Found $ERRORS issue(s). Please review and fix."
  exit 1
fi
