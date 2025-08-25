const { Client } = require('@notionhq/client');
const timezoneConfig = require('./timezone-config');
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

// Weekly planning database ID (will be created if doesn't exist)
let weeklyPlanningDatabaseId = null;

// Cache for existing commits to avoid repeated queries
const existingCommitsCache = new Map();
const schemaCache = { checked: false, hasShaProperty: false };
const SHA_PROPERTY_NAME = 'SHA';

// Enhanced caching with TTL and batch operations
const CACHE_CONFIG = {
  ttl: 5 * 60 * 1000, // 5 minutes
  maxSize: 100, // Max cached repos
  batchSize: 200, // Batch size for Notion operations
};

// Weekly planning database schema
const WEEKLY_PLANNING_SCHEMA = {
  "Project Name": { title: {} },
  "Week Start": { date: {} },
  "Head": { number: {} },
  "Heart": { number: {} },
  "Category": { select: {} },
  "Status": { select: {} },
  "Notes": { rich_text: {} },
  "Created": { date: {} },
  "Last Updated": { date: {} }
};

// Ensure weekly planning database exists
async function ensureWeeklyPlanningDatabase() {
  console.log('🔄 Ensuring weekly planning database exists...');
  console.log('🔄 Current database ID:', weeklyPlanningDatabaseId);
  console.log('🔄 Environment variables:');
  console.log('   - NOTION_API_KEY:', process.env.NOTION_API_KEY ? 'SET' : 'NOT SET');
  console.log('   - NOTION_PARENT_PAGE_ID:', process.env.NOTION_PARENT_PAGE_ID || 'NOT SET');
  console.log('   - NOTION_DATABASE_ID:', process.env.NOTION_DATABASE_ID || 'NOT SET');
  
  // Always check the database schema, even if we have a cached ID
  if (weeklyPlanningDatabaseId) {
    console.log('🔄 Checking existing database schema for ID:', weeklyPlanningDatabaseId);
    try {
      const db = await notion.databases.retrieve({ database_id: weeklyPlanningDatabaseId });
      console.log('🔄 Existing database properties:', Object.keys(db.properties));
      
      // Check if all required properties exist
      const requiredProps = ['Project Name', 'Week Start', 'Head', 'Heart', 'Category', 'Status', 'Notes', 'Created', 'Last Updated'];
      const missingProps = requiredProps.filter(prop => !db.properties[prop]);
      
      if (missingProps.length > 0) {
        console.log('⚠️ Database schema is outdated. Missing properties:', missingProps);
        console.log('🔄 Updating database schema...');
        
        // Update the database schema
        await notion.databases.update({
          database_id: weeklyPlanningDatabaseId,
          properties: WEEKLY_PLANNING_SCHEMA
        });
        
        console.log('✅ Database schema updated successfully');
        return weeklyPlanningDatabaseId;
      } else {
        console.log('✅ Database schema is up to date');
        return weeklyPlanningDatabaseId;
      }
    } catch (error) {
      console.error('❌ Error checking/updating database schema:', error);
      // If there's an error, try to recreate the database
      console.log('🔄 Attempting to recreate database...');
      weeklyPlanningDatabaseId = null;
    }
  }

  try {
    console.log('🔄 Searching for existing weekly planning database...');
    // Check if database already exists by searching for it
    const response = await notion.search({
      query: "Weekly Project Planning",
      filter: {
        property: "object",
        value: "database"
      }
    });
    console.log('🔄 Search response:', response);

    // If database exists, use it
    if (response.results.length > 0) {
      weeklyPlanningDatabaseId = response.results[0].id;
      console.log(`📊 Found existing weekly planning database: ${weeklyPlanningDatabaseId}`);
      return weeklyPlanningDatabaseId;
    }

    // Create new database
    console.log('🔧 Creating new weekly planning database...');
    const newDatabase = await notion.databases.create({
      parent: { type: "page_id", page_id: process.env.NOTION_PARENT_PAGE_ID || databaseId },
      title: [{ type: "text", text: { content: "Weekly Project Planning" } }],
      properties: WEEKLY_PLANNING_SCHEMA,
      description: [{ type: "text", text: { content: "Weekly project prioritization and planning data" } }]
    });

    weeklyPlanningDatabaseId = newDatabase.id;
    console.log(`✅ Created weekly planning database: ${weeklyPlanningDatabaseId}`);
    return weeklyPlanningDatabaseId;
  } catch (error) {
    console.error('❌ Error ensuring weekly planning database:', error);
    throw error;
  }
}

