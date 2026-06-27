#!/usr/bin/env node

/**
 * Test script for the Color Palette System
 * 
 * This script demonstrates how to use the color palette system
 * to assign colors to projects based on their categories.
 */

const { 
  generatePalette, 
  assignColor, 
  getProjectColor, 
  updateProjectColor,
  getAllPalettes,
  getAllProjectColors,
  getColorStats,
  clearColorData
} = require('./color-palette');

console.log('🎨 Color Palette System Test\n');

// Clear any existing data for clean test
console.log('🧹 Clearing existing color data...');
clearColorData();

// Example 1: Generate palettes for different categories
console.log('\n📊 Example 1: Generating color palettes for different categories\n');

const categories = [
  'Writing & Story Tools',
  'Infrastructure & Utilities', 
  'Avoros (Shared Fantasy/Game World)',
  'Miscellaneous / Standalone',
  'Development',
  'Research'
];

categories.forEach(category => {
  console.log(`Generating palette for: ${category}`);
  const palette = generatePalette(category);
  console.log(`  Generated ${palette.length} colors:`);
  palette.forEach((color, index) => {
    console.log(`    ${index + 1}. ${color.hex} (HSL: ${color.hsl.h}°, ${color.hsl.s}%, ${color.hsl.l}%)`);
  });
  console.log('');
});

// Example 2: Assign colors to projects
console.log('📝 Example 2: Assigning colors to projects\n');

const projects = [
  { name: 'Magic-Quill', category: 'Writing & Story Tools' },
  { name: 'glyph-server', category: 'Infrastructure & Utilities' },
  { name: 'Friend-Party', category: 'Avoros (Shared Fantasy/Game World)' },
  { name: 'Kitch', category: 'Miscellaneous / Standalone' },
  { name: 'Daily-Dungeon', category: 'Avoros (Shared Fantasy/Game World)' },
  { name: 'VoiceHub', category: 'Writing & Story Tools' },
  { name: 'glyph-legal', category: 'Infrastructure & Utilities' },
  { name: 'Audventr', category: 'Writing & Story Tools' },
  { name: 'Crawler-s-Contract', category: 'Avoros (Shared Fantasy/Game World)' },
  { name: 'Github-Notion-Logger', category: 'Infrastructure & Utilities' }
];

projects.forEach(project => {
  const color = assignColor(project.category, project.name);
  console.log(`${project.name} (${project.category}): ${color.hex}`);
});

// Example 3: Show color assignments by category
console.log('\n🎯 Example 3: Color assignments grouped by category\n');

const allProjectColors = getAllProjectColors();
const byCategory = {};

Object.entries(allProjectColors).forEach(([projectName, colorData]) => {
  const category = colorData.category;
  if (!byCategory[category]) {
    byCategory[category] = [];
  }
  byCategory[category].push({ projectName, color: colorData.hex });
});

Object.entries(byCategory).forEach(([category, projects]) => {
  console.log(`${category}:`);
  projects.forEach(({ projectName, color }) => {
    console.log(`  • ${projectName}: ${color}`);
  });
  console.log('');
});

// Example 4: Update a project's color
console.log('🔄 Example 4: Updating project color\n');

console.log('Updating Magic-Quill to use a different color...');
const newColor = updateProjectColor('Magic-Quill', 'Writing & Story Tools');
console.log(`New color for Magic-Quill: ${newColor.hex}`);

// Example 5: Get color statistics
console.log('\n📈 Example 5: Color system statistics\n');

const stats = getColorStats();
console.log('Color System Statistics:');
console.log(`  Total palettes: ${stats.totalPalettes}`);
console.log(`  Total projects: ${stats.totalProjects}`);
console.log('\nCategory breakdown:');
Object.entries(stats.categoryBreakdown).forEach(([category, count]) => {
  console.log(`  ${category}: ${count} projects`);
});

console.log('\nPalette breakdown:');
Object.entries(stats.paletteBreakdown).forEach(([category, colorCount]) => {
  console.log(`  ${category}: ${colorCount} colors available`);
});

// Example 6: Test fallback for unknown category
console.log('\n🔍 Example 6: Testing fallback for unknown category\n');

const unknownProject = assignColor('Unknown Category', 'Test-Project');
console.log(`Unknown category project color: ${unknownProject.hex}`);

// Example 7: Show all available palettes
console.log('\n🌈 Example 7: All available palettes\n');

const allPalettes = getAllPalettes();
Object.entries(allPalettes).forEach(([category, palette]) => {
  console.log(`${category}:`);
  palette.forEach((color, index) => {
    console.log(`  ${index + 1}. ${color.hex}`);
  });
  console.log('');
});

console.log('✅ Color Palette System test completed successfully!');
console.log('\nTo use this system in your application:');
console.log('1. Import the color-palette module');
console.log('2. Call assignColor(category, projectName) to get a color for a project');
console.log('3. Use the returned hex color in your UI');
console.log('4. Colors are automatically persisted and loaded on restart');
