const { Octokit } = require('@octokit/rest');
const inquirer = require('inquirer');
const { logCommitsToNotion, getMostRecentCommitDate } = require('./notion');
require('dotenv').config();

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

async function getAllRepositories(owner) {
  console.log(`Fetching all repositories for ${owner}...`);
  
  const repos = [];
  let page = 1;
  const perPage = 100;
  
  try {
    while (true) {
      // Try to get all repos (including private ones) that the authenticated user has access to
      let response;
      try {
        // First try to get repos for the authenticated user (includes private repos)
        response = await octokit.repos.listForAuthenticatedUser({
          per_page: perPage,
          page,
          sort: 'updated',
          direction: 'desc',
        });
        
        // Filter to only repos owned by the specified owner
        const ownerRepos = response.data.filter(repo => 
          repo.owner.login === owner || repo.owner.login.toLowerCase() === owner.toLowerCase()
        );
        
        if (ownerRepos.length === 0 && response.data.length < perPage) {
          break;
        }
        
        // Filter out forked repositories if desired
        const nonForkRepos = ownerRepos.filter(repo => !repo.fork);
        repos.push(...nonForkRepos);
        
        if (response.data.length < perPage) {
          break;
        }
        
      } catch (error) {
        // Fallback to public repos only if authenticated user method fails
        console.log('Falling back to public repositories only...');
        response = await octokit.repos.listForUser({
          username: owner,
          per_page: perPage,
          page,
          sort: 'updated',
          direction: 'desc',
        });
        
        // Filter out forked repositories if desired
        const nonForkRepos = response.data.filter(repo => !repo.fork);
        repos.push(...nonForkRepos);
        
        if (response.data.length < perPage) {
          break;
        }
      }
      
      page++;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`Found ${repos.length} repositories`);
    return repos;
  } catch (error) {
    console.error('Error fetching repositories:', error.message);
    throw error;
  }
}

async function getCommitsFromLastNMonths(owner, repo, months = 6) {
  const nMonthsAgo = new Date();
  nMonthsAgo.setMonth(nMonthsAgo.getMonth() - months);
  
  console.log(`Fetching commits from ${owner}/${repo} since ${nMonthsAgo.toISOString()}`);
  
  const commits = [];
  let page = 1;
  const perPage = 100;
  
  try {
    while (true) {
      console.log(`Fetching page ${page}...`);
      
      const response = await octokit.repos.listCommits({
        owner,
        repo,
        per_page: perPage,
        page,
        since: nMonthsAgo.toISOString(),
      });
      
      if (response.data.length === 0) {
        break;
      }
      
      // Transform GitHub API response to match webhook format
      const transformedCommits = response.data.map(commit => ({
        id: commit.sha,
        message: commit.commit.message,
        url: commit.html_url,
        author: {
          name: commit.commit.author.name,
          email: commit.commit.author.email,
        },
        timestamp: commit.commit.author.date,
        added: [],
        removed: [],
        modified: [],
      }));
      
      commits.push(...transformedCommits);
      
      if (response.data.length < perPage) {
        break;
      }
      
      page++;
      
      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`Found ${commits.length} commits from the last ${months} months`);
    return commits;
  } catch (error) {
    console.error('Error fetching commits:', error.message);
    throw error;
  }
}

async function getCommitsSinceDate(owner, repo, sinceDate) {
  console.log(`Fetching commits from ${owner}/${repo} since ${sinceDate.toISOString()}`);
  
  const commits = [];
  let page = 1;
  const perPage = 100;
  
  try {
    while (true) {
      console.log(`Fetching page ${page}...`);
      
      const response = await octokit.repos.listCommits({
        owner,
        repo,
        per_page: perPage,
        page,
        since: sinceDate.toISOString(),
      });
      
      if (response.data.length === 0) {
        break;
      }
      
      // Transform GitHub API response to match webhook format
      const transformedCommits = response.data.map(commit => ({
        id: commit.sha,
        message: commit.commit.message,
        url: commit.html_url,
        author: {
          name: commit.commit.author.name,
          email: commit.commit.author.email,
        },
        timestamp: commit.commit.author.date,
        added: [],
        removed: [],
        modified: [],
      }));
      
      commits.push(...transformedCommits);
      
      if (response.data.length < perPage) {
        break;
      }
      
      page++;
      
      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`Found ${commits.length} commits since ${sinceDate.toISOString()}`);
    return commits;
  } catch (error) {
    console.error('Error fetching commits:', error.message);
    throw error;
  }
}

