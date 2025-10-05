const { Client } = require('@notionhq/client');
const timezoneConfig = require('../../timezone-config');
require('dotenv').config();

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const commitFromGithubLogDatabaseId = process.env.NOTION_COMMIT_FROM_GITHUB_LOG_ID;

// Cache for existing commits to avoid repeated queries
const existingCommitsCache = new Map();
const schemaCache = { 
  checked: false, 
  hasShaProperty: false,
  properties: null
};
const SHA_PROPERTY_NAME = 'SHA';

// Enhanced caching with TTL and batch operations
const CACHE_CONFIG = {
  ttl: 30 * 60 * 1000, // 30 minutes (increased from 5 minutes to prevent cache expiration during long backfills)
  maxSize: 100, // Max cached repos
  batchSize: 200, // Batch size for Notion operations
};

/**
 * Ensure database schema is loaded and check for available properties
 */
async function ensureDatabaseSchemaLoaded() {
  if (schemaCache.checked) {
    return schemaCache.hasShaProperty;
  }

  try {
    const response = await notion.databases.retrieve({
      database_id: commitFromGithubLogDatabaseId
    });

    const properties = response.properties;
    schemaCache.properties = properties;
    schemaCache.hasShaProperty = properties.hasOwnProperty(SHA_PROPERTY_NAME);
    schemaCache.checked = true;

    if (!schemaCache.hasShaProperty) {
      console.log(`⚠️ SHA property not found in database. Commits will be logged without SHA values.`);
    } else {
      console.log(`✅ SHA property found in database. Commits will include SHA values.`);
    }

    return schemaCache.hasShaProperty;
  } catch (error) {
    console.error('❌ Error checking database schema:', error);
    schemaCache.checked = true;
    schemaCache.hasShaProperty = false;
    schemaCache.properties = null;
    return false;
  }
}

/**
 * Get existing commits for a repository to avoid duplicates
 */
async function getExistingCommitsForRepo(repoName, skipLegacyDedup = false) {
  const cacheKey = `${repoName}-${skipLegacyDedup}`;
  
  // Check cache first
  if (existingCommitsCache.has(cacheKey)) {
    const cached = existingCommitsCache.get(cacheKey);
    if (Date.now() - cached.timestamp < CACHE_CONFIG.ttl) {
      return cached.data;
    }
  }

  try {
    const hasShaProperty = await ensureDatabaseSchemaLoaded();
    
    // Build filter based on available properties
    let filter = {
      property: 'Project Name',
      title: {
        equals: repoName
      }
    };

    // If we have SHA property, we can do more precise deduplication
    if (hasShaProperty && !skipLegacyDedup) {
      // Get commits with SHA values for precise deduplication
      const response = await notion.databases.query({
        database_id: commitFromGithubLogDatabaseId,
        filter,
        page_size: 1000
      });

      const commits = response.results.map(page => {
        const properties = page.properties;
        const sha = properties[SHA_PROPERTY_NAME]?.rich_text?.[0]?.text?.content;
        const message = properties['Commits']?.rich_text?.[0]?.text?.content;
        const date = properties['Date']?.date?.start;
        
        return {
          id: page.id,
          sha: sha || null,
          message: message || '',
          date: date || '',
          // For legacy deduplication fallback
          legacyKey: message ? `${message}-${date}` : null
        };
      });

      // Cache the result
      existingCommitsCache.set(cacheKey, {
        data: commits,
        timestamp: Date.now()
      });

      console.log(`📊 Retrieved ${commits.length} existing commits for ${repoName} (with SHA deduplication)`);
      return commits;
    } else {
      // Legacy deduplication based on message and date
      const response = await notion.databases.query({
        database_id: commitFromGithubLogDatabaseId,
        filter,
        page_size: 1000
      });

      const commits = response.results.map(page => {
        const properties = page.properties;
        const message = properties['Commits']?.rich_text?.[0]?.text?.content;
        const date = properties['Date']?.date?.start;
        
        return {
          id: page.id,
          sha: null,
          message: message || '',
          date: date || '',
          legacyKey: message ? `${message}-${date}` : null
        };
      });

      // Cache the result
      existingCommitsCache.set(cacheKey, {
        data: commits,
        timestamp: Date.now()
      });

      console.log(`📊 Retrieved ${commits.length} existing commits for ${repoName} (legacy deduplication)`);
      return commits;
    }
  } catch (error) {
    console.error(`❌ Error getting existing commits for ${repoName}:`, error);
    return [];
  }
}

