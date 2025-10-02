/**
 * Test: HTML Refactoring Implementation
 * 
 * This test verifies that HTML files have been properly refactored
 * to use the shared CSS framework and component structure.
 */

const fs = require('fs');
const path = require('path');

describe('HTML Refactoring Implementation', () => {
  const publicDir = path.join(__dirname, 'public');
  
  test('should have HTML files under 120 lines', () => {
    const htmlFiles = [
      'progress.html',
      'projects.html', 
      'progress-v2.html',
      'projects-v2.html',
      'index.html',
      'week.html'
    ];
    
    htmlFiles.forEach(file => {
      const filePath = path.join(publicDir, file);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n').length;
        expect(lines).toBeLessThanOrEqual(120);
      }
    });
  });
  
  test('should import shared CSS framework', () => {
    const htmlFiles = [
      'progress-v2.html',
      'projects-v2.html'
    ];
    
    htmlFiles.forEach(file => {
      const filePath = path.join(publicDir, file);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Should import shared CSS framework
        expect(content).toContain('href="/css/base.css"');
        expect(content).toContain('href="/css/components.css"');
        expect(content).toContain('href="/css/utilities.css"');
      }
    });
  });
  
  test('should use ES6 module imports for JavaScript', () => {
    const htmlFiles = [
      'progress-v2.html',
      'projects-v2.html'
    ];
    
    htmlFiles.forEach(file => {
      const filePath = path.join(publicDir, file);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Should use ES6 module imports
        expect(content).toContain('type="module"');
        expect(content).toContain('src="/js/shared/');
      }
    });
  });
  
  test('should not have inline CSS styles', () => {
    const htmlFiles = [
      'progress-v2.html',
      'projects-v2.html'
    ];
    
    htmlFiles.forEach(file => {
      const filePath = path.join(publicDir, file);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Should not have inline styles
        expect(content).not.toContain('<style>');
        expect(content).not.toContain('style="');
      }
    });
  });
  
  test('should have consistent component structure', () => {
    const htmlFiles = [
      'progress-v2.html',
      'projects-v2.html'
    ];
    
    htmlFiles.forEach(file => {
      const filePath = path.join(publicDir, file);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Should have consistent structure
        expect(content).toContain('class="header"');
        expect(content).toContain('class="nav-links"');
        expect(content).toContain('class="controls"');
        expect(content).toContain('class="btn"');
      }
    });
  });
});
