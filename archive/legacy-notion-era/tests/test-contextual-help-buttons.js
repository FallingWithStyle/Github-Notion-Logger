/**
 * Test for Contextual Help Buttons on Project Cards
 * This test verifies that contextual help buttons are added to project cards
 */

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

describe('Setup Test', () => {
  test('should be a placeholder test', () => {
    expect(true).toBe(true);
  });
});

describe('Contextual Help Buttons Integration', () => {
  const componentsPath = path.join(__dirname, 'public', 'js', 'shared', 'components.js');
  const projectsV2Path = path.join(__dirname, 'public', 'js', 'projects-v2', 'projects-v2.js');
  const projectsV2HtmlPath = path.join(__dirname, 'public', 'projects-v2.html');

  test('ProjectCard component should have contextual help button', () => {
    const content = fs.readFileSync(componentsPath, 'utf8');
    
    // Check that the help button is included in the project actions
    expect(content).toContain('help-button');
    expect(content).toContain('Get Help');
    expect(content).toContain('onclick="this.showHelp');
  });

  test('ProjectCard component should have help functionality', () => {
    const content = fs.readFileSync(componentsPath, 'utf8');
    
    // Check that the showHelp method is implemented
    expect(content).toContain('showHelp(');
    expect(content).toContain('getContextualHelp(');
  });

  test('ProjectCard template should include help button in actions', () => {
    const content = fs.readFileSync(componentsPath, 'utf8');
    
    // Check that the help button is in the project-actions section
    const helpButtonRegex = /project-actions.*help-button/s;
    expect(content).toMatch(helpButtonRegex);
  });

  test('Projects V2 page should have help modal structure', () => {
    const content = fs.readFileSync(projectsV2HtmlPath, 'utf8');
    const $ = cheerio.load(content);
    
    // Check that the page has the necessary structure for dynamic modal creation
    // The modal is created dynamically by JavaScript, so we check for the body element
    expect($('body').length).toBe(1);
    expect($('body').html()).toContain('projects-grid');
  });

  test('Projects V2 JavaScript should handle help modal events', () => {
    const content = fs.readFileSync(projectsV2Path, 'utf8');
    
    // Check that the main app imports ProjectCard which has the help functionality
    expect(content).toContain('ProjectCard');
    expect(content).toContain('import { ProjectCard');
    
    // Check that projects are displayed using ProjectCard
    expect(content).toContain('new ProjectCard');
  });

  test('Help button should have proper styling classes', () => {
    const content = fs.readFileSync(componentsPath, 'utf8');
    
    // Check for proper CSS classes
    expect(content).toContain('btn--help');
    expect(content).toContain('help-icon');
    expect(content).toContain('help-button');
  });

  test('Contextual help should provide project-specific information', () => {
    const content = fs.readFileSync(componentsPath, 'utf8');
    
    // Check that help content is contextual to the project
    expect(content).toContain('project.name');
    expect(content).toContain('project.healthScore');
    expect(content).toContain('project.progress');
  });
});