// Add weekly planning entry to Notion
async function addWeeklyPlanningEntry(projectData) {
  try {
    console.log('🔄 Starting addWeeklyPlanningEntry...');
    console.log('🔄 Project data received:', projectData);
    
    await ensureWeeklyPlanningDatabase();
    console.log('🔄 Database ensured, ID:', weeklyPlanningDatabaseId);
    
    // Validate database schema before attempting to write
    console.log('🔄 Validating database schema before writing...');
    try {
      const db = await notion.databases.retrieve({ database_id: weeklyPlanningDatabaseId });
      console.log('🔄 Database properties found:', Object.keys(db.properties));
      
      // Check if all required properties exist
      const requiredProps = ['Project Name', 'Week Start', 'Head', 'Heart', 'Category', 'Status', 'Notes', 'Created', 'Last Updated'];
      const missingProps = requiredProps.filter(prop => !db.properties[prop]);
      
      if (missingProps.length > 0) {
        console.log('⚠️ Database schema is outdated. Missing properties:', missingProps);
        console.log('🔄 Updating database schema...');
        
        // Update the database schema
        await notion.databases.update({
          database_id: weeklyPlanningDatabaseId,
          properties: WEEKLY_PLANNING_SCHEMA
        });
        
        console.log('✅ Database schema updated successfully');
      } else {
        console.log('✅ Database schema is up to date');
      }
    } catch (error) {
      console.error('❌ Error validating/updating database schema:', error);
      throw new Error(`Database schema validation failed: ${error.message}`);
    }
    
    const { projectName, weekStart, head, heart, category, status, notes } = projectData;
    
    const entry = {
      parent: { database_id: weeklyPlanningDatabaseId },
      properties: {
        "Project Name": {
          title: [{ type: "text", text: { content: projectName } }]
        },
        "Week Start": {
          date: { start: weekStart }
        },
        "Head": {
          number: parseInt(head) || null
        },
        "Heart": {
          number: parseInt(heart) || null
        },
        "Category": {
          select: category ? { name: category } : null
        },
        "Status": {
          select: status ? { name: status } : null
        },
        "Notes": {
          rich_text: notes ? [{ type: "text", text: { content: notes } }] : []
        },
        "Created": {
          date: { start: new Date().toISOString() }
        },
        "Last Updated": {
          date: { start: new Date().toISOString() }
        }
      }
    };

    const result = await notion.pages.create(entry);
    console.log(`✅ Added weekly planning entry for ${projectName} (week of ${weekStart})`);
    return result;
  } catch (error) {
    console.error('❌ Error adding weekly planning entry:', error);
    throw error;
  }
}

// Get weekly planning data from Notion
async function getWeeklyPlanningData(weekStart = null) {
  try {
    await ensureWeeklyPlanningDatabase();
    
    let filter = {};
    if (weekStart) {
      filter = {
        property: "Week Start",
        date: {
          equals: weekStart
        }
      };
    }

    const response = await notion.databases.query({
      database_id: weeklyPlanningDatabaseId,
      filter: Object.keys(filter).length > 0 ? filter : undefined,
      sorts: [
        { property: "Week Start", direction: "descending" },
        { property: "Project Name", direction: "ascending" }
      ]
    });

    const planningData = response.results.map(page => ({
      id: page.id,
      projectName: page.properties["Project Name"]?.title?.[0]?.text?.content || "",
      weekStart: page.properties["Week Start"]?.date?.start || "",
      head: page.properties["Head"]?.number || null,
      heart: page.properties["Heart"]?.number || null,
      category: page.properties["Category"]?.select?.name || "",
      status: page.properties["Status"]?.select?.name || "",
      notes: page.properties["Notes"]?.rich_text?.[0]?.text?.content || "",
      created: page.properties["Created"]?.date?.start || "",
      lastUpdated: page.properties["Last Updated"]?.date?.start || ""
    }));

    console.log(`📊 Retrieved ${planningData.length} weekly planning entries`);
    return planningData;
  } catch (error) {
    console.error('❌ Error getting weekly planning data:', error);
    throw error;
  }
}

