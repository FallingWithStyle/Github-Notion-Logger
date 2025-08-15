const { Client } = require('@notionhq/client');
require('dotenv').config();

// Validate required environment variables
if (!process.env.NOTION_API_KEY) {
  console.error('❌ NOTION_API_KEY environment variable not set');
  process.exit(1);
}

if (!process.env.NOTION_DATABASE_ID) {
  console.error('❌ NOTION_DATABASE_ID environment variable not set');
  process.exit(1);
}

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const databaseId = process.env.NOTION_DATABASE_ID;

// Cache for existing commits to avoid repeated queries
const existingCommitsCache = new Map();
const schemaCache = { checked: false, hasShaProperty: false };
const SHA_PROPERTY_NAME = 'SHA';

async function ensureDatabaseSchemaLoaded() {
  if (schemaCache.checked) {
    return schemaCache;
  }
  try {
    const db = await notion.databases.retrieve({ database_id: databaseId });
    schemaCache.hasShaProperty = !!db.properties?.[SHA_PROPERTY_NAME] && db.properties[SHA_PROPERTY_NAME].type === 'rich_text';
    schemaCache.checked = true;
    console.log(`🧭 Notion schema: SHA property present = ${schemaCache.hasShaProperty}`);
    if (!schemaCache.hasShaProperty) {
      // Try to add the SHA property automatically
      try {
        console.log('🔧 Adding SHA property to Notion database...');
        await notion.databases.update({
          database_id: databaseId,
          properties: {
            [SHA_PROPERTY_NAME]: { rich_text: {} }
          }
        });
        schemaCache.hasShaProperty = true;
        console.log('✅ Added SHA property to Notion database');
      } catch (updateError) {
        console.warn('⚠️ Unable to add SHA property automatically. Continuing without SHA-based dedup.', updateError.message);
      }
    }
  } catch (error) {
    console.warn('⚠️ Could not retrieve Notion database schema; assuming no SHA property. Reason:', error.message);
    schemaCache.checked = true;
    schemaCache.hasShaProperty = false;
  }
  return schemaCache;
}