/**
 * Log commits to Notion database
 */
async function logCommitsToNotion(commits, repoName) {
  try {
    console.log(`📝 Logging ${commits.length} commits for ${repoName}...`);
    
    if (commits.length === 0) {
      return { processed: 0, skipped: 0 };
    }

    // Get existing commits to avoid duplicates
    const existingCommits = await getExistingCommitsForRepo(repoName);
    const existingShas = new Set(existingCommits.map(c => c.sha).filter(Boolean));
    const existingLegacyKeys = new Set(existingCommits.map(c => c.legacyKey).filter(Boolean));

    // Filter out duplicates
    const newCommits = commits.filter(commit => {
      const sha = commit.id;
      const legacyKey = `${commit.message}-${commit.timestamp}`;
      
      // Check SHA first (more precise)
      if (sha && existingShas.has(sha)) {
        return false;
      }
      
      // Fallback to legacy deduplication
      if (existingLegacyKeys.has(legacyKey)) {
        return false;
      }
      
      return true;
    });

    if (newCommits.length === 0) {
      console.log(`⏭️ All commits for ${repoName} already exist, skipping`);
      return { processed: 0, skipped: commits.length };
    }

    console.log(`📝 Processing ${newCommits.length} new commits for ${repoName} (${commits.length - newCommits.length} duplicates skipped)`);

    // Process commits in batches
    const results = await processCommitBatch(newCommits, repoName, existingCommits, existingShas);
    
    // Clear cache for this repo to force refresh on next call
    existingCommitsCache.delete(`${repoName}-false`);
    existingCommitsCache.delete(`${repoName}-true`);

    return results;
  } catch (error) {
    console.error(`❌ Error logging commits for ${repoName}:`, error);
    throw error;
  }
}

/**
 * Process a batch of commits
 */