// Update existing weekly planning entry
async function updateWeeklyPlanningEntry(entryId, updates) {
  try {
    const properties = {};
    
    if (updates.head !== undefined) {
      properties["Head"] = { number: parseInt(updates.head) || null };
    }
    if (updates.heart !== undefined) {
      properties["Heart"] = { number: parseInt(updates.heart) || null };
    }
    if (updates.category !== undefined) {
      properties["Category"] = { select: updates.category ? { name: updates.category } : null };
    }
    if (updates.status !== undefined) {
      properties["Status"] = { select: updates.status ? { name: updates.status } : null };
    }
    if (updates.notes !== undefined) {
      properties["Notes"] = { rich_text: updates.notes ? [{ type: "text", text: { content: updates.notes } }] : [] };
    }
    
    properties["Last Updated"] = { date: { start: new Date().toISOString() } };

    await notion.pages.update({
      page_id: entryId,
      properties
    });

    console.log(`✅ Updated weekly planning entry: ${entryId}`);
  } catch (error) {
    console.error('❌ Error updating weekly planning entry:', error);
    throw error;
  }
}

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

async function getExistingCommitsForRepo(repoName, skipLegacyDedup = false) {
  // Check cache first with TTL
  const cached = existingCommitsCache.get(repoName);
  if (cached && Date.now() - cached.timestamp < CACHE_CONFIG.ttl) {
    console.log(`📋 Using cached commits for ${repoName} (age: ${Math.round((Date.now() - cached.timestamp) / 1000)}s)`);
    return cached.data;
  }

  console.log(`🔍 Fetching existing commits for ${repoName}...`);
  
  const existingCommits = new Set(); // legacy: message|date
  const existingShas = new Set();
  await ensureDatabaseSchemaLoaded();
  
  // If we have SHA property and legacy dedup is disabled, only fetch SHA data
  if (schemaCache.hasShaProperty && skipLegacyDedup) {
    console.log(`🚀 SHA-only mode for ${repoName} - skipping legacy deduplication`);
    const result = { existingCommits: new Set(), existingShas: new Set() };
    
    // Cache the result
    if (existingCommitsCache.size >= CACHE_CONFIG.maxSize) {
      // Remove oldest entry
      const oldestKey = existingCommitsCache.keys().next().value;
      existingCommitsCache.delete(oldestKey);
    }
    existingCommitsCache.set(repoName, { data: result, timestamp: Date.now() });
    
    return result;
  }
  
  let hasMore = true;
  let startCursor = undefined;
  let pageCount = 0;
  const maxPages = 20; // Limit to prevent timeouts on very large repos
  
  try {
    // Add timeout for the entire fetch operation - longer for large repos
    const fetchTimeout = setTimeout(() => {
      console.log(`⚠️ Timeout while fetching existing commits for ${repoName} - using partial data`);
      throw new Error('Timeout fetching existing commits');
    }, 60000); // 60 second timeout for large repos
    
    try {
      while (hasMore && pageCount < maxPages) {
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
          start_cursor: startCursor,
        });
        
        // Process the response
        for (const page of response.results) {
          const properties = page.properties;
          
          // Extract SHA if available
          if (schemaCache.hasShaProperty && properties[SHA_PROPERTY_NAME]?.rich_text?.[0]?.plain_text) {
            const sha = properties[SHA_PROPERTY_NAME].rich_text[0].plain_text;
            existingShas.add(sha);
          }
          
          // Legacy deduplication: message + date combination
          if (!skipLegacyDedup && properties["Commit Message"]?.rich_text?.[0]?.plain_text && properties["Date"]?.date?.start) {
            const message = properties["Commit Message"].rich_text[0].plain_text;
            const date = properties["Date"].date.start;
            const key = `${message}|${date}`;
            existingCommits.add(key);
          }
        }
        
        hasMore = response.has_more;
        startCursor = response.next_cursor;
        
        // Small delay between pages to be respectful
        if (hasMore) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
      
      clearTimeout(fetchTimeout);
      
      const result = { existingCommits, existingShas };
      
      // Cache the result
      if (existingCommitsCache.size >= CACHE_CONFIG.maxSize) {
        // Remove oldest entry
        const oldestKey = existingCommitsCache.keys().next().value;
        existingCommitsCache.delete(oldestKey);
      }
      existingCommitsCache.set(repoName, { data: result, timestamp: Date.now() });
      
      console.log(`✅ Cached ${existingCommits.size} legacy keys and ${existingShas.size} SHAs for ${repoName}`);
      return result;
      
    } catch (error) {
      clearTimeout(fetchTimeout);
      throw error;
    }
    
  } catch (error) {
    console.warn(`⚠️ Error fetching existing commits for ${repoName}:`, error.message);
    // Return empty sets on error to allow processing to continue
    return { existingCommits: new Set(), existingShas: new Set() };
  }
}

