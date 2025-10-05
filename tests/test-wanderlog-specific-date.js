#!/usr/bin/env node

const { 
  getPreviousDayCommits, 
  filterSignificantCommits, 
  generateCommitSummary,
  createWanderlogEntry,
  ensureWanderlogDatabase 
} = require('./wanderlog-processor');

// Override the date logic to use a specific date
async function getCommitsForSpecificDate(targetDate) {
  const { Octokit } = require('@octokit/rest');
  const openai = require('openai');
  require('dotenv').config();

  // Validate environment
  if (!process.env.NOTION_API_KEY) {
    throw new Error('NOTION_API_KEY environment variable not set');
  }
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable not set');
  }
  if (!process.env.GITHUB_TOKEN) {
    throw new Error('GITHUB_TOKEN environment variable not set');
  }

  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
  
  // Parse the target date
  const date = new Date(targetDate);
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  console.log(`🔍 Fetching commits from ${startOfDay.toISOString()} to ${endOfDay.toISOString()}`);
  
  try {
    // Get all repositories
    const repos = await octokit.rest.repos.listForAuthenticatedUser({
      per_page: 100,
      sort: 'updated',
      direction: 'desc'
    });
    
    const allCommits = [];
    
    for (const repo of repos.data) {
      try {
        console.log(`📝 Checking commits in ${repo.full_name}...`);
        
        const commits = await octokit.rest.repos.listCommits({
          owner: repo.owner.login,
          repo: repo.name,
          since: startOfDay.toISOString(),
          until: endOfDay.toISOString(),
          per_page: 100
        });
        
        if (commits.data.length > 0) {
          console.log(`✅ Found ${commits.data.length} commits in ${repo.full_name}`);
          
          for (const commit of commits.data) {
            allCommits.push({
              id: commit.sha,
              message: commit.commit.message,
              author: commit.commit.author.name,
              date: commit.commit.author.date,
              repo: repo.full_name,
              url: commit.html_url
            });
          }
        }
      } catch (error) {
        console.warn(`⚠️ Error fetching commits from ${repo.full_name}:`, error.message);
      }
    }
    
    console.log(`📊 Total commits found: ${allCommits.length}`);
    return allCommits;
  } catch (error) {
    console.error('❌ Error fetching commits:', error);
    return [];
  }
}

async function testSpecificDate(targetDate, createNotionEntry = false) {
  console.log(`🧪 Testing Wanderlog for specific date: ${targetDate}\n`);
  
  try {
    // Get commits for the specific date
    const allCommits = await getCommitsForSpecificDate(targetDate);
    
    if (allCommits.length === 0) {
      console.log('📭 No commits found for the specified date');
      return;
    }
    
    // Filter significant commits
    console.log('\n🔍 Filtering significant commits...');
    const significantCommits = filterSignificantCommits(allCommits);
    console.log(`✅ Filtered to ${significantCommits.length} significant commits (from ${allCommits.length} total)`);
    
    if (significantCommits.length === 0) {
      console.log('📭 No significant commits found for the specified date');
      return;
    }
    
    // Show the commits
    console.log('\n📝 Significant commits found:');
    significantCommits.forEach((commit, index) => {
      console.log(`   ${index + 1}. ${commit.message} (${commit.repo})`);
    });
    
    // Generate summary
    console.log('\n🤖 Generating AI summary...');
    const summary = await generateCommitSummary(significantCommits);
    
    console.log('\n📊 Generated Summary:');
    console.log(`   Title: ${summary.title}`);
    console.log(`   Summary: ${summary.summary}`);
    console.log(`   Insights: ${summary.insights}`);
    console.log(`   Focus Areas: ${summary.focusAreas}`);
    
    // Create Notion entry if requested
    if (createNotionEntry) {
      console.log('\n📝 Creating Notion entry...');
      await createWanderlogEntry(summary, significantCommits);
      console.log('✅ Notion entry created successfully!');
    } else {
      console.log('\n💡 To create a Notion entry, run with --create flag');
    }
    
    console.log('\n🎉 Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Parse command line arguments
function parseArguments() {
  const args = process.argv.slice(2);
  let targetDate = null;
  let createNotionEntry = false;
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--date' && i + 1 < args.length) {
      targetDate = args[i + 1];
      i++; // Skip next argument
    } else if (arg === '--create') {
      createNotionEntry = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Usage: node test-wanderlog-specific-date.js [options]

Options:
  --date YYYY-MM-DD    Specific date to process commits for (required)
  --create            Create Notion entry (optional)
  --help, -h          Show this help message

Examples:
  node test-wanderlog-specific-date.js --date 2024-01-15
  node test-wanderlog-specific-date.js --date 2024-01-15 --create
  node test-wanderlog-specific-date.js --date yesterday
  node test-wanderlog-specific-date.js --date 2024-12-01 --create
      `);
      process.exit(0);
    }
  }
  
  // Handle special date values
  if (targetDate === 'yesterday') {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    targetDate = yesterday.toISOString().split('T')[0];
  } else if (targetDate === 'today') {
    targetDate = new Date().toISOString().split('T')[0];
  }
  
  if (!targetDate) {
    console.error('❌ Error: --date parameter is required');
    console.log('Use --help for usage information');
    process.exit(1);
  }
  
  return { targetDate, createNotionEntry };
}

// Run test if this file is executed directly
if (require.main === module) {
  const { targetDate, createNotionEntry } = parseArguments();
  testSpecificDate(targetDate, createNotionEntry);
}

module.exports = { testSpecificDate, getCommitsForSpecificDate };
