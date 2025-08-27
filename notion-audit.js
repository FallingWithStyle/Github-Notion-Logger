const { addMissingShaValues, ensureWeeklyPlanningDatabase, commitFromGithubLogDatabaseId } = require('./notion');
const { Octokit } = require('@octokit/rest');
const { Client } = require('@notionhq/client');
require('dotenv').config();

// Initialize Notion client
const notion = new Client({ auth: process.env.NOTION_API_KEY });

// Initialize GitHub API client
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

// Notion Audit Tool
// Purpose: Audit and fix existing Notion records, not for importing new data

async function fixMidnightCommits(midnightCommitsList) {
  console.log('\n🔧 Attempting to fix midnight commits with proper timestamps...');
  
  if (!process.env.GITHUB_TOKEN) {
    console.log('⚠️ No GitHub token found, cannot fetch original commit data');
    return { fixed: 0, errors: 0, skipped: 0 };
  }
  
  let fixed = 0;
  let errors = 0;
  let skipped = 0;
  
  for (const commit of midnightCommitsList) {
    try {
      console.log(`🔍 Fetching original commit data for ${commit.sha}...`);
      
      // Extract owner/repo from project name
      const projectName = commit.project;
      
      // Try to find the repository by searching through common patterns
      let owner = process.env.GITHUB_OWNER;
      let repo = projectName;
      
      if (!owner) {
        console.log(`⚠️ No GITHUB_OWNER set, skipping ${commit.sha}`);
        skipped++;
        continue;
      }
      
      // Skip if no SHA (can't fetch from GitHub)
      if (!commit.sha || commit.sha === 'No SHA') {
        console.log(`⚠️ No SHA available for commit, skipping`);
        skipped++;
        continue;
      }
      
      try {
        // Fetch the original commit from GitHub
        const response = await octokit.repos.getCommit({
          owner,
          repo,
          ref: commit.sha
        });
        
        const originalCommit = response.data;
        const originalTimestamp = originalCommit.commit.author.date;
        
        console.log(`📅 Original timestamp: ${originalTimestamp}`);
        
        // Check if the original timestamp is different from midnight
        const originalDate = new Date(originalTimestamp);
        if (originalDate.getUTCHours() === 0 && originalDate.getUTCMinutes() === 0 && originalDate.getUTCSeconds() === 0) {
          console.log(`⚠️ Original commit is also at midnight, skipping ${commit.sha}`);
          skipped++;
          continue;
        }
        
        // Update the Notion page with the correct timestamp
        await notion.pages.update({
          page_id: commit.id,
          properties: {
            "Date": {
              date: { start: originalTimestamp }
            }
          }
        });
        
        console.log(`✅ Fixed timestamp for ${commit.sha}: ${originalTimestamp}`);
        fixed++;
        
        // Small delay to be respectful to the API
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (githubError) {
        if (githubError.status === 404) {
          console.log(`⚠️ Commit ${commit.sha} not found in ${owner}/${repo}, may be from a different repository`);
          console.log(`   Project: ${projectName}, SHA: ${commit.sha}`);
          skipped++;
        } else if (githubError.status === 403) {
          console.log(`⚠️ Access denied to ${owner}/${repo}, may be private or insufficient permissions`);
          skipped++;
        } else if (githubError.status === 401) {
          console.log(`⚠️ GitHub authentication failed, check your GITHUB_TOKEN`);
          errors++;
          break; // Stop processing if auth fails
        } else {
          console.error(`❌ GitHub API error for ${commit.sha}:`, githubError.message);
          errors++;
        }
      }
      
    } catch (error) {
      console.error(`❌ Error fixing commit ${commit.sha}:`, error.message);
      errors++;
    }
  }
  
  console.log(`\n📊 Fix Summary:`);
  console.log(`✅ Fixed: ${fixed}`);
  console.log(`⏭️ Skipped: ${skipped}`);
  console.log(`❌ Errors: ${errors}`);
  
  return { fixed, errors, skipped };
}

async function checkDateStructure() {
  console.log('📅 Checking date structure and uniqueness...');
  
  try {
    if (!commitFromGithubLogDatabaseId) {
      console.log('⚠️ No commit database ID found, skipping date structure check');
      return { midnightCommitsList: [], duplicateDatesList: [] };
    }
    
    let hasMore = true;
    let startCursor = undefined;
    let pageCount = 0;
    let totalChecked = 0;
    let midnightCommits = 0;
    let duplicateDates = 0;
    let missingTime = 0;
    const maxPages = 50;
    
    // Track dates to check for duplicates
    const dateMap = new Map(); // date -> array of commit IDs
    const midnightCommitsList = [];
    const duplicateDatesList = [];
    
    while (hasMore && pageCount < maxPages) {
      pageCount++;
      console.log(`📄 Checking date structure page ${pageCount}...`);
      
      const response = await notion.databases.query({
        database_id: commitFromGithubLogDatabaseId,
        page_size: 100,
        start_cursor: startCursor,
        sorts: [
          {
            property: "Date",
            direction: "ascending"
          }
        ]
      });
      
      if (response.results.length === 0) {
        break;
      }
      
      // Process each commit
      for (const page of response.results) {
        totalChecked++;
        
        try {
          const commitDate = page.properties["Date"]?.date?.start;
          const commitMessage = page.properties["Commits"]?.rich_text?.[0]?.plain_text;
          const projectName = page.properties["Project Name"]?.title?.[0]?.plain_text;
          const sha = page.properties["SHA"]?.rich_text?.[0]?.plain_text;
          
          if (commitDate) {
            const date = new Date(commitDate);
            
            // Check if commit is at midnight (00:00:00)
            if (date.getUTCHours() === 0 && date.getUTCMinutes() === 0 && date.getUTCSeconds() === 0) {
              midnightCommits++;
              midnightCommitsList.push({
                id: page.id,
                message: commitMessage?.substring(0, 50) || 'Unknown',
                project: projectName || 'Unknown',
                date: commitDate,
                sha: sha?.substring(0, 8) || 'No SHA'
              });
            }
            
            // Check for missing time (date only, no time component)
            if (commitDate.length === 10) { // YYYY-MM-DD format only
              missingTime++;
            }
            
            // Track dates for duplicate detection
            const dateKey = date.toISOString();
            if (!dateMap.has(dateKey)) {
              dateMap.set(dateKey, []);
            }
            dateMap.get(dateKey).push({
              id: page.id,
              message: commitMessage?.substring(0, 50) || 'Unknown',
              project: projectName || 'Unknown',
              sha: sha?.substring(0, 8) || 'No SHA'
            });
          }
        } catch (error) {
          console.error(`❌ Error processing page ${page.id}:`, error.message);
        }
      }
      
      hasMore = response.has_more;
      startCursor = response.next_cursor;
      
      // Small delay between pages
      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    // Check for duplicate dates
    for (const [date, commits] of dateMap.entries()) {
      if (commits.length > 1) {
        duplicateDates += commits.length - 1;
        duplicateDatesList.push({
          date: date,
          commits: commits
        });
      }
    }
    
    // Report findings
    console.log(`\n📊 Date Structure Check Results:`);
    console.log(`🔍 Total commits checked: ${totalChecked}`);
    console.log(`🕛 Commits at midnight (00:00:00): ${midnightCommits}`);
    console.log(`📅 Commits with duplicate dates: ${duplicateDates}`);
    console.log(`⏰ Commits missing time component: ${missingTime}`);
    
    if (midnightCommits > 0) {
      console.log(`\n⚠️ Midnight commits detected (likely missing time information):`);
      midnightCommitsList.slice(0, 10).forEach(commit => {
        console.log(`   - ${commit.project}: ${commit.message}... (${commit.date}) [${commit.sha}]`);
      });
      if (midnightCommitsList.length > 10) {
        console.log(`   ... and ${midnightCommitsList.length - 10} more`);
      }
      
      // Ask user if they want to fix the midnight commits
      if (process.env.GITHUB_TOKEN) {
        console.log(`\n🔧 Found ${midnightCommits} commits that can potentially be fixed with proper timestamps`);
        console.log('💡 Run with --fix-dates to automatically fix these commits using GitHub data');
      } else {
        console.log(`\n⚠️ No GitHub token found. Set GITHUB_TOKEN to enable automatic fixing of midnight commits`);
      }
    }
    
    if (duplicateDatesList.length > 0) {
      console.log(`\n⚠️ Duplicate dates detected:`);
      duplicateDatesList.slice(0, 5).forEach(duplicate => {
        console.log(`   ${duplicate.date}: ${duplicate.commits.length} commits`);
        duplicate.commits.forEach(commit => {
          console.log(`     - ${commit.project}: ${commit.message}... [${commit.sha}]`);
        });
      });
      if (duplicateDatesList.length > 5) {
        console.log(`   ... and ${duplicateDatesList.length - 5} more duplicate dates`);
      }
    }
    
    if (midnightCommits > 0 || duplicateDates > 0) {
      console.log(`\n💡 Recommendations:`);
      if (midnightCommits > 0) {
        console.log(`   - Re-run backfill for repositories with midnight commits to get proper timestamps`);
        if (process.env.GITHUB_TOKEN) {
          console.log(`   - Or use --fix-dates to automatically fix existing midnight commits`);
        }
      }
      if (duplicateDates > 0) {
        console.log(`   - Check for duplicate commits that may have been imported multiple times`);
        console.log(`   - Consider using the deduplication tools to clean up duplicates`);
      }
    } else {
      console.log(`\n✅ Date structure looks good! All commits have unique timestamps with proper time information.`);
    }
    
    return { midnightCommitsList, duplicateDatesList };
    
  } catch (error) {
    console.error('❌ Error checking date structure:', error.message);
    return { midnightCommitsList: [], duplicateDatesList: [] };
  }
}

async function auditNotionDatabase(fixDates = false) {
  console.log('🔍 Notion Database Audit Tool');
  console.log('=============================\n');
  
  try {
    // Check for missing SHA values
    console.log('1️⃣ Checking for commits without SHA values...');
    await addMissingShaValues();
    
    console.log('\n2️⃣ Checking weekly planning database...');
    await ensureWeeklyPlanningDatabase();
    
    console.log('\n3️⃣ Checking date structure and uniqueness...');
    const dateResults = await checkDateStructure();
    
    // Fix midnight commits if requested
    if (fixDates && dateResults.midnightCommitsList.length > 0) {
      console.log('\n4️⃣ Fixing midnight commits with proper timestamps...');
      const fixResults = await fixMidnightCommits(dateResults.midnightCommitsList);
      
      console.log(`\n📊 Fix Results:`);
      console.log(`✅ Fixed: ${fixResults.fixed}`);
      console.log(`⏭️ Skipped: ${fixResults.skipped}`);
      console.log(`❌ Errors: ${fixResults.errors}`);
      
      if (fixResults.fixed > 0) {
        console.log(`\n🎉 Successfully fixed ${fixResults.fixed} commits with proper timestamps!`);
      }
      
      if (fixResults.skipped > 0) {
        console.log(`\n💡 ${fixResults.skipped} commits were skipped (not found, private repo, or already at midnight)`);
      }
    }
    
    console.log('\n✅ Audit completed successfully!');
    
  } catch (error) {
    console.error('❌ Audit failed:', error.message);
    process.exit(1);
  }
}

// Run the audit if this script is executed directly
if (require.main === module) {
  // Parse command line arguments
  const args = process.argv.slice(2);
  
  // Check for --fix-dates argument
  const fixDates = args.includes('--fix-dates');
  
  // Show help if requested
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Notion Audit Tool

Purpose: Audit and fix existing Notion records (NOT for importing new data)

Usage: node notion-audit.js [options]

Options:
  -h, --help           Show this help message
  --fix-dates          Attempt to fix midnight commits by fetching original timestamps from GitHub

What this tool does:
  - Checks for commits without SHA values
  - Ensures weekly planning database exists and has correct schema
  - Reports on data quality issues
  - Provides recommendations for fixing problems
  - Can automatically fix midnight commits using GitHub data (with --fix-dates)

Examples:
  node notion-audit.js                    # Run full audit
  node notion-audit.js --fix-dates      # Run full audit and attempt to fix midnight commits

Note: This tool is separate from the backfill tool and is designed
      specifically for maintaining existing Notion data quality.
      
Requirements for --fix-dates:
  - GITHUB_TOKEN environment variable must be set
  - GITHUB_OWNER environment variable must be set
`);
    process.exit(0);
  }
  
  if (fixDates && !process.env.GITHUB_TOKEN) {
    console.error('❌ Error: --fix-dates requires GITHUB_TOKEN environment variable to be set');
    console.error('   Please set GITHUB_TOKEN to enable automatic fixing of midnight commits');
    process.exit(1);
  }
  
  if (fixDates && !process.env.GITHUB_OWNER) {
    console.error('❌ Error: --fix-dates requires GITHUB_OWNER environment variable to be set');
    console.error('   Please set GITHUB_OWNER to enable automatic fixing of midnight commits');
    process.exit(1);
  }
  
  auditNotionDatabase(fixDates);
}

module.exports = { auditNotionDatabase };
