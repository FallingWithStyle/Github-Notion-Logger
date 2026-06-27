const { Client } = require('@notionhq/client');
require('dotenv').config();

const notion = new Client({ auth: process.env.NOTION_API_KEY });

// PRD tracking database ID (will be created if doesn't exist)
let prdTrackingDatabaseId = null;

// PRD tracking database schema
const PRD_TRACKING_SCHEMA = {
  "Project Name": { title: {} },
  "Story Title": { rich_text: {} },
  "Status": { select: {} },
  "Priority": { number: {} },
  "Story Points": { number: {} },
  "Repository": { rich_text: {} },
  "Notes": { rich_text: {} },
  "Created": { created_time: {} },
  "Last Updated": { last_edited_time: {} }
};

// Status options for PRD stories
const STORY_STATUS_OPTIONS = [
  { name: "Active", color: "green" },
  { name: "Planning", color: "yellow" },
  { name: "Review", color: "blue" },
  { name: "Idea", color: "gray" },
  { name: "Done", color: "brown" }
];

/**
 * Ensure the PRD tracking database exists and has the correct schema
 */
async function ensurePrdTrackingDatabase() {
  if (prdTrackingDatabaseId) {
    return prdTrackingDatabaseId;
  }

  try {
    // Check if database already exists
    const response = await notion.search({
      query: 'PRD Stories',
      filter: {
        property: 'object',
        value: 'database'
      }
    });

    let database = response.results.find(db => 
      db.title && db.title[0] && db.title[0].plain_text === 'PRD Stories'
    );

    if (database) {
      prdTrackingDatabaseId = database.id;
      console.log('✅ Found existing PRD Stories database');
      return prdTrackingDatabaseId;
    }

    // Create new database
    console.log('📝 Creating PRD Stories database...');
    
    const parent = {
      type: 'page_id',
      page_id: process.env.NOTION_PRD_TRACKING_PARENT_PAGE_ID || process.env.NOTION_COMMIT_FROM_GITHUB_LOG_ID
    };

    const databaseResponse = await notion.databases.create({
      parent,
      title: [{ type: 'text', text: { content: 'PRD Stories' } }],
      properties: PRD_TRACKING_SCHEMA
    });

    prdTrackingDatabaseId = databaseResponse.id;
    console.log('✅ Created PRD Stories database');

    // Add status options
    await notion.databases.update({
      database_id: prdTrackingDatabaseId,
      properties: {
        "Status": {
          select: {
            options: STORY_STATUS_OPTIONS
          }
        }
      }
    });

    console.log('✅ Added status options to PRD Stories database');
    return prdTrackingDatabaseId;

  } catch (error) {
    console.error('❌ Error ensuring PRD Stories database:', error);
    throw error;
  }
}

/**
 * Add a new PRD story entry
 */
async function addPrdStoryEntry(storyData) {
  try {
    const databaseId = await ensurePrdTrackingDatabase();
    
    const {
      projectName,
      storyTitle,
      status = 'Idea',
      priority = 3,
      storyPoints = null,
      repository = '',
      notes = ''
    } = storyData;

    const entryData = {
      "Project Name": {
        title: [{ type: 'text', text: { content: projectName } }]
      },
      "Story Title": {
        rich_text: [{ type: 'text', text: { content: storyTitle } }]
      },
      "Status": {
        select: { name: status }
      },
      "Priority": {
        number: priority
      },
      "Story Points": {
        number: storyPoints
      },
      "Repository": {
        rich_text: [{ type: 'text', text: { content: repository } }]
      },
      "Notes": {
        rich_text: [{ type: 'text', text: { content: notes } }]
      }
    };

    const response = await notion.pages.create({
      parent: { database_id: databaseId },
      properties: entryData
    });

    console.log(`📝 Added PRD story: ${storyTitle} for ${projectName}`);
    return response;
  } catch (error) {
    console.error('❌ Error adding PRD story entry:', error);
    throw error;
  }
}

/**
 * Get PRD story data with optional filtering
 */
async function getPrdStoryData(projectName = null, status = null) {
  try {
    const databaseId = await ensurePrdTrackingDatabase();
    
    let filter = {};
    const conditions = [];

    if (projectName) {
      conditions.push({
        property: 'Project Name',
        title: {
          contains: projectName
        }
      });
    }

    if (status) {
      conditions.push({
        property: 'Status',
        select: {
          equals: status
        }
      });
    }

    if (conditions.length > 0) {
      filter = conditions.length === 1 ? conditions[0] : { and: conditions };
    }

    const response = await notion.databases.query({
      database_id: databaseId,
      filter,
      sorts: [
        { property: 'Project Name', direction: 'ascending' },
        { property: 'Priority', direction: 'ascending' },
        { property: 'Created', direction: 'descending' }
      ]
    });

    const stories = response.results.map(page => {
      const properties = page.properties;
      return {
        id: page.id,
        projectName: properties['Project Name']?.title?.[0]?.text?.content || '',
        storyTitle: properties['Story Title']?.rich_text?.[0]?.text?.content || '',
        status: properties['Status']?.select?.name || '',
        priority: properties['Priority']?.number || 3,
        storyPoints: properties['Story Points']?.number || null,
        repository: properties['Repository']?.rich_text?.[0]?.text?.content || '',
        notes: properties['Notes']?.rich_text?.[0]?.text?.content || '',
        created: properties['Created']?.created_time || '',
        lastUpdated: properties['Last Updated']?.last_edited_time || ''
      };
    });

    console.log(`📊 Retrieved ${stories.length} PRD stories${projectName ? ` for ${projectName}` : ''}${status ? ` with status ${status}` : ''}`);
    return stories;
  } catch (error) {
    console.error('❌ Error getting PRD story data:', error);
    throw error;
  }
}

/**
 * Update an existing PRD story entry
 */
async function updatePrdStoryEntry(entryId, updates) {
  try {
    const entryData = {};
    
    if (updates.storyTitle) {
      entryData['Story Title'] = { rich_text: [{ type: 'text', text: { content: updates.storyTitle } }] };
    }
    if (updates.status) {
      entryData['Status'] = { select: { name: updates.status } };
    }
    if (updates.priority !== undefined) {
      entryData['Priority'] = { number: updates.priority };
    }
    if (updates.storyPoints !== undefined) {
      entryData['Story Points'] = { number: updates.storyPoints };
    }
    if (updates.repository !== undefined) {
      entryData['Repository'] = { rich_text: [{ type: 'text', text: { content: updates.repository } }] };
    }
    if (updates.notes !== undefined) {
      entryData['Notes'] = { rich_text: [{ type: 'text', text: { content: updates.notes } }] };
    }

    const response = await notion.pages.update({
      page_id: entryId,
      properties: entryData
    });

    console.log(`📝 Updated PRD story entry ${entryId}`);
    return response;
  } catch (error) {
    console.error('❌ Error updating PRD story entry:', error);
    throw error;
  }
}

module.exports = {
  ensurePrdTrackingDatabase,
  addPrdStoryEntry,
  getPrdStoryData,
  updatePrdStoryEntry
};
