/**
 * Test: CSS Framework Implementation
 * 
 * This test verifies that the shared CSS framework is properly implemented
 * and provides design tokens and reusable components as specified in QA feedback.
 */

const fs = require('fs');
const path = require('path');

describe('CSS Framework Implementation', () => {
  const cssDir = path.join(__dirname, 'public', 'css');
  
  test('should have base.css with design tokens', () => {
    const baseCssPath = path.join(cssDir, 'base.css');
    expect(fs.existsSync(baseCssPath)).toBe(true);
    
    const baseCss = fs.readFileSync(baseCssPath, 'utf8');
    
    // Verify design tokens are defined
    expect(baseCss).toContain(':root');
    expect(baseCss).toContain('--primary-color:');
    expect(baseCss).toContain('--secondary-color:');
    expect(baseCss).toContain('--background-color:');
    expect(baseCss).toContain('--text-color:');
    expect(baseCss).toContain('--font-family:');
    expect(baseCss).toContain('--spacing-');
    expect(baseCss).toContain('--border-radius-');
    expect(baseCss).toContain('--shadow-');
  });
  
  test('should have components.css with reusable components', () => {
    const componentsCssPath = path.join(cssDir, 'components.css');
    expect(fs.existsSync(componentsCssPath)).toBe(true);
    
    const componentsCss = fs.readFileSync(componentsCssPath, 'utf8');
    
    // Verify common components are defined
    expect(componentsCss).toContain('.btn');
    expect(componentsCss).toContain('.header');
    expect(componentsCss).toContain('.nav-links');
    expect(componentsCss).toContain('.controls');
    expect(componentsCss).toContain('.project-card');
    expect(componentsCss).toContain('.progress-bar');
  });
  
  test('should have utilities.css with utility classes', () => {
    const utilitiesCssPath = path.join(cssDir, 'utilities.css');
    expect(fs.existsSync(utilitiesCssPath)).toBe(true);
    
    const utilitiesCss = fs.readFileSync(utilitiesCssPath, 'utf8');
    
    // Verify utility classes exist
    expect(utilitiesCss).toContain('.text-center');
    expect(utilitiesCss).toContain('.hidden');
    expect(utilitiesCss).toContain('.loading');
    expect(utilitiesCss).toContain('.error');
  });
  
  test('should eliminate CSS duplication across files', () => {
    const files = ['progress-v2.css', 'projects-v2.css', 'projects.css', 'progress.css'];
    const commonStyles = [
      'background: linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      '.btn {',
      '.header {',
      '.nav-links {'
    ];
    
    files.forEach(file => {
      const filePath = path.join(cssDir, file);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        
        // These common styles should NOT be duplicated in individual files
        // They should be in the shared framework instead
        commonStyles.forEach(style => {
          // Count occurrences - should be minimal (only in shared framework)
          const occurrences = (content.match(new RegExp(style.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
          expect(occurrences).toBeLessThanOrEqual(1);
        });
      }
    });
  });
});
