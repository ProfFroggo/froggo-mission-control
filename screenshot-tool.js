#!/usr/bin/env node

/**
 * Screenshot Dashboard - Verification Tool
 * Takes screenshots of the Froggo Dashboard in light and dark modes
 * Task: task-1769809773003
 */

const { chromium } = require('playwright-core');
const fs = require('fs').promises;
const path = require('path');

async function takeScreenshots() {
  console.log('[Screenshot] Launching browser...');
  
  const browser = await chromium.launch({
    headless: false
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  
  const page = await context.newPage();
  
  try {
    // Navigate to the app
    console.log('[Screenshot] Navigating to http://localhost:5173...');
    await page.goto('http://localhost:5173', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    
    // Wait for app to load
    await page.waitForTimeout(3000);
    
    // Create screenshots directory
    const screenshotsDir = path.join(process.env.HOME, 'clawd', 'screenshots');
    await fs.mkdir(screenshotsDir, { recursive: true });
    
    // Take dark mode screenshot
    console.log('[Screenshot] Taking dark mode screenshot...');
    await page.screenshot({
      path: path.join(screenshotsDir, 'dashboard-dark.png'),
      fullPage: true
    });
    
    // Switch to light mode
    console.log('[Screenshot] Switching to light mode...');
    
    // Programmatic theme toggle
    await page.evaluate(() => {
      document.documentElement.classList.add('light');
    });
    await page.waitForTimeout(1000);
    
    // Take light mode screenshot
    console.log('[Screenshot] Taking light mode screenshot...');
    await page.screenshot({
      path: path.join(screenshotsDir, 'dashboard-light.png'),
      fullPage: true
    });
    
    console.log('[Screenshot] ✅ Screenshots saved to:', screenshotsDir);
    console.log('  - dashboard-dark.png');
    console.log('  - dashboard-light.png');
    
  } catch (error) {
    console.error('[Screenshot] ❌ Error:', error.message);
    throw error;
  } finally {
    await browser.close();
  }
}

takeScreenshots().catch(console.error);
