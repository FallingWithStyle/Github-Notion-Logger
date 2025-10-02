const { Client } = require('@notionhq/client');
require('dotenv').config();

const notion = new Client({ auth: process.env.NOTION_API_KEY });

// Weekly planning database ID (will be created if doesn't exist)
let weeklyPlanningDatabaseId = null;

// Weekly planning database schema
const WEEKLY_PLANNING_SCHEMA = {
  "Project Name": { title: {} },
  "Week Start": { date: {} },
  "Head": { number: {} },
  "Heart": { number: {} },
  "Category": { select: {} },
  "Status": { select: {} },
  "Weekly Focus": { rich_text: {} },
  "Notes": { rich_text: {} },
  "Created": { created_time: {} },
  "Last Updated": { last_edited_time: {} }
};

// Category options for weekly planning
const CATEGORY_OPTIONS = [
  { name: "Writing & Story Tools", color: "purple" },
  { name: "Infrastructure & Utilities", color: "blue" },
  { name: "Avoros (Shared Fantasy/Game World)", color: "green" },
  { name: "Miscellaneous / Standalone", color: "orange" },
  { name: "Development", color: "red" },
  { name: "Research", color: "pink" }
];

// Status options for weekly planning
const STATUS_OPTIONS = [
  { name: "Active", color: "green" },
  { name: "Planning", color: "yellow" },
  { name: "Review", color: "blue" },
  { name: "Idea", color: "gray" },
  { name: "Done", color: "brown" }
];

/**
 * Ensure the weekly planning database exists and has the correct schema
 */
async function ensureWeeklyPlanningDatabase() {
  if (weeklyPlanningDatabaseId) {
    return weeklyPlanningDatabaseId;
  }

  try {
    // Check if database already exists
    const response = await notion.search({
      query: 'Weekly Planning',
      filter: {
        property: 'object',
        value: 'database'
      }
    });

    let database = response.results.find(db => 
      db.title && db.title[0] && db.title[0].plain_text === 'Weekly Planning'
    );

    if (database) {
      weeklyPlanningDatabaseId = database.id;
      console.log('✅ Found existing Weekly Planning database');
      return weeklyPlanningDatabaseId;
    }

    // Create new database
    console.log('📝 Creating Weekly Planning database...');
    
    const parent = {
      type: 'page_id',
      page_id: process.env.NOTION_WEEKLY_PLANNING_PARENT_PAGE_ID || process.env.NOTION_COMMIT_FROM_GITHUB_LOG_ID
    };

    const databaseResponse = await notion.databases.create({
      parent,
      title: [{ type: 'text', text: { content: 'Weekly Planning' } }],
      properties: WEEKLY_PLANNING_SCHEMA
    });

    weeklyPlanningDatabaseId = databaseResponse.id;
    console.log('✅ Created Weekly Planning database');

    // Add category options
    await notion.databases.update({
      database_id: weeklyPlanningDatabaseId,
      properties: {
        "Category": {
          select: {
            options: CATEGORY_OPTIONS
          }
        }
      }
    });

    // Add status options
    await notion.databases.update({
      database_id: weeklyPlanningDatabaseId,
      properties: {
        "Status": {
          select: {
            options: STATUS_OPTIONS
          }
        }
      }
    });

    console.log('✅ Added category and status options to Weekly Planning database');
    return weeklyPlanningDatabaseId;

  } catch (error) {
    console.error('❌ Error ensuring Weekly Planning database:', error);
    throw error;
  }
}

/**
 * Find an existing weekly planning entry for a project and week
 */
async function findWeeklyPlanningEntry(projectName, weekStart) {
  try {
    const databaseId = await ensureWeeklyPlanningDatabase();
    
    const response = await notion.databases.query({
      database_id: databaseId,
      filter: {
        and: [
          {
            property: 'Project Name',
            title: {
              equals: projectName
            }
          },
          {
            property: 'Week Start',
            date: {
              equals: weekStart
            }
          }
        ]
      }
    });

    return response.results[0] || null;
  } catch (error) {
    console.error('❌ Error finding weekly planning entry:', error);
    return null;
  }
}

/**
 * Add or update a weekly planning entry
 */
async function addOrUpdateWeeklyPlanningEntry(projectData) {
  try {
    const databaseId = await ensureWeeklyPlanningDatabase();
    
    const {
      projectName,
      weekStart,
      head,
      heart,
      category,
      status,
      weeklyFocus = '',
      notes = ''
    } = projectData;

    // Check if entry already exists
    const existingEntry = await findWeeklyPlanningEntry(projectName, weekStart);

    const entryData = {
      "Project Name": {
        title: [{ type: 'text', text: { content: projectName } }]
      },
      "Week Start": {
        date: { start: weekStart }
      },
      "Head": {
        number: head || null
      },
      "Heart": {
        number: heart || null
      },
      "Category": {
        select: category ? { name: category } : null
      },
      "Status": {
        select: status ? { name: status } : null
      },
      "Weekly Focus": {
        rich_text: [{ type: 'text', text: { content: weeklyFocus } }]
      },
      "Notes": {
        rich_text: [{ type: 'text', text: { content: notes } }]
      }
    };

    if (existingEntry) {
      // Update existing entry
      const response = await notion.pages.update({
        page_id: existingEntry.id,
        properties: entryData
      });
      
      console.log(`📝 Updated weekly planning entry for ${projectName} (week ${weekStart})`);
      return { id: response.id, action: 'updated' };
    } else {
      // Create new entry
      const response = await notion.pages.create({
        parent: { database_id: databaseId },
        properties: entryData
      });
      
      console.log(`📝 Created weekly planning entry for ${projectName} (week ${weekStart})`);
      return { id: response.id, action: 'created' };
    }
  } catch (error) {
    console.error('❌ Error adding/updating weekly planning entry:', error);
    throw error;
  }
}