async function logCommitsToNotion(commits, repoName) {
  if (!commits || commits.length === 0) {
    return { processed: 0, skipped: 0, errors: 0 };
  }

  console.log(`📝 Processing ${commits.length} commits for ${repoName}...`);
  
  // Get existing commits for deduplication
  const existingData = await getExistingCommitsForRepo(repoName, commits.length > CACHE_CONFIG.batchSize);
  const existingCommits = existingData.existingCommits;
  const existingShas = existingData.existingShas;
  
  let processed = 0;
  let skipped = 0;
  let errors = 0;
  
  // Process commits in optimized batches
  const batchSize = CACHE_CONFIG.batchSize;
  for (let i = 0; i < commits.length; i += batchSize) {
    const batch = commits.slice(i, i + batchSize);
    const batchResults = await processCommitBatch(batch, repoName, existingCommits, existingShas);
    
    processed += batchResults.processed;
    skipped += batchResults.skipped;
    errors += batchResults.errors;
    
    // Small delay between batches
    if (i + batchSize < commits.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return { processed, skipped, errors };
}

// New optimized batch processing function
async function processCommitBatch(commits, repoName, existingCommits, existingShas) {
  let processed = 0;
  let skipped = 0;
  let errors = 0;
  
  // Pre-filter commits to avoid unnecessary processing
  const commitsToProcess = [];
  const skipReasons = [];
  
  for (const commit of commits) {
    let shouldSkip = false;
    let skipReason = '';
    
    // Check SHA first (most reliable)
    if (existingShas.has(commit.id)) {
      shouldSkip = true;
      skipReason = 'SHA already exists';
    }
    // Check legacy deduplication
    else if (existingCommits.has(`${commit.message}|${commit.timestamp}`)) {
      shouldSkip = true;
      skipReason = 'Message + date combination already exists';
    }
    
    if (shouldSkip) {
      skipped++;
      skipReasons.push(`${commit.id.substring(0, 8)}: ${skipReason}`);
    } else {
      commitsToProcess.push(commit);
    }
  }
  
  if (commitsToProcess.length === 0) {
    console.log(`⏭️  All ${commits.length} commits in batch already exist, skipping...`);
    return { processed: 0, skipped, errors: 0 };
  }
  
  console.log(`📝 Processing ${commitsToProcess.length} new commits (${skipped} skipped)`);
  
  // Process commits in parallel batches for better performance
  const parallelBatches = [];
  for (let i = 0; i < commitsToProcess.length; i += 10) { // Process 10 commits in parallel
    parallelBatches.push(commitsToProcess.slice(i, i + 10));
  }
  
  for (const parallelBatch of parallelBatches) {
    const batchPromises = parallelBatch.map(async (commit) => {
      try {
        await createCommitPage(commit, repoName);
        return { success: true };
      } catch (error) {
        console.error(`❌ Error creating page for commit ${commit.id}:`, error.message);
        return { success: false, error: error.message };
      }
    });
    
    const batchResults = await Promise.allSettled(batchPromises);
    
    batchResults.forEach(result => {
      if (result.status === 'fulfilled' && result.value.success) {
        processed++;
      } else {
        errors++;
      }
    });
    
    // Small delay between parallel batches
    if (parallelBatches.indexOf(parallelBatch) < parallelBatches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }
  
  return { processed, skipped, errors };
}

async function createCommitPage(commit, repoName) {
  const properties = {
    "Commits": {
      rich_text: [{ text: { content: commit.message } }],
    },
    "Project Name": {
      title: [{ text: { content: repoName.split('/').pop() } }],
    },
    "Date": {
      // Store the effective date (with timezone cutoff logic applied)
      date: { start: timezoneConfig.getEffectiveDate(commit.timestamp) },
    }
  };
  if (schemaCache.hasShaProperty && commit.id) {
    properties[SHA_PROPERTY_NAME] = {
      rich_text: [{ text: { content: commit.id } }]
    };
  }

  await notion.pages.create({
    parent: { database_id: databaseId },
    properties
  });
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

module.exports = { 
  logCommitsToNotion, 
  getMostRecentCommitDate,
  addWeeklyPlanningEntry,
  getWeeklyPlanningData,
  updateWeeklyPlanningEntry,
  ensureWeeklyPlanningDatabase
};
