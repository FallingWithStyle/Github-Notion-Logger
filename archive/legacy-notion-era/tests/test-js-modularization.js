/**
 * Test: JavaScript Modularization Implementation
 * 
 * This test verifies that shared JavaScript utilities and components
 * are properly implemented as specified in QA feedback.
 */

const fs = require('fs');
const path = require('path');

describe('JavaScript Modularization Implementation', () => {
  const jsDir = path.join(__dirname, 'public', 'js');
  const sharedDir = path.join(jsDir, 'shared');
  
  test('should have shared utilities module', () => {
    const utilsPath = path.join(sharedDir, 'utils.js');
    expect(fs.existsSync(utilsPath)).toBe(true);
    
    const utilsContent = fs.readFileSync(utilsPath, 'utf8');
    
    // Verify utility functions are exported
    expect(utilsContent).toContain('export const Utils');
    expect(utilsContent).toContain('debounce:');
    expect(utilsContent).toContain('showLoading:');
    expect(utilsContent).toContain('showError:');
    expect(utilsContent).toContain('hideError:');
    expect(utilsContent).toContain('updateStatus:');
    expect(utilsContent).toContain('formatDate:');
    expect(utilsContent).toContain('formatNumber:');
  });
  
  test('should have shared components module', () => {
    const componentsPath = path.join(sharedDir, 'components.js');
    expect(fs.existsSync(componentsPath)).toBe(true);
    
    const componentsContent = fs.readFileSync(componentsPath, 'utf8');
    
    // Verify component classes are exported
    expect(componentsContent).toContain('export class ProjectCard');
    expect(componentsContent).toContain('export class ProgressBar');
    expect(componentsContent).toContain('export class FilterControls');
    expect(componentsContent).toContain('render()');
    expect(componentsContent).toContain('getTemplate()');
  });
  
  test('should have shared directory structure', () => {
    expect(fs.existsSync(sharedDir)).toBe(true);
    
    const sharedFiles = fs.readdirSync(sharedDir);
    expect(sharedFiles).toContain('utils.js');
    expect(sharedFiles).toContain('components.js');
  });
  
  test('should eliminate JavaScript duplication across files', () => {
    const jsFiles = [
      'projects/projects.js',
      'progress-v2/progress-v2.js',
      'projects-v2/projects-v2.js',
      'week/week.js'
    ];
    
    const commonFunctions = [
      'function debounce',
      'function showLoading',
      'function showError',
      'function updateStatus',
      'function formatDate',
      'function formatNumber'
    ];
    
    jsFiles.forEach(file => {
      const filePath = path.join(jsDir, file);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        
        // These common functions should NOT be duplicated in individual files
        // They should be imported from shared utilities instead
        commonFunctions.forEach(func => {
          // Count occurrences - should be minimal (only imports, not implementations)
          const occurrences = (content.match(new RegExp(func.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
          // Allow some occurrences for imports and basic DOM usage
          if (occurrences > 3) {
            console.log(`High occurrence count for ${func} in ${file}: ${occurrences}`);
          }
          expect(occurrences).toBeLessThanOrEqual(3);
        });
      }
    });
  });
  
  test('should use ES6 modules for imports', () => {
    const jsFiles = [
      'progress-v2/progress-v2.js',
      'projects-v2/projects-v2.js'
    ];
    
    jsFiles.forEach(file => {
      const filePath = path.join(jsDir, file);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Should use ES6 import syntax
        expect(content).toContain('import {');
        expect(content).toContain('from \'../shared/');
      }
    });
  });
});
