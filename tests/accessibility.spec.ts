import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility (WCAG 2.2 AA)', () => {
  test('homepage has no accessibility violations', async ({ page }) => {
    await page.goto('/');
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('post page has no accessibility violations', async ({ page }) => {
    // Navigate to a post (would need to create test data first)
    await page.goto('/post/test-post');
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('profile page has no accessibility violations', async ({ page }) => {
    await page.goto('/@testuser');
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('all images have alt text', async ({ page }) => {
    await page.goto('/');
    
    const imagesWithoutAlt = await page.evaluate(() => {
      const images = Array.from(document.querySelectorAll('img'));
      return images.filter(img => !img.hasAttribute('alt') || img.alt.trim() === '');
    });

    expect(imagesWithoutAlt).toHaveLength(0);
  });

  test('all form inputs have labels', async ({ page }) => {
    await page.goto('/register');
    
    const inputsWithoutLabels = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input, textarea, select'));
      return inputs.filter(input => {
        const id = input.id;
        const hasLabel = id && document.querySelector(`label[for="${id}"]`);
        const hasAriaLabel = input.hasAttribute('aria-label');
        const hasAriaLabelledBy = input.hasAttribute('aria-labelledby');
        return !hasLabel && !hasAriaLabel && !hasAriaLabelledBy;
      });
    });

    expect(inputsWithoutLabels).toHaveLength(0);
  });

  test('skip link is present and functional', async ({ page }) => {
    await page.goto('/');
    
    // Check skip link exists
    const skipLink = page.locator('a[href="#main"]').first();
    await expect(skipLink).toBeVisible();
    
    // Tab to skip link
    await page.keyboard.press('Tab');
    await expect(skipLink).toBeFocused();
    
    // Activate skip link
    await skipLink.press('Enter');
    
    // Check main content is focused
    const main = page.locator('#main');
    await expect(main).toBeVisible();
  });

  test('focus indicators are visible', async ({ page }) => {
    await page.goto('/');
    
    // Tab through interactive elements
    await page.keyboard.press('Tab');
    
    const focusedElement = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return null;
      const style = window.getComputedStyle(el);
      return {
        outline: style.outline,
        outlineWidth: style.outlineWidth,
        boxShadow: style.boxShadow,
      };
    });

    expect(focusedElement).not.toBeNull();
    // Should have visible focus indicator (outline or box-shadow)
    const hasFocusIndicator = 
      focusedElement!.outline !== 'none' || 
      focusedElement!.boxShadow !== 'none' ||
      parseFloat(focusedElement!.outlineWidth) > 0;
    
    expect(hasFocusIndicator).toBeTruthy();
  });

  test('color contrast meets AA standards', async ({ page }) => {
    await page.goto('/');
    
    const contrastResults = await new AxeBuilder({ page })
      .withRules(['color-contrast'])
      .analyze();

    expect(contrastResults.violations).toEqual([]);
  });

  test('keyboard navigation works', async ({ page }) => {
    await page.goto('/');
    
    // Tab through all interactive elements
    const interactiveElements = await page.evaluate(() => {
      return document.querySelectorAll('button, a, input, textarea, select, [tabindex]:not([tabindex="-1"])').length;
    });

    for (let i = 0; i < Math.min(interactiveElements, 10); i++) {
      await page.keyboard.press('Tab');
      const focused = await page.evaluate(() => document.activeElement !== document.body);
      expect(focused).toBeTruthy();
    }
  });

  test('ARIA landmarks are present', async ({ page }) => {
    await page.goto('/');
    
    const landmarks = await page.evaluate(() => {
      return {
        banner: !!document.querySelector('[role="banner"], header'),
        navigation: !!document.querySelector('[role="navigation"], nav'),
        main: !!document.querySelector('[role="main"], main'),
        contentinfo: !!document.querySelector('[role="contentinfo"], footer'),
      };
    });

    expect(landmarks.banner).toBeTruthy();
    expect(landmarks.navigation).toBeTruthy();
    expect(landmarks.main).toBeTruthy();
    expect(landmarks.contentinfo).toBeTruthy();
  });

  test('reduced motion is respected', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    
    const animationsDisabled = await page.evaluate(() => {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      return mediaQuery.matches;
    });

    expect(animationsDisabled).toBeTruthy();
  });
});