async function selectRepositories(owner) {
  console.log(`\nFetching repositories for ${owner}...`);
  
  try {
    const allRepos = await getAllRepositories(owner);
    
    if (allRepos.length === 0) {
      console.log('No repositories found.');
      return [];
    }
    
    // Create choices for the selection
    const choices = [
      { name: 'All repositories', value: 'all' },
      ...allRepos.map(repo => ({
        name: `${repo.name} ${repo.private ? '(private)' : '(public)'}`,
        value: repo.name,
        repo: repo
      }))
    ];
    
    const { selectedRepos } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedRepos',
        message: 'Select repositories to backfill:',
        choices: choices,
        pageSize: 20
      }
    ]);
    
    if (selectedRepos === 'all') {
      return allRepos;
    } else {
      // Find the selected repo object
      const selectedRepo = allRepos.find(repo => repo.name === selectedRepos);
      return selectedRepo ? [selectedRepo] : [];
    }
    
  } catch (error) {
    console.error('Error selecting repositories:', error.message);
    return [];
  }
}

async function backfillCommits(months = 6, useLastCommit = false) {
  const startTime = Date.now();
  let totalRecordsSearched = 0;
  let totalNewRecords = 0;
  let totalSkippedRecords = 0;
  let totalErrorRecords = 0;
  
  // Validate months parameter (only used when not using last commit mode)
  if (!useLastCommit && (months < 1 || months > 72)) {
    console.error('Months parameter must be between 1 and 72');
    process.exit(1);
  }
  
  const owner = process.env.GITHUB_OWNER;
  const singleRepo = process.env.GITHUB_REPO;
  
  if (!owner) {
    console.error('Please set GITHUB_OWNER environment variable');
    process.exit(1);
  }
  
  if (!process.env.GITHUB_TOKEN) {
    console.error('Please set GITHUB_TOKEN environment variable');
    process.exit(1);
  }
  
  // Debug: Check if Notion environment variables are set
  console.log('Environment check:');
  console.log('- NOTION_API_KEY set:', !!process.env.NOTION_API_KEY);
  console.log('- NOTION_DATABASE_ID set:', !!process.env.NOTION_DATABASE_ID);
  if (process.env.NOTION_API_KEY) {
    console.log('- NOTION_API_KEY starts with:', process.env.NOTION_API_KEY.substring(0, 10) + '...');
  }
  if (process.env.NOTION_DATABASE_ID) {
    console.log('- NOTION_DATABASE_ID:', process.env.NOTION_DATABASE_ID);
  }
  
  if (useLastCommit) {
    console.log('\nBackfilling commits since the most recent item in Notion...');
  } else {
    console.log(`\nBackfilling commits from the last ${months} months...`);
  }
  
  try {
    let repositories = [];
    
    if (singleRepo) {
      // Single repository mode
      console.log(`Processing single repository: ${owner}/${singleRepo}`);
      repositories = [{ name: singleRepo }];
    } else {
      // Interactive selection mode
      repositories = await selectRepositories(owner);
      
      if (repositories.length === 0) {
        console.log('No repositories selected. Exiting.');
        return;
      }
      
      console.log(`\nSelected ${repositories.length} repository(ies) for processing:`);
      repositories.forEach(repo => {
        console.log(`- ${owner}/${repo.name} ${repo.private ? '(private)' : '(public)'}`);
      });
    }
    
    let totalCommits = 0;
    
    for (const repo of repositories) {
      console.log(`\n=== Processing repository: ${owner}/${repo.name} ===`);
      
      try {
        let commits;
        
        if (useLastCommit) {
          // Get the most recent commit date from Notion for this repo
          const mostRecentDate = await getMostRecentCommitDate(`${owner}/${repo.name}`);
          if (mostRecentDate) {
            console.log(`Most recent commit in Notion for ${repo.name}: ${mostRecentDate.toISOString()}`);
            commits = await getCommitsSinceDate(owner, repo.name, mostRecentDate);
          } else {
            console.log(`No commits found in Notion for ${repo.name}, fetching last 7 days as fallback`);
            const fallbackDate = new Date();
            fallbackDate.setDate(fallbackDate.getDate() - 7);
            commits = await getCommitsSinceDate(owner, repo.name, fallbackDate);
          }
        } else {
          // Use the traditional months-based approach
          commits = await getCommitsFromLastNMonths(owner, repo.name, months);
        }
        
        if (commits.length === 0) {
          if (useLastCommit) {
            console.log(`No new commits found in ${repo.name} since the most recent item in Notion`);
          } else {
            console.log(`No commits found in ${repo.name} for the last ${months} months`);
          }
          continue;
        }
        
        console.log(`Processing ${commits.length} commits from ${repo.name} to Notion...`);
        totalRecordsSearched += commits.length;
        
        // Process commits in batches to avoid overwhelming the API
        const batchSize = 50; // Increased from 10 for faster processing
        let processedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;
        
        for (let i = 0; i < commits.length; i += batchSize) {
          const batch = commits.slice(i, i + batchSize);
          const result = await logCommitsToNotion(batch, `${owner}/${repo.name}`);
          
          processedCount += result?.processed || 0;
          skippedCount += result?.skipped || 0;
          errorCount += result?.errors || 0;
          
          console.log(`Processed ${Math.min(i + batchSize, commits.length)} of ${commits.length} commits from ${repo.name} (${processedCount} new, ${skippedCount} skipped, ${errorCount} errors)`);
          
          // Reduced delay between batches for faster processing
          if (i + batchSize < commits.length) {
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        }
        
        totalCommits += commits.length;
        totalNewRecords += processedCount;
        totalSkippedRecords += skippedCount;
        totalErrorRecords += errorCount;
        
        // Add a delay between repositories
        if (repositories.indexOf(repo) < repositories.length - 1) {
          console.log('Waiting 1 second before processing next repository...');
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
      } catch (error) {
        console.error(`Error processing repository ${repo.name}:`, error.message);
        // Continue with other repositories even if one fails
        continue;
      }
    }
    
    const endTime = Date.now();
    const executionTime = endTime - startTime;
    const executionTimeSeconds = (executionTime / 1000).toFixed(2);
    const executionTimeMinutes = (executionTime / 60000).toFixed(2);
    
    console.log(`\n=== Backfill completed successfully! ===`);
    console.log(`Total commits processed: ${totalCommits}`);
    console.log(`Total repositories processed: ${repositories.length}`);
    
    // Metrics Summary
    console.log(`\n📊 METRICS SUMMARY:`);
    console.log(`⏱️  Execution Time: ${executionTimeSeconds}s (${executionTimeMinutes}min)`);
    console.log(`🔍 Records Searched: ${totalRecordsSearched.toLocaleString()}`);
    console.log(`✅ New Records Added: ${totalNewRecords.toLocaleString()}`);
    console.log(`⏭️  Records Skipped: ${totalSkippedRecords.toLocaleString()}`);
    console.log(`❌ Records with Errors: ${totalErrorRecords.toLocaleString()}`);
    
    if (totalRecordsSearched > 0) {
      const successRate = ((totalNewRecords / totalRecordsSearched) * 100).toFixed(1);
      const skipRate = ((totalSkippedRecords / totalRecordsSearched) * 100).toFixed(1);
      const errorRate = ((totalErrorRecords / totalRecordsSearched) * 100).toFixed(1);
      
      console.log(`📈 Success Rate: ${successRate}%`);
      console.log(`⏭️  Skip Rate: ${skipRate}%`);
      console.log(`⚠️  Error Rate: ${errorRate}%`);
    }
    
    if (useLastCommit) {
      console.log(`\n💡 Incremental backfill mode: Only processed commits since most recent items in Notion`);
    } else {
      console.log(`\n💡 Full backfill mode: Processed commits from the last ${months} months`);
    }
    
  } catch (error) {
    const endTime = Date.now();
    const executionTime = (endTime - startTime) / 1000;
    
    console.error('Backfill failed:', error);
    console.log(`\n📊 FAILED EXECUTION METRICS:`);
    console.log(`⏱️  Execution Time: ${executionTime.toFixed(2)}s`);
    console.log(`🔍 Records Searched: ${totalRecordsSearched.toLocaleString()}`);
    console.log(`✅ New Records Added: ${totalNewRecords.toLocaleString()}`);
    console.log(`⏭️  Records Skipped: ${totalSkippedRecords.toLocaleString()}`);
    console.log(`❌ Records with Errors: ${totalErrorRecords.toLocaleString()}`);
    
    process.exit(1);
  }
}

// Run the backfill if this script is executed directly
if (require.main === module) {
  // Parse command line arguments for months parameter
  const args = process.argv.slice(2);
  let months = 6; // default value
  let useLastCommit = false;
  
  // Check for --last or -l argument
  if (args.includes('--last') || args.includes('-l')) {
    useLastCommit = true;
  }
  
  // Check for --months or -m argument (only if not using last commit mode)
  if (!useLastCommit) {
    const monthsIndex = args.findIndex(arg => arg === '--months' || arg === '-m');
    if (monthsIndex !== -1 && monthsIndex + 1 < args.length) {
      const monthsValue = parseInt(args[monthsIndex + 1]);
      if (!isNaN(monthsValue) && monthsValue >= 1 && monthsValue <= 72) {
        months = monthsValue;
      } else {
        console.error('Invalid months value. Must be a number between 1 and 72.');
        process.exit(1);
      }
    }
  }
  
  backfillCommits(months, useLastCommit);
}

module.exports = { backfillCommits }; 