async function processCommitBatch(commits, repoName, existingCommits, existingShas) {
  const batchSize = CACHE_CONFIG.batchSize;
  let processed = 0;
  let skipped = 0;

  for (let i = 0; i < commits.length; i += batchSize) {
    const batch = commits.slice(i, i + batchSize);
    console.log(`📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(commits.length / batchSize)} (${batch.length} commits)`);

    try {
      // Create pages in parallel for this batch
      const createPromises = batch.map(commit => createCommitPage(commit, repoName));
      const results = await Promise.allSettled(createPromises);

      // Count results
      results.forEach(result => {
        if (result.status === 'fulfilled') {
          processed++;
        } else {
          console.error('❌ Failed to create commit page:', result.reason);
          skipped++;
        }
      });

      // Add small delay between batches to avoid rate limiting
      if (i + batchSize < commits.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error(`❌ Error processing batch for ${repoName}:`, error);
      skipped += batch.length;
    }
  }

  console.log(`✅ Processed ${processed} commits for ${repoName} (${skipped} failed)`);
  return { processed, skipped };
}

/**
 * Create a single commit page in Notion
 */
async function createCommitPage(commit, repoName) {
  try {
    const hasShaProperty = await ensureDatabaseSchemaLoaded();
    
    // Convert commit timestamp to user's timezone
    const timezoneInfo = timezoneConfig.getTimezoneInfo();
    const commitDate = new Date(commit.timestamp);
    const localDate = new Date(commitDate.toLocaleString('en-US', { timeZone: timezoneInfo.timezone }));
    const formattedDate = localDate.toISOString().split('T')[0];

    // Normalize project name by removing username prefix (e.g., "FallingWithStyle/Audventr" -> "Audventr")
    const normalizedRepoName = repoName.includes('/') ? repoName.split('/').pop() : repoName;
    
    // Build properties object
    const properties = {
      "Project Name": {
        title: [{ type: 'text', text: { content: normalizedRepoName } }]
      },
      "Commits": {
        rich_text: [{ type: 'text', text: { content: commit.message } }]
      },
      "Date": {
        date: { start: formattedDate }
      }
    };

    // Add SHA property if available
    if (hasShaProperty && commit.id) {
      properties[SHA_PROPERTY_NAME] = {
        rich_text: [{ type: 'text', text: { content: commit.id } }]
      };
    }

    // Add author if available and property exists in database
    if (commit.author && commit.author.name && schemaCache.properties && schemaCache.properties["Author"]) {
      properties["Author"] = {
        rich_text: [{ type: 'text', text: { content: commit.author.name } }]
      };
    }

    // Add URL if available and property exists in database
    if (commit.url && schemaCache.properties && schemaCache.properties["URL"]) {
      properties["URL"] = {
        url: commit.url
      };
    }

    // Add file changes if available and valid and property exists in database
    if (commit.modified && Array.isArray(commit.modified) && commit.modified.length > 0 && schemaCache.properties && schemaCache.properties["Files Changed"]) {
      properties["Files Changed"] = {
        rich_text: [{ type: 'text', text: { content: commit.modified.join(', ') } }]
      };
    }

    // Add additions/deletions if available and valid and properties exist in database
    if (commit.added !== undefined && typeof commit.added === 'number' && commit.added >= 0 && schemaCache.properties && schemaCache.properties["Additions"]) {
      properties["Additions"] = {
        number: commit.added
      };
    }

    if (commit.removed !== undefined && typeof commit.removed === 'number' && commit.removed >= 0 && schemaCache.properties && schemaCache.properties["Deletions"]) {
      properties["Deletions"] = {
        number: commit.removed
      };
    }

    const response = await notion.pages.create({
      parent: { database_id: commitFromGithubLogDatabaseId },
      properties
    });

    return response;
  } catch (error) {
    console.error(`❌ Error creating commit page for ${commit.id}:`, error);
    throw error;
  }
}

/**
 * Get the most recent commit date for a repository
 */
async function getMostRecentCommitDate(repoName) {
  try {
    const response = await notion.databases.query({
      database_id: commitFromGithubLogDatabaseId,
      filter: {
        property: 'Project Name',
        title: {
          equals: repoName
        }
      },
      sorts: [
        { property: 'Date', direction: 'descending' }
      ],
      page_size: 1
    });

    if (response.results.length === 0) {
      return null;
    }

    const mostRecentCommit = response.results[0];
    const date = mostRecentCommit.properties['Date']?.date?.start;
    
    if (date) {
      console.log(`📅 Most recent commit for ${repoName}: ${date}`);
      return date;
    }

    return null;
  } catch (error) {
    console.error(`❌ Error getting most recent commit date for ${repoName}:`, error);
    return null;
  }
}

/**
 * Add missing SHA values to existing commits
 */
async function addMissingShaValues() {
  try {
    console.log('🔍 Checking for commits missing SHA values...');
    
    const hasShaProperty = await ensureDatabaseSchemaLoaded();
    if (!hasShaProperty) {
      console.log('⚠️ SHA property not available, skipping SHA value addition');
      return { updated: 0, skipped: 0 };
    }

    // Get all commits without SHA values
    const response = await notion.databases.query({
      database_id: commitFromGithubLogDatabaseId,
      filter: {
        property: SHA_PROPERTY_NAME,
        rich_text: {
          is_empty: true
        }
      },
      page_size: 100
    });

    if (response.results.length === 0) {
      console.log('✅ No commits missing SHA values');
      return { updated: 0, skipped: 0 };
    }

    console.log(`📝 Found ${response.results.length} commits missing SHA values`);

    let updated = 0;
    let skipped = 0;

    for (const page of response.results) {
      try {
        const commitMessage = page.properties['Commits']?.rich_text?.[0]?.text?.content;
        const projectName = page.properties['Project Name']?.title?.[0]?.text?.content;
        const date = page.properties['Date']?.date?.start;

        if (!commitMessage || !projectName || !date) {
          skipped++;
          continue;
        }

        // Generate a consistent SHA-like identifier
        const crypto = require('crypto');
        const shaContent = `${projectName}-${commitMessage}-${date}`;
        const sha = crypto.createHash('sha1').update(shaContent).digest('hex').substring(0, 7);

        await notion.pages.update({
          page_id: page.id,
          properties: {
            [SHA_PROPERTY_NAME]: {
              rich_text: [{ type: 'text', text: { content: sha } }]
            }
          }
        });

        updated++;
      } catch (error) {
        console.error(`❌ Error updating SHA for page ${page.id}:`, error);
        skipped++;
      }
    }

    console.log(`✅ Updated ${updated} commits with SHA values (${skipped} skipped)`);
    return { updated, skipped };
  } catch (error) {
    console.error('❌ Error adding missing SHA values:', error);
    throw error;
  }
}

module.exports = {
  logCommitsToNotion,
  getMostRecentCommitDate,
  addMissingShaValues,
  commitFromGithubLogDatabaseId
};