/**
 * Add a new weekly planning entry (alias for addOrUpdateWeeklyPlanningEntry)
 */
async function addWeeklyPlanningEntry(projectData) {
  return addOrUpdateWeeklyPlanningEntry(projectData);
}

/**
 * Get weekly planning data for a specific week or all weeks
 */
async function getWeeklyPlanningData(weekStart = null) {
  try {
    const databaseId = await ensureWeeklyPlanningDatabase();
    
    let filter = {};
    if (weekStart) {
      filter = {
        property: 'Week Start',
        date: {
          equals: weekStart
        }
      };
    }

    const response = await notion.databases.query({
      database_id: databaseId,
      filter,
      sorts: [
        { property: 'Week Start', direction: 'descending' },
        { property: 'Project Name', direction: 'ascending' }
      ]
    });

    const entries = response.results.map(page => {
      const properties = page.properties;
      return {
        id: page.id,
        projectName: properties['Project Name']?.title?.[0]?.text?.content || '',
        weekStart: properties['Week Start']?.date?.start || '',
        head: properties['Head']?.number || null,
        heart: properties['Heart']?.number || null,
        category: properties['Category']?.select?.name || '',
        status: properties['Status']?.select?.name || '',
        weeklyFocus: properties['Weekly Focus']?.rich_text?.[0]?.text?.content || '',
        notes: properties['Notes']?.rich_text?.[0]?.text?.content || '',
        created: properties['Created']?.created_time || '',
        lastUpdated: properties['Last Updated']?.last_edited_time || ''
      };
    });

    console.log(`📊 Retrieved ${entries.length} weekly planning entries${weekStart ? ` for week ${weekStart}` : ''}`);
    return entries;
  } catch (error) {
    console.error('❌ Error getting weekly planning data:', error);
    throw error;
  }
}

/**
 * Update an existing weekly planning entry
 */
async function updateWeeklyPlanningEntry(entryId, updates) {
  try {
    const entryData = {};
    
    if (updates.head !== undefined) entryData['Head'] = { number: updates.head };
    if (updates.heart !== undefined) entryData['Heart'] = { number: updates.heart };
    if (updates.category) entryData['Category'] = { select: { name: updates.category } };
    if (updates.status) entryData['Status'] = { select: { name: updates.status } };
    if (updates.weeklyFocus !== undefined) {
      entryData['Weekly Focus'] = { rich_text: [{ type: 'text', text: { content: updates.weeklyFocus } }] };
    }
    if (updates.notes !== undefined) {
      entryData['Notes'] = { rich_text: [{ type: 'text', text: { content: updates.notes } }] };
    }

    const response = await notion.pages.update({
      page_id: entryId,
      properties: entryData
    });

    console.log(`📝 Updated weekly planning entry ${entryId}`);
    return response;
  } catch (error) {
    console.error('❌ Error updating weekly planning entry:', error);
    throw error;
  }
}

/**
 * Clean up duplicate entries for a specific week
 */
async function cleanupDuplicateEntries(weekStart) {
  try {
    const databaseId = await ensureWeeklyPlanningDatabase();
    
    // Get all entries for the week
    const response = await notion.databases.query({
      database_id: databaseId,
      filter: {
        property: 'Week Start',
        date: {
          equals: weekStart
        }
      }
    });

    // Group by project name
    const entriesByProject = {};
    response.results.forEach(page => {
      const projectName = page.properties['Project Name']?.title?.[0]?.text?.content;
      if (projectName) {
        if (!entriesByProject[projectName]) {
          entriesByProject[projectName] = [];
        }
        entriesByProject[projectName].push(page);
      }
    });

    let duplicatesRemoved = 0;

    // For each project with multiple entries, keep the most recent one
    for (const [projectName, entries] of Object.entries(entriesByProject)) {
      if (entries.length > 1) {
        // Sort by last updated time (most recent first)
        entries.sort((a, b) => {
          const timeA = new Date(a.properties['Last Updated']?.last_edited_time || 0);
          const timeB = new Date(b.properties['Last Updated']?.last_edited_time || 0);
          return timeB - timeA;
        });

        // Keep the first (most recent) entry, delete the rest
        const toDelete = entries.slice(1);
        for (const entry of toDelete) {
          await notion.pages.update({
            page_id: entry.id,
            archived: true
          });
          duplicatesRemoved++;
        }

        console.log(`🧹 Removed ${toDelete.length} duplicate entries for ${projectName}`);
      }
    }

    console.log(`✅ Cleanup completed: ${duplicatesRemoved} duplicate entries removed`);
    return duplicatesRemoved;
  } catch (error) {
    console.error('❌ Error cleaning up duplicate entries:', error);
    throw error;
  }
}

module.exports = {
  ensureWeeklyPlanningDatabase,
  findWeeklyPlanningEntry,
  addOrUpdateWeeklyPlanningEntry,
  addWeeklyPlanningEntry,
  getWeeklyPlanningData,
  updateWeeklyPlanningEntry,
  cleanupDuplicateEntries
};
