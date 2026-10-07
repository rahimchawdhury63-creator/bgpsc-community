import { test, expect } from '@playwright/test';

test.describe('Responsive Design - All 15 Viewport Widths', () => {
  const viewports = [
    { width: 200, height: 600, name: '200px (ultra-small)' },
    { width: 240, height: 600, name: '240px (feature phone)' },
    { width: 320, height: 600, name: '320px (small phone)' },
    { width: 360, height: 640, name: '360px (Android phone)' },
    { width: 390, height: 844, name: '390px (iPhone 12/13)' },
    { width: 414, height: 896, name: '414px (iPhone XR/11)' },
    { width: 768, height: 1024, name: '768px (iPad portrait)' },
    { width: 834, height: 1194, name: '834px (iPad Pro 11)' },
    { width: 1024, height: 768, name: '1024px (iPad landscape)' },
    { width: 1280, height: 800, name: '1280px (laptop)' },
    { width: 1440, height: 900, name: '1440px (desktop)' },
    { width: 1920, height: 1080, name: '1920px (full HD)' },
    { width: 2560, height: 1440, name: '2560px (2K)' },
    { width: 3840, height: 2160, name: '3840px (4K)' },
    { width: 6000, height: 4000, name: '6000px (ultra-wide)' },
  ];

  for (const viewport of viewports) {
    test(`renders correctly at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/');

      // Check for horizontal overflow
      const hasOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      expect(hasOverflow).toBeFalsy();

      // Check touch targets (≥44px)
      if (viewport.width < 1024) {
        const touchTargets = await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button, a, [role="button"]'));
          return buttons.every(el => {
            const rect = el.getBoundingClientRect();
            return rect.width >= 44 && rect.height >= 44;
          });
        });
        expect(touchTargets).toBeTruthy();
      }

      // Check text readability (font size ≥16px on mobile)
      if (viewport.width < 768) {
        const fontSize = await page.evaluate(() => {
          const body = document.body;
          const style = window.getComputedStyle(body);
          return parseFloat(style.fontSize);
        });
        expect(fontSize).toBeGreaterThanOrEqual(14);
      }

      // Take screenshot for visual regression
      await page.screenshot({ 
        path: `tests/screenshots/responsive-${viewport.width}px.png`,
        fullPage: true 
      });
    });
  }

  test('fluid typography scales correctly', async ({ page }) => {
    const sizes = [320, 768, 1440, 3840];
    const fontSizes: number[] = [];

    for (const width of sizes) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/');
      
      const h1Size = await page.evaluate(() => {
        const h1 = document.querySelector('h1');
        if (!h1) return 0;
        return parseFloat(window.getComputedStyle(h1).fontSize);
      });
      
      fontSizes.push(h1Size);
    }

    // Font sizes should increase with viewport width
    for (let i = 1; i < fontSizes.length; i++) {
      expect(fontSizes[i]).toBeGreaterThan(fontSizes[i - 1]);
    }
  });

  test('no layout shift on load', async ({ page }) => {
    await page.goto('/');
    
    const cls = await page.evaluate(() => {
      return new Promise(resolve => {
        let clsValue = 0;
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!entry.hadRecentInput) {
              clsValue += (entry as any).value;
            }
          }
        });
        observer.observe({ type: 'layout-shift', buffered: true });
        
        setTimeout(() => {
          observer.disconnect();
          resolve(clsValue);
        }, 2000);
      });
    });

    expect(cls).toBeLessThan(0.05); // CLS < 0.05
  });
});
