#!/usr/bin/env node

/**
 * Manual Color Migration Script
 * 
 * This script manually migrates existing projects to use the new color palette system.
 * It loads projects from the commit log and assigns colors based on their categories.
 */

const fs = require('fs');
const path = require('path');
const { assignColor, getProjectColor, getAllProjectColors, getColorStats } = require('./color-palette');

// Configuration
const DATA_DIR = process.env.DATA_DIR || (fs.existsSync('/data') ? '/data' : path.join(__dirname, 'data'));
const COMMIT_LOG_PATH = path.join(DATA_DIR, 'commit-log.json');
const WEEKLY_PLANS_PATH = path.join(DATA_DIR, 'weekly-plans.json');

console.log('🎨 Manual Color Migration Script\n');

async function migrateProjectColors() {
  try {
    // Load commit log data
    let commitLog = [];
    if (fs.existsSync(COMMIT_LOG_PATH)) {
      const data = fs.readFileSync(COMMIT_LOG_PATH, 'utf8');
      commitLog = JSON.parse(data);
      console.log(`📖 Loaded commit log with ${commitLog.length} days`);
    } else {
      console.log('❌ No commit log found');
      return;
    }

    // Load category data from weekly plans
    let categoryData = {};
    if (fs.existsSync(WEEKLY_PLANS_PATH)) {
      const weeklyPlansData = fs.readFileSync(WEEKLY_PLANS_PATH, 'utf8');
      const weeklyPlans = JSON.parse(weeklyPlansData);
      
      if (weeklyPlans.length > 0) {
        const latestPlan = weeklyPlans[weeklyPlans.length - 1];
        categoryData = latestPlan.planData?.userAnswers || {};
        console.log(`📝 Loaded category data for ${Object.keys(categoryData).length} projects`);
      }
    }

    // Extract unique projects from commit log
    const projects = new Set();
    commitLog.forEach(day => {
      Object.keys(day.projects).forEach(projectName => {
        projects.add(projectName);
      });
    });

    console.log(`\n🔍 Found ${projects.size} unique projects in commit log:`);
    Array.from(projects).forEach(project => console.log(`  - ${project}`));

    // Assign colors to projects
    let migratedCount = 0;
    let skippedCount = 0;

    console.log('\n🎨 Assigning colors to projects...\n');

    for (const projectName of projects) {
      const existingColor = getProjectColor(projectName);
      if (existingColor) {
        console.log(`⏭️  ${projectName}: Already has color ${existingColor.hex} (${existingColor.category})`);
        skippedCount++;
        continue;
      }

      // Get category for this project
      const projectData = categoryData[projectName];
      const category = projectData?.category || 'Miscellaneous / Standalone';
      
      // Assign color
      const color = assignColor(category, projectName);
      console.log(`✅ ${projectName}: Assigned ${color.hex} (${category})`);
      migratedCount++;
    }

    // Show final statistics
    console.log('\n📊 Migration Summary:');
    console.log(`  ✅ Migrated: ${migratedCount} projects`);
    console.log(`  ⏭️  Skipped: ${skippedCount} projects`);
    console.log(`  📈 Total: ${migratedCount + skippedCount} projects`);

    // Show color statistics
    const stats = getColorStats();
    console.log('\n🎨 Color System Statistics:');
    console.log(`  📊 Total palettes: ${stats.totalPalettes}`);
    console.log(`  🎯 Total projects: ${stats.totalProjects}`);
    
    console.log('\n📋 Projects by category:');
    Object.entries(stats.categoryBreakdown).forEach(([category, count]) => {
      console.log(`  ${category}: ${count} projects`);
    });

    // Show all project colors
    console.log('\n🌈 All Project Colors:');
    const allProjectColors = getAllProjectColors();
    Object.entries(allProjectColors).forEach(([projectName, colorData]) => {
      console.log(`  ${projectName}: ${colorData.hex} (${colorData.category})`);
    });

    console.log('\n✅ Color migration completed successfully!');
    console.log('\nTo see the changes:');
    console.log('1. Refresh your browser on the Activity View');
    console.log('2. The projects should now show category-based color bands');
    console.log('3. Projects in the same category will have similar colors');

  } catch (error) {
    console.error('❌ Error during migration:', error);
    process.exit(1);
  }
}

// Run the migration
migrateProjectColors();
