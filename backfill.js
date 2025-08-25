const { Octokit } = require('@octokit/rest');
const inquirer = require('inquirer');
const { logCommitsToNotion, getMostRecentCommitDate, getExistingCommitsForRepo } = require('./notion');
require('dotenv').config();

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

// Rate limiting configuration
const RATE_LIMIT_CONFIG = {
  maxConcurrent: 3, // Process 3 repos concurrently
  batchSize: 150,    // Increased from 50
  delayBetweenBatches: 100, // Reduced from 200ms
  delayBetweenRepos: 300,   // Reduced from 1000ms
  delayBetweenApiCalls: 50, // Reduced from 100ms
};

async function getAllRepositories(owner) {
  console.log(`Fetching all repositories for ${owner}...`);
  
  const repos = [];
  let page = 1;
  const perPage = 100;
  let apiCalls = 0;
  
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
        apiCalls++;
        
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
        apiCalls++;
        
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
    return { repos, apiCalls };
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
  let apiCalls = 0;
  
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
      apiCalls++;
      
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
      
      // Reduced delay for faster processing
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_CONFIG.delayBetweenApiCalls));
    }
    
    console.log(`Found ${commits.length} commits from the last ${months} months`);
    return { commits, apiCalls };
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
  let apiCalls = 0;
  
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
      apiCalls++;
      
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
      
      // Reduced delay for faster processing
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_CONFIG.delayBetweenApiCalls));
    }
    
    console.log(`Found ${commits.length} commits since ${sinceDate.toISOString()}`);
    return { commits, apiCalls };
  } catch (error) {
    console.error('Error fetching commits:', error.message);
    throw error;
  }
}

async function selectRepositories(owner) {
  console.log(`\nFetching repositories for ${owner}...`);
  
  try {
    const allRepos = await getAllRepositories(owner);
    
    if (allRepos.repos.length === 0) {
      console.log('No repositories found.');
      return [];
    }
    
    // Create choices for the selection
    const choices = [
      { name: 'All repositories', value: 'all' },
      ...allRepos.repos.map(repo => ({
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
      return allRepos.repos;
    } else {
      // Find the selected repo object
      const selectedRepo = allRepos.repos.find(repo => repo.name === selectedRepos);
      return selectedRepo ? [selectedRepo] : [];
    }
    
  } catch (error) {
    console.error('Error selecting repositories:', error.message);
    return [];
  }
}

// New optimized processing function
async function processRepositoryBatch(owner, repositories, useLastCommit, months) {
  const results = [];
  let totalApiCalls = 0;
  let totalRateLimitDelays = 0;
  let totalRateLimitDelayTime = 0;
  
  // Process repositories in parallel with controlled concurrency
  const chunks = [];
  for (let i = 0; i < repositories.length; i += RATE_LIMIT_CONFIG.maxConcurrent) {
    chunks.push(repositories.slice(i, i + RATE_LIMIT_CONFIG.maxConcurrent));
  }
  
  for (const chunk of chunks) {
    const chunkPromises = chunk.map(async (repo) => {
      console.log(`\n=== Processing repository: ${owner}/${repo.name} ===`);
      
      try {
        let commits;
        
        if (useLastCommit) {
          const mostRecentDate = await getMostRecentCommitDate(`${owner}/${repo.name}`);
          totalApiCalls++;
          
          if (mostRecentDate) {
            console.log(`Most recent commit in Notion for ${repo.name}: ${mostRecentDate.toISOString()}`);
            commits = await getCommitsSinceDate(owner, repo.name, mostRecentDate);
            totalApiCalls += commits.apiCalls;
          } else {
            console.log(`No commits found in Notion for ${repo.name}, fetching last 7 days as fallback`);
            const fallbackDate = new Date();
            fallbackDate.setDate(fallbackDate.getDate() - 7);
            commits = await getCommitsSinceDate(owner, repo.name, fallbackDate);
            totalApiCalls += commits.apiCalls;
          }
        } else {
          commits = await getCommitsFromLastNMonths(owner, repo.name, months);
          totalApiCalls += commits.apiCalls;
        }
        
        if (commits.commits.length === 0) {
          return {
            repo: repo.name,
            commits: [],
            processed: 0,
            skipped: 0,
            errors: 0,
            apiCalls: commits.apiCalls,
            rateLimitDelays: 0,
            rateLimitDelayTime: 0
          };
        }
        
        console.log(`Processing ${commits.commits.length} commits from ${repo.name} to Notion...`);
        
        // Process commits in larger batches for better performance
        const batchSize = RATE_LIMIT_CONFIG.batchSize;
        let processedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;
        let repoRateLimitDelays = 0;
        let repoRateLimitDelayTime = 0;
        
        for (let i = 0; i < commits.commits.length; i += batchSize) {
          const batch = commits.commits.slice(i, i + batchSize);
          const result = await logCommitsToNotion(batch, `${owner}/${repo.name}`);
          
          processedCount += result?.processed || 0;
          skippedCount += result?.skipped || 0;
          errorCount += result?.errors || 0;
          
          console.log(`Processed ${Math.min(i + batchSize, commits.commits.length)} of ${commits.commits.length} commits from ${repo.name} (${processedCount} new, ${skippedCount} skipped, ${errorCount} errors)`);
          
          // Reduced delay between batches
          if (i + batchSize < commits.commits.length) {
            repoRateLimitDelays++;
            repoRateLimitDelayTime += RATE_LIMIT_CONFIG.delayBetweenBatches;
            await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_CONFIG.delayBetweenBatches));
          }
        }
        
        return {
          repo: repo.name,
          commits: commits.commits,
          processed: processedCount,
          skipped: skippedCount,
          errors: errorCount,
          apiCalls: commits.apiCalls,
          rateLimitDelays: repoRateLimitDelays,
          rateLimitDelayTime: repoRateLimitDelayTime
        };
        
      } catch (error) {
        console.error(`Error processing repository ${repo.name}:`, error.message);
        return {
          repo: repo.name,
          commits: [],
          processed: 0,
          skipped: 0,
          errors: 1,
          apiCalls: 0,
          rateLimitDelays: 0,
          rateLimitDelayTime: 0,
          error: error.message
        };
      }
    });
    
    // Process chunk in parallel
    const chunkResults = await Promise.allSettled(chunkPromises);
    
    // Collect results and handle any failures
    chunkResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
        totalRateLimitDelays += result.value.rateLimitDelays;
        totalRateLimitDelayTime += result.value.rateLimitDelayTime;
      } else {
        console.error(`Repository processing failed:`, result.reason);
        results.push({
          repo: chunk[index]?.name || 'unknown',
          commits: [],
          processed: 0,
          skipped: 0,
          errors: 1,
          apiCalls: 0,
          rateLimitDelays: 0,
          rateLimitDelayTime: 0,
          error: result.reason.message
        });
      }
    });
    
    // Small delay between chunks to be respectful to APIs
    if (chunks.indexOf(chunk) < chunks.length - 1) {
      console.log(`Waiting ${RATE_LIMIT_CONFIG.delayBetweenRepos}ms before processing next batch of repositories...`);
      totalRateLimitDelays++;
      totalRateLimitDelayTime += RATE_LIMIT_CONFIG.delayBetweenRepos;
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_CONFIG.delayBetweenRepos));
    }
  }
  
  return {
    results,
    totalApiCalls,
    totalRateLimitDelays,
    totalRateLimitDelayTime
  };
}

