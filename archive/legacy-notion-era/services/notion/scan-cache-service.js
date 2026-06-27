const { Client } = require('@notionhq/client');
require('dotenv').config();

const notion = new Client({ auth: process.env.NOTION_API_KEY });

// Scan cache database ID (will be created if doesn't exist)
let scanCacheDatabaseId = null;

// Cache for repositories to prevent repeated database calls
const repositoriesCache = {
  data: null,
  lastUpdated: null,
  ttl: 5 * 60 * 1000 // 5 minutes
};

// Enhanced caching with TTL and batch operations
const CACHE_CONFIG = {
  ttl: 30 * 60 * 1000, // 30 minutes (increased from 5 minutes to prevent cache expiration during long backfills)
  maxSize: 100, // Max cached repos
  batchSize: 200, // Batch size for Notion operations
};

// Scan cache database schema
const SCAN_CACHE_SCHEMA = {
  "Repository": { title: {} },
  "Last Scanned": { date: {} },
  "Has PRD": { checkbox: {} },
  "Has Task List": { checkbox: {} },
  "Story Count": { number: {} },
  "Task Count": { number: {} },
  "Progress": { number: {} },
  "Scan Data": { rich_text: {} },
  "Created": { created_time: {} },
  "Last Updated": { last_edited_time: {} }
};

/**
 * Ensure the scan cache database exists and has the correct schema
 */
async function ensureScanCacheDatabase() {
  if (scanCacheDatabaseId) {
    return scanCacheDatabaseId;
  }

  try {
    // Check if database already exists
    const response = await notion.search({
      query: 'Scan Cache',
      filter: {
        property: 'object',
        value: 'database'
      }
    });

    let database = response.results.find(db => 
      db.title && db.title[0] && db.title[0].plain_text === 'Scan Cache'
    );

    if (database) {
      scanCacheDatabaseId = database.id;
      console.log('✅ Found existing Scan Cache database');
      return scanCacheDatabaseId;
    }

    // Create new database
    console.log('📝 Creating Scan Cache database...');
    
    const parent = {
      type: 'page_id',
      page_id: process.env.NOTION_SCAN_CACHE_PARENT_PAGE_ID || process.env.NOTION_COMMIT_FROM_GITHUB_LOG_ID
    };

    const databaseResponse = await notion.databases.create({
      parent,
      title: [{ type: 'text', text: { content: 'Scan Cache' } }],
      properties: SCAN_CACHE_SCHEMA
    });

    scanCacheDatabaseId = databaseResponse.id;
    console.log('✅ Created Scan Cache database');
    return scanCacheDatabaseId;

  } catch (error) {
    console.error('❌ Error ensuring Scan Cache database:', error);
    throw error;
  }
}

/**
 * Cache scan result for a repository
 */
async function cacheScanResult(repository, scanData) {
  try {
    const databaseId = await ensureScanCacheDatabase();
    
    const {
      hasPrd = false,
      hasTaskList = false,
      storyCount = 0,
      taskCount = 0,
      progress = 0,
      lastScanned = new Date().toISOString().split('T')[0],
      scanData: rawScanData = null
    } = scanData;

    // Check if entry already exists
    const existingResponse = await notion.databases.query({
      database_id: databaseId,
      filter: {
        property: 'Repository',
        title: {
          equals: repository
        }
      }
    });

    const entryData = {
      "Repository": {
        title: [{ type: 'text', text: { content: repository } }]
      },
      "Last Scanned": {
        date: { start: lastScanned }
      },
      "Has PRD": {
        checkbox: hasPrd
      },
      "Has Task List": {
        checkbox: hasTaskList
      },
      "Story Count": {
        number: storyCount
      },
      "Task Count": {
        number: taskCount
      },
      "Progress": {
        number: progress
      },
      "Scan Data": {
        rich_text: rawScanData ? [{ type: 'text', text: { content: JSON.stringify(rawScanData) } }] : []
      }
    };

    if (existingResponse.results.length > 0) {
      // Update existing entry
      const response = await notion.pages.update({
        page_id: existingResponse.results[0].id,
        properties: entryData
      });
      
      console.log(`📝 Updated scan cache for ${repository}`);
      return { id: response.id, action: 'updated' };
    } else {
      // Create new entry
      const response = await notion.pages.create({
        parent: { database_id: databaseId },
        properties: entryData
      });
      
      console.log(`📝 Cached scan result for ${repository}`);
      return { id: response.id, action: 'created' };
    }
  } catch (error) {
    console.error(`❌ Error caching scan result for ${repository}:`, error);
    throw error;
  }
}

/**
 * Get cached scan result for a repository
 */
