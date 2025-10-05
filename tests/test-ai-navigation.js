/**
 * Test for AI Assistant Navigation Integration
 * This test verifies that AI Assistant tab is added to navigation in existing HTML files
 */

const fs = require('fs');
const path = require('path');

describe('AI Assistant Navigation Integration', () => {
  const htmlFiles = [
    'public/index.html',
    'public/week.html',
    'public/projects.html',
    'public/projects-v2.html',
    'public/progress.html',
    'public/progress-v2.html'
  ];

  test('all HTML files should exist', () => {
    htmlFiles.forEach(filePath => {
      expect(fs.existsSync(path.join(__dirname, filePath))).toBe(true);
    });
  });

  test('all HTML files should have AI Assistant navigation link', () => {
    htmlFiles.forEach(filePath => {
      const fullPath = path.join(__dirname, filePath);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        expect(content).toContain('AI Assistant');
        expect(content).toContain('ai-chat.html');
      }
    });
  });

  test('all HTML files should have proper navigation structure', () => {
    htmlFiles.forEach(filePath => {
      const fullPath = path.join(__dirname, filePath);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        expect(content).toContain('nav-links');
        expect(content).toContain('nav-link');
      }
    });
  });

  test('AI Assistant link should have correct href', () => {
    htmlFiles.forEach(filePath => {
      const fullPath = path.join(__dirname, filePath);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        expect(content).toContain('href="/ai-chat.html"');
      }
    });
  });

  test('AI Assistant link should have proper icon', () => {
    htmlFiles.forEach(filePath => {
      const fullPath = path.join(__dirname, filePath);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        expect(content).toContain('🤖');
      }
    });
  });
});
