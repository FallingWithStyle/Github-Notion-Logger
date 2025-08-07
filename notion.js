const { Client } = require('@notionhq/client');
require('dotenv').config();

const notion = new Client({ auth: process.env.NOTION_API_KEY });

const databaseId = process.env.NOTION_DATABASE_ID;

// Cache for existing commits to avoid repeated queries
const existingCommitsCache = new Map();

async function getExistingCommitsForRepo(repoName) {
  // Check cache first
  if (existingCommitsCache.has(repoName)) {
    return existingCommitsCache.get(repoName);
  }

  console.log(`Fetching existing commits for ${repoName}...`);
  
  const existingCommits = new Set();
  let hasMore = true;
  let startCursor = undefined;
  
  try {
    while (hasMore) {
      const response = await notion.databases.query({
        database_id: databaseId,
        filter: {
          property: "Project Name",
          title: {
            equals: repoName
          }
        },
        page_size: 100,
        start_cursor: startCursor
      });
      
      // Add commit messages to the set for fast lookup
      response.results.forEach(page => {
        const commitMessage = page.properties.Commits?.rich_text?.[0]?.text?.content;
        const date = page.properties.Date?.date?.start;
        if (commitMessage && date) {
          // Create a unique key combining message and date
          const key = `${commitMessage}|${date.split('T')[0]}`;
          existingCommits.add(key);
        }
      });
      
      hasMore = response.has_more;
      startCursor = response.next_cursor;
      
      // Add a small delay to avoid rate limiting
      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    // Cache the results
    existingCommitsCache.set(repoName, existingCommits);
    console.log(`Found ${existingCommits.size} existing commits for ${repoName}`);
    
    return existingCommits;
  } catch (error) {
    console.error(`Error fetching existing commits for ${repoName}:`, error.message);
    return new Set();
  }
}

async function logCommitsToNotion(commits, repo) {
  let processed = 0;
  let skipped = 0;
  
  // Extract just the repository name from the full path
  const repoName = repo.split('/').pop();
  
  // Get all existing commits for this repo in one query
  const existingCommits = await getExistingCommitsForRepo(repoName);
  
  // Filter out duplicates and prepare new commits
  const newCommits = [];
  
  for (const commit of commits) {
    const commitMessage = commit.message.split('\n')[0];
    const commitDate = new Date(commit.timestamp).toISOString().split('T')[0];
    const uniqueKey = `${commitMessage}|${commitDate}`;
    
    if (existingCommits.has(uniqueKey)) {
      console.log(`Skipping duplicate: ${commitMessage} (${repoName})`);
      skipped++;
    } else {
      newCommits.push({
        message: commitMessage,
        date: commit.timestamp,
        repoName: repoName
      });
    }
  }
  
  console.log(`Processing ${newCommits.length} new commits for ${repoName}...`);
  
  // Create new commits in batches for better performance
  const batchSize = 10; // Notion has rate limits, so we batch in smaller chunks
  
  for (let i = 0; i < newCommits.length; i += batchSize) {
    const batch = newCommits.slice(i, i + batchSize);
    
    // Create pages in parallel within the batch
    const createPromises = batch.map(commit => 
      notion.pages.create({
        parent: { database_id: databaseId },
        properties: {
          "Commits": {
            rich_text: [{ text: { content: commit.message } }],
          },
          "Project Name": {
            title: [{ text: { content: commit.repoName } }],
          },
          "Date": {
            date: { start: new Date(commit.date).toISOString() },
          }
        }
      }).catch(error => {
        console.error(`Error creating page for commit ${commit.message}:`, error.message);
        return null; // Return null for failed creations
      })
    );
    
    const results = await Promise.all(createPromises);
    const successfulCreations = results.filter(result => result !== null).length;
    processed += successfulCreations;
    
    // Add successful commits to the cache to prevent future duplicates
    batch.forEach((commit, index) => {
      if (results[index] !== null) {
        const commitDate = new Date(commit.date).toISOString().split('T')[0];
        const uniqueKey = `${commit.message}|${commitDate}`;
        existingCommits.add(uniqueKey);
      }
    });
    
    // Add a small delay between batches to respect rate limits
    if (i + batchSize < newCommits.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  
  return { processed, skipped };
}

module.exports = { logCommitsToNotion };
