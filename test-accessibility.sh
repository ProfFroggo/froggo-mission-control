#!/bin/bash
# Accessibility Testing Script for Froggo Dashboard

# Don't exit on error - we want to run all tests
set +e

echo "🧪 Testing Froggo Dashboard Accessibility"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
PASSED=0
FAILED=0

# Test function
test() {
  local name=$1
  local command=$2
  
  echo -n "Testing: $name... "
  
  if eval "$command" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ PASS${NC}"
    ((PASSED++))
  else
    echo -e "${RED}✗ FAIL${NC}"
    ((FAILED++))
  fi
}

# 1. Check if accessibility CSS exists
test "Accessibility CSS file exists" \
  "[ -f src/accessibility.css ]"

# 2. Check if accessibility CSS is imported
test "Accessibility CSS imported in main.tsx" \
  "grep -q \"import './accessibility.css'\" src/main.tsx"

# 3. Check for skip navigation link
test "Skip navigation link in App.tsx" \
  "grep -q 'skip-link' src/App.tsx"

# 4. Check for ARIA live region
test "ARIA live region in App.tsx" \
  "grep -q 'aria-live' src/App.tsx"

# 5. Check for main landmark
test "Main landmark role in App.tsx" \
  "grep -q 'role=\"main\"' src/App.tsx"

# 6. Check Sidebar has navigation role
test "Sidebar has navigation role" \
  "grep -q 'role=\"navigation\"' src/components/Sidebar.tsx"

# 7. Check for ARIA labels in Sidebar
test "Sidebar buttons have aria-label" \
  "grep -q 'aria-label=' src/components/Sidebar.tsx"

# 8. Check TopBar has banner role
test "TopBar has banner role" \
  "grep -q 'role=\"banner\"' src/components/TopBar.tsx"

# 9. Check CommandPalette has dialog role
test "CommandPalette has dialog role" \
  "grep -q 'role=\"dialog\"' src/components/CommandPalette.tsx"

# 10. Check for useAccessibility hooks
test "Accessibility hooks file exists" \
  "[ -f src/hooks/useAccessibility.ts ]"

# 11. Check for focus trap implementation
test "Focus trap hook exported" \
  "grep -q 'useFocusTrap' src/hooks/useAccessibility.ts"

# 12. Check for screen reader announcements
test "Announce hook exported" \
  "grep -q 'useAnnounce' src/hooks/useAccessibility.ts"

# 13. Check for reduced motion CSS
test "Reduced motion media query" \
  "grep -q 'prefers-reduced-motion' src/accessibility.css"

# 14. Check for high contrast CSS
test "High contrast media query" \
  "grep -q 'prefers-contrast' src/accessibility.css"

# 15. Check for focus-visible styles
test "Focus visible styles defined" \
  "grep -q 'focus-visible' src/accessibility.css"

# 16. Check for sr-only class
test "Screen reader only class defined" \
  "grep -q '.sr-only' src/accessibility.css"

# 17. Check that accessibility imports compile correctly
test "Accessibility imports compile" \
  "grep -q 'useAccessibility' src/components/CommandPalette.tsx"

# Summary
echo ""
echo "=========================================="
echo "Test Summary:"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo "Total:  $((PASSED + FAILED))"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✨ All accessibility tests passed!${NC}"
  exit 0
else
  echo -e "${RED}❌ Some tests failed. Please review.${NC}"
  exit 1
fi
