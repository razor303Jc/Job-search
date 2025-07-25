# 🔔 Job Alerts Selenium Testing - Quick Reference

## 🚀 Quick Start Commands

```bash
# Run all alerts & notifications tests
npm run test:selenium:alerts

# Run only the dedicated alerts test suite  
npm run test:selenium:alerts-only

# Run comprehensive tests including alerts
npm run test:selenium:with-alerts

# Run with visible browser windows (for debugging)
npm run test:selenium:visual
```

## 📋 Test Coverage

✅ **40+ Test Scenarios** covering:
- Alert page loading and form interactions
- Keyword and company tag management  
- Notification permission handling
- Push notification service integration
- Form validation and error handling
- Mobile responsiveness and touch UI
- Performance benchmarks and memory leak detection
- API integration and real-time updates

## 🧪 What Gets Tested

### Core Alert Functionality
- Job alerts page loads with all required elements
- Alert creation form accepts and validates data
- Keywords can be added/removed dynamically
- Company filtering works correctly
- Notification frequency options available
- Form validation prevents invalid submissions

### Notification System
- Browser notification permissions detected
- Service worker registration for push notifications
- VAPID configuration for web push
- Notification enable/disable controls
- Push notification service integration

### Integration & Performance  
- Alert API endpoints available and responsive
- Authentication system integration
- Alert data persistence and loading
- Real-time update mechanisms
- Page load performance < 3 seconds
- Form interaction responsiveness < 1 second

## 🔧 Environment Setup

### Prerequisites
```bash
# Ensure application is running
npm run start:web

# Install selenium dependencies (if needed)
npm install
```

### Configuration Options
```bash
# Test with specific browsers
TEST_BROWSERS=chrome npm run test:selenium:alerts

# Run in headless mode
TEST_HEADLESS=true npm run test:selenium:alerts

# Custom base URL
TEST_BASE_URL=http://localhost:8080 npm run test:selenium:alerts
```

## 📊 Expected Results

### Success Criteria
- **Overall Success Rate**: > 95%
- **Alert-Specific Tests**: > 98% 
- **Cross-Browser Compatibility**: Chrome & Firefox
- **Performance Benchmarks**: All timing thresholds met

### Report Generation
- JSON reports in `tests/selenium/reports/`
- HTML reports with visual charts and coverage
- Screenshots for failed tests in `tests/selenium/screenshots/`
- Console output with real-time progress

## 🛠️ Troubleshooting

### Common Issues
1. **Server not running**: Start with `npm run start:web`
2. **Browser driver issues**: Update selenium-webdriver  
3. **Timeout failures**: Increase TEST_TIMEOUT environment variable
4. **Permission errors**: Check file system permissions for reports directory

### Debug Mode
```bash
# Run with visible browser for debugging
TEST_HEADLESS=false npm run test:selenium:alerts

# Run single browser only
TEST_BROWSERS=chrome npm run test:selenium:alerts
```

## 🎯 Integration with CI/CD

The alerts testing is integrated into the project's CI/CD pipeline and can be run as part of:
- Pre-deployment validation
- Feature branch testing  
- Nightly regression testing
- Release candidate validation

Run `npm test` to execute all tests including the new alerts Selenium suite.
