const { Client } = require('@notionhq/client');
const timezoneConfig = require('./timezone-config');
require('dotenv').config();

// Validate required environment variables
if (!process.env.NOTION_API_KEY) {
  console.error('❌ NOTION_API_KEY environment variable not set');
  process.exit(1);
}

if (!process.env.NOTION_COMMIT_FROM_GITHUB_LOG_ID) {
  console.error('❌ NOTION_COMMIT_FROM_GITHUB_LOG_ID environment variable not set');
  process.exit(1);
}

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const commitFromGithubLogDatabaseId = process.env.NOTION_COMMIT_FROM_GITHUB_LOG_ID;

// Weekly planning database ID (will be created if doesn't exist)
let weeklyPlanningDatabaseId = null;

// Cache for existing commits to avoid repeated queries
const existingCommitsCache = new Map();
const schemaCache = { checked: false, hasShaProperty: false };
const SHA_PROPERTY_NAME = 'SHA';

// Enhanced caching with TTL and batch operations
const CACHE_CONFIG = {
  ttl: 30 * 60 * 1000, // 30 minutes (increased from 5 minutes to prevent cache expiration during long backfills)
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
  console.log('   - NOTION_WEEKLY_PROJECT_PLAN_PARENT_PAGE_ID:', process.env.NOTION_WEEKLY_PROJECT_PLAN_PARENT_PAGE_ID || 'NOT SET');
  console.log('   - NOTION_COMMIT_FROM_GITHUB_LOG_ID:', process.env.NOTION_COMMIT_FROM_GITHUB_LOG_ID || 'NOT SET');
  
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

    // If database exists, use it and validate schema
    if (response.results.length > 0) {
      weeklyPlanningDatabaseId = response.results[0].id;
      console.log(`📊 Found existing weekly planning database: ${weeklyPlanningDatabaseId}`);
      
      // Now validate and update the schema of the found database
      console.log('🔄 Validating schema of found database...');
      try {
        const db = await notion.databases.retrieve({ database_id: weeklyPlanningDatabaseId });
        console.log('🔄 Found database properties:', Object.keys(db.properties));
        
        // Check if all required properties exist
        const requiredProps = ['Project Name', 'Week Start', 'Head', 'Heart', 'Category', 'Status', 'Notes', 'Created', 'Last Updated'];
        const missingProps = requiredProps.filter(prop => !db.properties[prop]);
        
        if (missingProps.length > 0) {
          console.log('⚠️ Found database has outdated schema. Missing properties:', missingProps);
          console.log('🔄 Updating found database schema...');
          
          // Update the database schema
          await notion.databases.update({
            database_id: weeklyPlanningDatabaseId,
            properties: WEEKLY_PLANNING_SCHEMA
          });
          
          console.log('✅ Found database schema updated successfully');
        } else {
          console.log('✅ Found database schema is up to date');
        }
      } catch (error) {
        console.error('❌ Error validating/updating found database schema:', error);
        // If we can't update the found database, create a new one
        console.log('🔄 Creating new database due to schema update failure...');
        weeklyPlanningDatabaseId = null;
      }
      
      if (weeklyPlanningDatabaseId) {
        return weeklyPlanningDatabaseId;
      }
    }

    // Create new database - handle the case where NOTION_PARENT_PAGE_ID might be a database ID
    console.log('🔧 Creating new weekly planning database...');
    
    let parentId = process.env.NOTION_WEEKLY_PROJECT_PLAN_PARENT_PAGE_ID || commitFromGithubLogDatabaseId;
    let parentType = "page_id";
    
    // Check if the parent ID is actually a database ID
    try {
      const parentCheck = await notion.databases.retrieve({ database_id: parentId });
      console.log('⚠️ NOTION_WEEKLY_PROJECT_PLAN_PARENT_PAGE_ID is actually a database ID, not a page ID');
      console.log('🔄 Attempting to find a page within this database to use as parent...');
      
      // Query the database to find a page we can use as parent
      const pagesResponse = await notion.databases.query({
        database_id: parentId,
        page_size: 1
      });
      
      if (pagesResponse.results.length > 0) {
        parentId = pagesResponse.results[0].id;
        parentType = "page_id";
        console.log(`✅ Found page within database to use as parent: ${parentId}`);
      } else {
        // If no pages exist, we'll need to create a page first or use a different approach
        console.log('❌ No pages found in the database to use as parent');
        console.log('🔄 Using the database itself as parent (this may fail)...');
        parentType = "database_id";
      }
    } catch (error) {
      // If it's not a database, assume it's a page ID
      console.log('✅ NOTION_WEEKLY_PROJECT_PLAN_PARENT_PAGE_ID appears to be a valid page ID');
    }
    
    const newDatabase = await notion.databases.create({
      parent: { type: parentType, [parentType === "page_id" ? "page_id" : "database_id"]: parentId },
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
    
    if (!weeklyPlanningDatabaseId) {
      throw new Error('Failed to get valid weekly planning database ID');
    }
    
    console.log('🔄 Proceeding with page creation...');
    
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

    console.log('🔄 Creating page with properties:', Object.keys(entry.properties));
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
    console.log('🔍 Checking Notion database schema...');
    const db = await notion.databases.retrieve({ database_id: commitFromGithubLogDatabaseId });
    
    // Check if SHA property exists
    const hasShaProperty = !!db.properties?.[SHA_PROPERTY_NAME] && db.properties[SHA_PROPERTY_NAME].type === 'rich_text';
    schemaCache.hasShaProperty = hasShaProperty;
    schemaCache.checked = true;
    
    console.log(`🧭 Notion schema: SHA property present = ${hasShaProperty}`);
    console.log(`🧭 Available properties:`, Object.keys(db.properties));
    
    if (!hasShaProperty) {
      // Try to add the SHA property automatically
      try {
        console.log('🔧 Adding SHA property to Notion database...');
        await notion.databases.update({
          database_id: commitFromGithubLogDatabaseId,
          properties: {
            [SHA_PROPERTY_NAME]: { rich_text: {} }
          }
        });
        schemaCache.hasShaProperty = true;
        console.log('✅ Added SHA property to Notion database');
      } catch (updateError) {
        console.warn('⚠️ Unable to add SHA property automatically. Continuing without SHA-based dedup.', updateError.message);
        // Don't set hasShaProperty to false here - let it remain undefined so we can retry
      }
    }
    
    return schemaCache;
    
  } catch (error) {
    console.error('❌ Error checking Notion database schema:', error.message);
    
    // If this is a network/API error, don't permanently disable SHA property
    // Instead, mark as unchecked so we can retry on next attempt
    if (error.code === 'rate_limited' || error.status === 429 || error.status === 500) {
      console.log('🔄 Schema check failed due to API issues, will retry on next attempt');
      schemaCache.checked = false;
      schemaCache.hasShaProperty = false;
    } else {
      // For other errors, assume no SHA property but allow retry
      schemaCache.checked = true;
      schemaCache.hasShaProperty = false;
    }
    
    return schemaCache;
  }
}

async function getExistingCommitsForRepo(repoName, skipLegacyDedup = false) {
  // Check cache first with TTL
  const cached = existingCommitsCache.get(repoName);
  if (cached && Date.now() - cached.timestamp < CACHE_CONFIG.ttl) {
    console.log(`📋 Using cached commits for ${repoName} (age: ${Math.round((Date.now() - cached.timestamp) / 1000)}s)`);
    return cached.data;
  }

  // If cache is expired but exists, log it for debugging
  if (cached) {
    console.log(`⚠️ Cache expired for ${repoName} (age: ${Math.round((Date.now() - cached.timestamp) / 1000)}s), refetching...`);
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
  const maxPages = 50; // Increased from 20 to prevent timeouts on very large repos
  
  try {
    // Add timeout for the entire fetch operation - longer for large repos
    const fetchTimeout = setTimeout(() => {
      console.log(`⚠️ Timeout while fetching existing commits for ${repoName} - using partial data`);
      throw new Error('Timeout fetching existing commits');
    }, 120000); // Increased from 60 to 120 seconds for large repos
    
    try {
      while (hasMore && pageCount < maxPages) {
        pageCount++;
        console.log(`📄 Fetching existing commits page ${pageCount} for ${repoName}...`);
        
        const response = await notion.databases.query({
          database_id: commitFromGithubLogDatabaseId,
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
      
      // Log warning if we hit page limits (potential incomplete data)
      if (pageCount >= maxPages && hasMore) {
        console.warn(`⚠️ WARNING: Hit maximum page limit (${maxPages}) for ${repoName}. Data may be incomplete, which could lead to duplicates.`);
        console.warn(`   Consider running with --sha-only mode for very large repositories.`);
      }
      
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
  
  // For very large batches, we might want to force a fresh fetch to ensure complete deduplication
  if (commits.length > CACHE_CONFIG.batchSize * 2) {
    console.log(`🔄 Large batch detected (${commits.length} commits), ensuring fresh deduplication data...`);
    const freshData = await getExistingCommitsForRepo(repoName, false); // Force fresh fetch with legacy dedup
    existingCommits.clear();
    existingShas.clear();
    freshData.existingCommits.forEach(key => existingCommits.add(key));
    freshData.existingShas.forEach(sha => existingShas.add(sha));
    console.log(`🔄 Fresh deduplication data loaded: ${existingCommits.size} legacy keys, ${existingShas.size} SHAs`);
  }
  
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
      console.log(`⏭️ Skipping duplicate SHA: ${commit.id.substring(0, 8)} (${commit.message.substring(0, 50)}...)`);
    }
    // Check legacy deduplication
    else if (existingCommits.has(`${commit.message}|${commit.timestamp}`)) {
      shouldSkip = true;
      skipReason = 'Message + date combination already exists';
      console.log(`⏭️ Skipping duplicate message+date: ${commit.id.substring(0, 8)} (${commit.message.substring(0, 50)}...)`);
    }
    
    if (shouldSkip) {
      skipped++;
      skipReasons.push(`${commit.id.substring(0, 8)}: ${skipReason}`);
    } else {
      commitsToProcess.push(commit);
    }
  }
  
  if (commitsToProcess.length === 0) {
    console.log(`⏭️ All ${commits.length} commits in batch already exist, skipping...`);
    return { processed: 0, skipped, errors: 0 };
  }
  
  console.log(`📝 Processing ${commitsToProcess.length} new commits (${skipped} skipped)`);
  
  // Log detailed skip reasons for debugging
  if (skipReasons.length > 0) {
    console.log(`📋 Skip reasons summary:`);
    skipReasons.slice(0, 10).forEach(reason => console.log(`   - ${reason}`));
    if (skipReasons.length > 10) {
      console.log(`   ... and ${skipReasons.length - 10} more`);
    }
  }
  
  // Process commits in parallel batches for better performance
  const parallelBatches = [];
  for (let i = 0; i < commitsToProcess.length; i += 10) { // Process 10 commits in parallel
    parallelBatches.push(commitsToProcess.slice(i, i + 10));
  }
  
  for (const parallelBatch of parallelBatches) {
    const batchPromises = parallelBatch.map(async (commit) => {
      try {
        // Final safety check: verify the commit doesn't exist before creating
        const finalCheck = await notion.databases.query({
          database_id: commitFromGithubLogDatabaseId,
          filter: {
            and: [
              {
                property: "Project Name",
                title: {
                  equals: repoName.split('/').pop()
                }
              },
              {
                property: SHA_PROPERTY_NAME,
                rich_text: {
                  equals: commit.id
                }
              }
            ]
          },
          page_size: 1
        });
        
        if (finalCheck.results.length > 0) {
          console.log(`⚠️ Final check: Commit ${commit.id.substring(0, 8)} already exists, skipping...`);
          return { success: true, skipped: true };
        }
        
        await createCommitPage(commit, repoName);
        return { success: true };
      } catch (error) {
        console.error(`❌ Error creating page for commit ${commit.id}:`, error.message);
        return { success: false, error: error.message };
      }
    });
    
    const batchResults = await Promise.allSettled(batchPromises);
    
    batchResults.forEach(result => {
      if (result.status === 'fulfilled') {
        if (result.value.success) {
          if (result.value.skipped) {
            skipped++;
          } else {
            processed++;
          }
        } else {
          errors++;
        }
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
  // Ensure we have the latest schema information before creating the page
  await ensureDatabaseSchemaLoaded();
  
  // Get the effective date for timezone logic, but preserve the full timestamp
  const effectiveDate = timezoneConfig.getEffectiveDate(commit.timestamp);
  
  // Create a new Date object from the effective date and add the time from the original timestamp
  const originalDate = new Date(commit.timestamp);
  const effectiveDateObj = new Date(effectiveDate);
  
  // Preserve the time from the original commit but use the effective date
  const finalTimestamp = new Date(
    effectiveDateObj.getFullYear(),
    effectiveDateObj.getMonth(),
    effectiveDateObj.getDate(),
    originalDate.getUTCHours(),
    originalDate.getUTCMinutes(),
    originalDate.getUTCSeconds()
  );
  
  // Truncate commit message if it's too long for Notion (2000 char limit)
  // Leave some buffer (1990 chars) to be safe
  const maxLength = 1990;
  let commitMessage = commit.message;
  let wasTruncated = false;
  
  if (commitMessage.length > maxLength) {
    commitMessage = commitMessage.substring(0, maxLength - 3) + '...';
    wasTruncated = true;
    console.log(`⚠️  Truncated commit message for ${repoName} (was ${commit.message.length} chars, now ${commitMessage.length})`);
  }
  
  const properties = {
    "Commits": {
      rich_text: [{ text: { content: commitMessage } }],
    },
    "Project Name": {
      title: [{ text: { content: repoName.split('/').pop() } }],
    },
    "Date": {
      // Store the full timestamp with time information
      date: { start: finalTimestamp.toISOString() },
    }
  };
  
  // Always try to set SHA property if we have a commit ID
  // This ensures we don't lose SHA values due to schema cache issues
  if (commit.id) {
    properties[SHA_PROPERTY_NAME] = {
      rich_text: [{ text: { content: commit.id } }]
    };
    console.log(`🔐 Setting SHA property for commit ${commit.id.substring(0, 8)}`);
  } else {
    console.warn(`⚠️ No commit ID available for commit: ${commit.message.substring(0, 50)}...`);
  }

  await notion.pages.create({
    parent: { database_id: commitFromGithubLogDatabaseId },
    properties
  });
}

async function getMostRecentCommitDate(repoName) {
  try {
    console.log(`🔍 Finding most recent commit date for ${repoName}...`);
    
    // Query the database for the most recent commit for this repo
    const response = await notion.databases.query({
      database_id: commitFromGithubLogDatabaseId,
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

// Function to retroactively add SHA values to existing commits
async function addMissingShaValues() {
  try {
    console.log('🔍 Checking for commits without SHA values...');
    
    await ensureDatabaseSchemaLoaded();
    
    let hasMore = true;
    let startCursor = undefined;
    let pageCount = 0;
    let totalChecked = 0;
    let totalUpdated = 0;
    let totalErrors = 0;
    const maxPages = 100; // Check up to 100 pages
    
    while (hasMore && pageCount < maxPages) {
      pageCount++;
      console.log(`📄 Checking page ${pageCount} for commits without SHA values...`);
      
      const response = await notion.databases.query({
        database_id: commitFromGithubLogDatabaseId,
        filter: {
          and: [
            {
              property: SHA_PROPERTY_NAME,
              rich_text: {
                is_empty: true
              }
            }
          ]
        },
        page_size: 100,
        start_cursor: startCursor,
      });
      
      if (response.results.length === 0) {
        console.log('✅ No more commits without SHA values found');
        break;
      }
      
      console.log(`📝 Found ${response.results.length} commits without SHA values on page ${pageCount}`);
      
      // Process each commit without SHA
      for (const page of response.results) {
        totalChecked++;
        
        try {
          // Try to extract commit info from the page
          const commitMessage = page.properties["Commits"]?.rich_text?.[0]?.plain_text;
          const projectName = page.properties["Project Name"]?.title?.[0]?.plain_text;
          const commitDate = page.properties["Date"]?.date?.start;
          
          if (commitMessage && projectName && commitDate) {
            console.log(`🔍 Checking commit: ${commitMessage.substring(0, 50)}... (${projectName})`);
            
            // For now, we can't recover the SHA from existing data
            // But we can mark it as needing manual review
            console.log(`⚠️ Cannot recover SHA for existing commit. Consider re-running backfill for ${projectName}`);
          }
        } catch (error) {
          console.error(`❌ Error processing page ${page.id}:`, error.message);
          totalErrors++;
        }
      }
      
      hasMore = response.has_more;
      startCursor = response.next_cursor;
      
      // Small delay between pages
      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log(`\n📊 SHA Value Check Summary:`);
    console.log(`🔍 Total commits checked: ${totalChecked}`);
    console.log(`✅ Total commits updated: ${totalUpdated}`);
    console.log(`❌ Total errors: ${totalErrors}`);
    
    if (totalChecked > 0 && totalUpdated === 0) {
      console.log(`\n💡 Recommendation: Re-run backfill for repositories with missing SHA values`);
      console.log(`   This will ensure all commits have proper SHA values for deduplication`);
    }
    
  } catch (error) {
    console.error('❌ Error checking for missing SHA values:', error.message);
  }
}

module.exports = { 
  logCommitsToNotion, 
  getMostRecentCommitDate,
  addWeeklyPlanningEntry,
  getWeeklyPlanningData,
  updateWeeklyPlanningEntry,
  ensureWeeklyPlanningDatabase,
  addMissingShaValues,
  commitFromGithubLogDatabaseId
};
