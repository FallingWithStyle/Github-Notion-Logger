const { Octokit } = require('@octokit/rest');
const { logCommitsToNotion } = require('./notion');
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
      const response = await octokit.repos.listForUser({
        username: owner,
        per_page: perPage,
        page,
        sort: 'updated',
        direction: 'desc',
      });
      
      if (response.data.length === 0) {
        break;
      }
      
      // Filter out forked repositories if desired
      const nonForkRepos = response.data.filter(repo => !repo.fork);
      repos.push(...nonForkRepos);
      
      if (response.data.length < perPage) {
        break;
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

async function getCommitsFromLast6Months(owner, repo) {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  
  console.log(`Fetching commits from ${owner}/${repo} since ${sixMonthsAgo.toISOString()}`);
  
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
        since: sixMonthsAgo.toISOString(),
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
    
    console.log(`Found ${commits.length} commits from the last 6 months`);
    return commits;
  } catch (error) {
    console.error('Error fetching commits:', error.message);
    throw error;
  }
}

async function backfillCommits() {
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
  
  try {
    let repositories = [];
    
    if (singleRepo) {
      // Single repository mode
      console.log(`Processing single repository: ${owner}/${singleRepo}`);
      repositories = [{ name: singleRepo }];
    } else {
      // All repositories mode
      console.log(`Processing all repositories for ${owner}`);
      repositories = await getAllRepositories(owner);
    }
    
    let totalCommits = 0;
    
    for (const repo of repositories) {
      console.log(`\n=== Processing repository: ${owner}/${repo.name} ===`);
      
      try {
        const commits = await getCommitsFromLast6Months(owner, repo.name);
        
        if (commits.length === 0) {
          console.log(`No commits found in ${repo.name} for the last 6 months`);
          continue;
        }
        
        console.log(`Logging ${commits.length} commits from ${repo.name} to Notion...`);
        
        // Process commits in batches to avoid overwhelming the API
        const batchSize = 10;
        for (let i = 0; i < commits.length; i += batchSize) {
          const batch = commits.slice(i, i + batchSize);
          await logCommitsToNotion(batch, `${owner}/${repo.name}`);
          
          console.log(`Processed ${Math.min(i + batchSize, commits.length)} of ${commits.length} commits from ${repo.name}`);
          
          // Add a small delay between batches
          if (i + batchSize < commits.length) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
        
        totalCommits += commits.length;
        
        // Add a delay between repositories
        if (repositories.indexOf(repo) < repositories.length - 1) {
          console.log('Waiting 2 seconds before processing next repository...');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
      } catch (error) {
        console.error(`Error processing repository ${repo.name}:`, error.message);
        // Continue with other repositories even if one fails
        continue;
      }
    }
    
    console.log(`\n=== Backfill completed successfully! ===`);
    console.log(`Total commits processed: ${totalCommits}`);
    console.log(`Total repositories processed: ${repositories.length}`);
    
  } catch (error) {
    console.error('Backfill failed:', error);
    process.exit(1);
  }
}

// Run the backfill if this script is executed directly
if (require.main === module) {
  backfillCommits();
}

module.exports = { backfillCommits }; 