async function getCachedScanResult(repository) {
  try {
    const databaseId = await ensureScanCacheDatabase();
    
    const response = await notion.databases.query({
      database_id: databaseId,
      filter: {
        property: 'Repository',
        title: {
          equals: repository
        }
      }
    });

    if (response.results.length === 0) {
      return null;
    }

    const page = response.results[0];
    const properties = page.properties;
    
    const result = {
      id: page.id,
      repository: properties['Repository']?.title?.[0]?.text?.content || '',
      lastScanned: properties['Last Scanned']?.date?.start || '',
      hasPrd: properties['Has PRD']?.checkbox || false,
      hasTaskList: properties['Has Task List']?.checkbox || false,
      storyCount: properties['Story Count']?.number || 0,
      taskCount: properties['Task Count']?.number || 0,
      progress: properties['Progress']?.number || 0,
      scanData: null,
      created: properties['Created']?.created_time || '',
      lastUpdated: properties['Last Updated']?.last_edited_time || ''
    };

    // Parse scan data if available
    const scanDataText = properties['Scan Data']?.rich_text?.[0]?.text?.content;
    if (scanDataText) {
      try {
        result.scanData = JSON.parse(scanDataText);
      } catch (error) {
        console.warn(`⚠️ Could not parse scan data for ${repository}:`, error.message);
      }
    }

    return result;
  } catch (error) {
    console.error(`❌ Error getting cached scan result for ${repository}:`, error);
    return null;
  }
}

/**
 * Check if repository has recent scan cache
 */
async function hasRecentScanCache(repository) {
  try {
    const cached = await getCachedScanResult(repository);
    if (!cached) {
      return false;
    }

    const lastScanned = new Date(cached.lastScanned);
    const now = new Date();
    const hoursSinceScan = (now - lastScanned) / (1000 * 60 * 60);

    // Consider cache valid for 24 hours
    return hoursSinceScan < 24;
  } catch (error) {
    console.error(`❌ Error checking recent scan cache for ${repository}:`, error);
    return false;
  }
}

/**
 * Clear scan cache
 */
async function clearScanCache() {
  try {
    const databaseId = await ensureScanCacheDatabase();
    
    // Get all entries
    const response = await notion.databases.query({
      database_id: databaseId,
      page_size: 100
    });

    let clearedCount = 0;

    // Archive all entries
    for (const page of response.results) {
      try {
        await notion.pages.update({
          page_id: page.id,
          archived: true
        });
        clearedCount++;
      } catch (error) {
        console.error(`❌ Error archiving page ${page.id}:`, error);
      }
    }

    console.log(`🗑️ Cleared ${clearedCount} scan cache entries`);
    return clearedCount;
  } catch (error) {
    console.error('❌ Error clearing scan cache:', error);
    throw error;
  }
}

/**
 * Get all cached repositories
 */
async function getAllCachedRepositories() {
  // Check cache first
  if (repositoriesCache.data && repositoriesCache.lastUpdated) {
    const now = Date.now();
    if (now - repositoriesCache.lastUpdated < repositoriesCache.ttl) {
      return repositoriesCache.data;
    }
  }

  try {
    const databaseId = await ensureScanCacheDatabase();
    
    const response = await notion.databases.query({
      database_id: databaseId,
      sorts: [
        { property: 'Last Scanned', direction: 'descending' }
      ]
    });

    const repositories = response.results.map(page => {
      const properties = page.properties;
      return {
        id: page.id,
        repository: properties['Repository']?.title?.[0]?.text?.content || '',
        lastScanned: properties['Last Scanned']?.date?.start || '',
        hasPrd: properties['Has PRD']?.checkbox || false,
        hasTaskList: properties['Has Task List']?.checkbox || false,
        storyCount: properties['Story Count']?.number || 0,
        taskCount: properties['Task Count']?.number || 0,
        progress: properties['Progress']?.number || 0,
        created: properties['Created']?.created_time || '',
        lastUpdated: properties['Last Updated']?.last_edited_time || ''
      };
    });

    // Update cache
    repositoriesCache.data = repositories;
    repositoriesCache.lastUpdated = Date.now();

    console.log(`📊 Retrieved ${repositories.length} cached repositories`);
    return repositories;
  } catch (error) {
    console.error('❌ Error getting all cached repositories:', error);
    return [];
  }
}

/**
 * Invalidate repositories cache
 */
function invalidateRepositoriesCache() {
  repositoriesCache.data = null;
  repositoriesCache.lastUpdated = null;
  console.log('🗑️ Repositories cache invalidated');
}

module.exports = {
  ensureScanCacheDatabase,
  cacheScanResult,
  getCachedScanResult,
  hasRecentScanCache,
  clearScanCache,
  getAllCachedRepositories,
  invalidateRepositoriesCache
};
