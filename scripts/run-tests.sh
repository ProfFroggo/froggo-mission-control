#!/bin/bash
# (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
# Mission Control Dashboard - Test Runner Script

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
print_header() {
    echo -e "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}  $1${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# Parse arguments
TEST_TYPE=${1:-"all"}
COVERAGE=${2:-"false"}

cd "$(dirname "$0")/.." || exit 1

# Ensure dependencies installed
if [ ! -d "node_modules" ]; then
    print_warning "Dependencies not installed. Running npm install..."
    npm install
fi

# Run tests based on type
case "$TEST_TYPE" in
    unit)
        print_header "Running Unit Tests"
        if [ "$COVERAGE" = "coverage" ]; then
            npm run test:coverage
        else
            npm run test:run
        fi
        print_success "Unit tests completed"
        ;;
    
    integration)
        print_header "Running Integration Tests"
        npm test -- integration/
        print_success "Integration tests completed"
        ;;
    
    e2e)
        print_header "Running E2E Tests"
        
        # Check if Playwright browsers are installed
        if ! npx playwright --version &>/dev/null; then
            print_warning "Installing Playwright browsers..."
            npx playwright install --with-deps
        fi
        
        npm run test:e2e
        print_success "E2E tests completed"
        ;;
    
    performance)
        print_header "Running Performance Tests"
        npm test -- performance/
        print_success "Performance tests completed"
        ;;
    
    components)
        print_header "Running Component Tests"
        npm test -- components/
        print_success "Component tests completed"
        ;;
    
    store)
        print_header "Running Store Tests"
        npm test -- store/
        print_success "Store tests completed"
        ;;
    
    all)
        print_header "Running All Tests"
        
        # Unit tests
        print_header "1/4 Unit Tests"
        npm run test:run
        print_success "Unit tests passed"
        
        # Integration tests
        print_header "2/4 Integration Tests"
        npm test -- integration/
        print_success "Integration tests passed"
        
        # Performance tests
        print_header "3/4 Performance Tests"
        npm test -- performance/
        print_success "Performance tests passed"
        
        # E2E tests
        print_header "4/4 E2E Tests"
        
        if ! npx playwright --version &>/dev/null; then
            print_warning "Installing Playwright browsers..."
            npx playwright install --with-deps
        fi
        
        npm run test:e2e
        print_success "E2E tests passed"
        
        # Generate coverage
        if [ "$COVERAGE" = "coverage" ]; then
            print_header "Generating Coverage Report"
            npm run test:coverage
            print_success "Coverage report generated"
            echo -e "\n${YELLOW}Open coverage/index.html to view the report${NC}\n"
        fi
        
        print_header "✓ All Tests Passed!"
        ;;
    
    watch)
        print_header "Running Tests in Watch Mode"
        npm run test:watch
        ;;
    
    ci)
        print_header "Running CI Test Suite"
        
        # Run unit tests with coverage
        npm run test:coverage
        
        # Run E2E tests
        npx playwright install --with-deps
        npm run test:e2e
        
        print_success "CI tests completed"
        ;;
    
    *)
        echo "Usage: $0 [test-type] [coverage]"
        echo ""
        echo "Test types:"
        echo "  unit         - Run unit tests only"
        echo "  integration  - Run integration tests only"
        echo "  e2e          - Run E2E tests only"
        echo "  performance  - Run performance tests only"
        echo "  components   - Run component tests only"
        echo "  store        - Run store tests only"
        echo "  all          - Run all tests (default)"
        echo "  watch        - Run tests in watch mode"
        echo "  ci           - Run CI test suite with coverage"
        echo ""
        echo "Options:"
        echo "  coverage     - Generate coverage report (works with 'all' or 'ci')"
        echo ""
        echo "Examples:"
        echo "  $0 unit"
        echo "  $0 all coverage"
        echo "  $0 e2e"
        echo "  $0 watch"
        exit 1
        ;;
esac

exit 0