async function getExistingCommitsForRepo(repoName) {
  // Check cache first
  if (existingCommitsCache.has(repoName)) {
    console.log(`📋 Using cached commits for ${repoName}`);
    return existingCommitsCache.get(repoName);
  }

  console.log(`🔍 Fetching existing commits for ${repoName}...`);
  
  const existingCommits = new Set(); // legacy: message|date
  const existingShas = new Set();
  await ensureDatabaseSchemaLoaded();
  let hasMore = true;
  let startCursor = undefined;
  let pageCount = 0;
  
  try {
    // Add timeout for the entire fetch operation
    const fetchTimeout = setTimeout(() => {
      console.log('❌ Timeout while fetching existing commits');
      throw new Error('Timeout fetching existing commits');
    }, 30000); // 30 second timeout
    
    try {
      while (hasMore) {
        pageCount++;
        console.log(`📄 Fetching existing commits page ${pageCount} for ${repoName}...`);
        
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
        
        // Add commit identifiers to the sets for fast lookup
        response.results.forEach(page => {
          const commitMessage = page.properties.Commits?.rich_text?.[0]?.text?.content;
          const date = page.properties.Date?.date?.start;
          if (commitMessage && date) {
            const key = `${commitMessage}|${date.split('T')[0]}`;
            existingCommits.add(key);
          }
          if (schemaCache.hasShaProperty) {
            const sha = page.properties[SHA_PROPERTY_NAME]?.rich_text?.[0]?.text?.content;
            if (sha) existingShas.add(sha);
          }
        });
        
        hasMore = response.has_more;
        startCursor = response.next_cursor;
        
        // Add a small delay to avoid rate limiting
        if (hasMore) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      clearTimeout(fetchTimeout);
      
      // Cache the results
      const payload = { existingCommits, existingShas };
      existingCommitsCache.set(repoName, payload);
      console.log(`✅ Found ${existingShas.size} SHA matches and ${existingCommits.size} legacy matches for ${repoName}`);
      
      return payload;
    } catch (error) {
      clearTimeout(fetchTimeout);
      throw error;
    }
  } catch (error) {
    console.error(`❌ Error fetching existing commits for ${repoName}:`, error.message);
    return { existingCommits: new Set(), existingShas: new Set() };
  }
}

async function logCommitsToNotion(commits, repo) {
  let processed = 0;
  let skipped = 0;
  let errors = 0;
  
  // Extract just the repository name from the full path
  const repoName = repo.split('/').pop();
  
  console.log(`🚀 Starting to log ${commits.length} commits for ${repoName}...`);
  
  try {
    // Get all existing commits for this repo in one query
    const { existingCommits, existingShas } = await getExistingCommitsForRepo(repoName);
    
    // Filter out duplicates and prepare new commits
    const newCommits = [];
    
    for (const commit of commits) {
      try {
        const commitMessage = commit.message.split('\n')[0];
        const commitDate = new Date(commit.timestamp).toISOString().split('T')[0];
        const sha = commit.id || commit.sha || commit.hash || '';
        const uniqueKey = `${commitMessage}|${commitDate}`;
        
        if (sha && existingShas.has(sha)) {
          console.log(`⏭️ Skipping duplicate by SHA: ${sha} (${repoName})`);
          skipped++;
        } else if (existingCommits.has(uniqueKey)) {
          console.log(`⏭️ Skipping duplicate: ${commitMessage} (${repoName})`);
          skipped++;
        } else {
          newCommits.push({
            message: commitMessage,
            date: commit.timestamp,
            repoName: repoName,
            sha
          });
        }
      } catch (error) {
        console.error(`❌ Error processing commit:`, error.message);
        errors++;
      }
    }
    
    console.log(`📦 Processing ${newCommits.length} new commits for ${repoName}...`);
    
    if (newCommits.length === 0) {
      console.log(`✅ No new commits to process for ${repoName}`);
      return { processed, skipped, errors };
    }
    
    // Create new commits in batches for better performance
    const batchSize = 10; // Notion has rate limits, so we batch in smaller chunks
    
    for (let i = 0; i < newCommits.length; i += batchSize) {
      const batch = newCommits.slice(i, i + batchSize);
      console.log(`📝 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(newCommits.length / batchSize)} (${batch.length} commits)...`);
      
      // Create pages in parallel within the batch with timeout
      const createPromises = batch.map(async (commit, index) => {
        try {
          const createTimeout = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Create page timeout')), 10000)
          );
          
          const properties = {
            "Commits": {
              rich_text: [{ text: { content: commit.message } }],
            },
            "Project Name": {
              title: [{ text: { content: commit.repoName } }],
            },
            "Date": {
              date: { start: new Date(commit.date).toISOString() },
            }
          };
          if (schemaCache.hasShaProperty && commit.sha) {
            properties[SHA_PROPERTY_NAME] = {
              rich_text: [{ text: { content: commit.sha } }]
            };
          }

          const createPromise = notion.pages.create({
            parent: { database_id: databaseId },
            properties
          });
          
          const result = await Promise.race([createPromise, createTimeout]);
          console.log(`✅ Created page for commit: ${commit.message}`);
          return { success: true, result, commit };
        } catch (error) {
          console.error(`❌ Error creating page for commit ${commit.message}:`, error.message);
          return { success: false, error: error.message, commit };
        }
      });
      
      const results = await Promise.all(createPromises);
      
      // Process results
      results.forEach((result, index) => {
        if (result.success) {
          processed++;
          // Add successful commits to the cache to prevent future duplicates
          const commit = result.commit;
          const commitDate = new Date(commit.date).toISOString().split('T')[0];
          const uniqueKey = `${commit.message}|${commitDate}`;
          existingCommits.add(uniqueKey);
          if (commit.sha) existingShas.add(commit.sha);
        } else {
          errors++;
          console.error(`❌ Failed to create page for commit: ${result.commit.message}`);
        }
      });
      
      // Add a small delay between batches to respect rate limits
      if (i + batchSize < newCommits.length) {
        console.log(`⏳ Waiting 200ms before next batch...`);
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    console.log(`✅ Completed processing for ${repoName}: ${processed} processed, ${skipped} skipped, ${errors} errors`);
    return { processed, skipped, errors };
    
  } catch (error) {
    console.error(`❌ Error in logCommitsToNotion for ${repoName}:`, error);
    throw error;
  }
}

async function getMostRecentCommitDate(repoName) {
  try {
    console.log(`🔍 Finding most recent commit date for ${repoName}...`);
    
    // Query the database for the most recent commit for this repo
    const response = await notion.databases.query({
      database_id: databaseId,
      filter: {
        property: "Project Name",
        title: {
          equals: repoName.split('/').pop() // Extract just the repo name
        }
      },
      sorts: [
        {
          property: "Date",
          direction: "descending"
        }
      ],
      page_size: 1
    });
    
    if (response.results.length === 0) {
      console.log(`📭 No commits found in Notion for ${repoName}`);
      return null;
    }
    
    const mostRecentPage = response.results[0];
    const commitDate = mostRecentPage.properties.Date?.date?.start;
    
    if (!commitDate) {
      console.log(`⚠️ Most recent commit for ${repoName} has no date property`);
      return null;
    }
    
    const date = new Date(commitDate);
    console.log(`✅ Most recent commit date for ${repoName}: ${date.toISOString()}`);
    return date;
    
  } catch (error) {
    console.error(`❌ Error finding most recent commit date for ${repoName}:`, error.message);
    return null;
  }
}

module.exports = { logCommitsToNotion, getMostRecentCommitDate };