async function backfillCommits(months = 6, useLastCommit = false) {
  const startTime = Date.now();
  let totalRecordsSearched = 0;
  let totalNewRecords = 0;
  let totalSkippedRecords = 0;
  let totalErrorRecords = 0;
  let totalApiCalls = 0;
  let totalRateLimitDelays = 0;
  let totalRateLimitDelayTime = 0;
  
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
      console.log('- NOTION_COMMIT_FROM_GITHUB_LOG_ID set:', !!process.env.NOTION_COMMIT_FROM_GITHUB_LOG_ID);
  if (process.env.NOTION_API_KEY) {
    console.log('- NOTION_API_KEY starts with:', process.env.NOTION_API_KEY.substring(0, 10) + '...');
  }
      if (process.env.NOTION_COMMIT_FROM_GITHUB_LOG_ID) {
      console.log('- NOTION_COMMIT_FROM_GITHUB_LOG_ID:', process.env.NOTION_COMMIT_FROM_GITHUB_LOG_ID);
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
      const allRepos = await getAllRepositories(owner);
      totalApiCalls += allRepos.apiCalls;
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
    
    // Use the new optimized processing function
    const processingResult = await processRepositoryBatch(owner, repositories, useLastCommit, months);
    
    // Aggregate results
    processingResult.results.forEach(result => {
      totalCommits += result.commits.length;
      totalNewRecords += result.processed;
      totalSkippedRecords += result.skipped;
      totalErrorRecords += result.errors;
      totalRecordsSearched += result.commits.length;
    });
    
    totalApiCalls += processingResult.totalApiCalls;
    totalRateLimitDelays += processingResult.totalRateLimitDelays;
    totalRateLimitDelayTime += processingResult.totalRateLimitDelayTime;
    
    const endTime = Date.now();
    const executionTime = endTime - startTime;
    const executionTimeSeconds = (executionTime / 1000).toFixed(2);
    const executionTimeMinutes = (executionTime / 60000).toFixed(2);
    const activeTime = executionTime - totalRateLimitDelayTime;
    const activeTimeSeconds = (activeTime / 1000).toFixed(2);
    
    console.log(`\n=== Backfill completed successfully! ===`);
    console.log(`Total commits processed: ${totalCommits}`);
    console.log(`Total repositories processed: ${repositories.length}`);
    
    // Metrics Summary
    console.log(`\n📊 METRICS SUMMARY:`);
    console.log(`⏱️  Total Execution Time: ${executionTimeSeconds}s (${executionTimeMinutes}min)`);
    console.log(`⚡ Active Processing Time: ${activeTimeSeconds}s`);
    console.log(`⏳ Rate Limit Delays: ${totalRateLimitDelays} delays (${(totalRateLimitDelayTime / 1000).toFixed(1)}s total)`);
    console.log(`🔍 Records Searched: ${totalRecordsSearched.toLocaleString()}`);
    console.log(`✅ New Records Added: ${totalNewRecords.toLocaleString()}`);
    console.log(`⏭️  Records Skipped: ${totalSkippedRecords.toLocaleString()}`);
    console.log(`❌ Records with Errors: ${totalErrorRecords.toLocaleString()}`);
    console.log(`🌐 API Calls Made: ${totalApiCalls.toLocaleString()}`);
    
    if (totalRecordsSearched > 0) {
      const successRate = ((totalNewRecords / totalRecordsSearched) * 100).toFixed(1);
      const skipRate = ((totalSkippedRecords / totalRecordsSearched) * 100).toFixed(1);
      const errorRate = ((totalErrorRecords / totalRecordsSearched) * 100).toFixed(1);
      const efficiencyRate = ((activeTime / executionTime) * 100).toFixed(1);
      
      console.log(`📈 Success Rate: ${successRate}%`);
      console.log(`⏭️  Skip Rate: ${skipRate}%`);
      console.log(`⚠️  Error Rate: ${errorRate}%`);
      console.log(`⚡ Processing Efficiency: ${efficiencyRate}% (active time vs total time)`);
    }
    
    if (useLastCommit) {
      console.log(`\n💡 Incremental backfill mode: Only processed commits since most recent items in Notion`);
    } else {
      console.log(`\n💡 Full backfill mode: Processed commits from the last ${months} months`);
    }
    
    // Performance insights
    if (totalRecordsSearched > 0) {
      const recordsPerSecond = (totalNewRecords / (activeTime / 1000)).toFixed(1);
      const recordsPerMinute = (totalNewRecords / (activeTime / 60000)).toFixed(1);
      console.log(`\n🚀 PERFORMANCE INSIGHTS:`);
      console.log(`📊 Processing Rate: ${recordsPerSecond} records/second (${recordsPerMinute} records/minute)`);
      
      if (totalRateLimitDelays > 0) {
        const avgDelayTime = (totalRateLimitDelayTime / totalRateLimitDelays).toFixed(0);
        console.log(`⏱️  Average Delay: ${avgDelayTime}ms per rate limit delay`);
      }
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
    console.log(`🌐 API Calls Made: ${totalApiCalls.toLocaleString()}`);
    
    process.exit(1);
  }
}

// Run the backfill if this script is executed directly
if (require.main === module) {
  // Parse command line arguments for months parameter
  const args = process.argv.slice(2);
  let months = 6; // default value
  let useLastCommit = false;
  let shaOnlyMode = false;
  
  // Check for --last or -l argument
  if (args.includes('--last') || args.includes('-l')) {
    useLastCommit = true;
  }
  
  // Check for --sha-only or -s argument (SHA-only deduplication for large repos)
  if (args.includes('--sha-only') || args.includes('-s')) {
    shaOnlyMode = true;
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
  
  // Show help if requested
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
GitHub Notion Logger - Backfill Script

Usage: node backfill.js [options]

Options:
  -l, --last           Incremental backfill since most recent commit in Notion
  -m, --months <num>   Full backfill for last N months (1-72, default: 6)
  -s, --sha-only       Use SHA-only deduplication for large repositories (faster)
  -h, --help           Show this help message

Examples:
  node backfill.js                    # Full backfill for last 6 months
  node backfill.js -m 12             # Full backfill for last 12 months
  node backfill.js -l                 # Incremental backfill since last commit
  node backfill.js -l -s              # Incremental backfill with SHA-only dedup
  node backfill.js --months 3 --sha-only  # 3 months with SHA-only dedup

Note: SHA-only mode is automatically enabled for large batches (>100 commits)
      to prevent timeouts on repositories with many existing commits.
`);
    process.exit(0);
  }
  
  if (shaOnlyMode) {
    console.log('🔧 SHA-only deduplication mode enabled for large repositories');
  }
  
  backfillCommits(months, useLastCommit);
}

module.exports = { backfillCommits };