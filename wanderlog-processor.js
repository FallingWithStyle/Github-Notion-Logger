const { Client } = require('@notionhq/client');
const { Octokit } = require('@octokit/rest');
const OpenAI = require('openai');
const cron = require('node-cron');
require('dotenv').config();

// Validate required environment variables (only when actually running functions)
function validateEnvironment() {
  if (!process.env.NOTION_API_KEY) {
    throw new Error('NOTION_API_KEY environment variable not set');
  }

  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable not set');
  }

  if (!process.env.GITHUB_TOKEN) {
    throw new Error('GITHUB_TOKEN environment variable not set');
  }
}

// Initialize clients only when needed
let notion, octokit, openai;

function initializeClients() {
  if (!notion) {
    notion = new Client({ auth: process.env.NOTION_API_KEY });
  }
  if (!octokit) {
    octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
  }
  if (!openai) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
}

// Wanderlog database ID (will be created if doesn't exist)
let wanderlogDatabaseId = null;

// Wanderlog database schema
const WANDERLOG_SCHEMA = {
  "Title": { title: {} },
  "Date": { date: {} },
  "Commit Count": { number: {} },
  "Projects": { rich_text: {} },
  "Summary": { rich_text: {} },
  "Insights": { rich_text: {} },
  "Focus Areas": { rich_text: {} },
  "Created": { date: {} },
  "Last Updated": { date: {} }
};

// Ensure Wanderlog database exists
async function ensureWanderlogDatabase() {
  console.log('🔄 Ensuring Wanderlog database exists...');
  
  // Use environment variable if available
  if (process.env.NOTION_WANDERLOG_DATABASE_ID) {
    wanderlogDatabaseId = process.env.NOTION_WANDERLOG_DATABASE_ID;
    console.log('🔄 Using environment variable database ID:', wanderlogDatabaseId);
    
    // Verify the database has the correct schema
    try {
      const db = await notion.databases.retrieve({ database_id: wanderlogDatabaseId });
      console.log('✅ Wanderlog database verified');
      return wanderlogDatabaseId;
    } catch (error) {
      console.error('❌ Error verifying Wanderlog database:', error);
      wanderlogDatabaseId = null;
    }
  }

  try {
    console.log('🔄 Searching for existing Wanderlog database...');
    const response = await notion.search({
      query: "Wanderlog",
      filter: {
        property: "object",
        value: "database"
      }
    });

    if (response.results.length > 0) {
      wanderlogDatabaseId = response.results[0].id;
      console.log(`📊 Found existing Wanderlog database: ${wanderlogDatabaseId}`);
      return wanderlogDatabaseId;
    }

    console.log('🔧 Creating new Wanderlog database...');
    
    // Use the same parent as other databases
    let parentId = process.env.NOTION_WEEKLY_PROJECT_PLAN_PARENT_PAGE_ID || process.env.NOTION_COMMIT_FROM_GITHUB_LOG_ID;
    let parentType = "page_id";
    
    // Check if the parent ID is actually a database ID
    try {
      const parentCheck = await notion.databases.retrieve({ database_id: parentId });
      console.log('⚠️ Parent ID is actually a database ID, finding a page within it...');
      
      const pagesResponse = await notion.databases.query({
        database_id: parentId,
        page_size: 1
      });
      
      if (pagesResponse.results.length > 0) {
        parentId = pagesResponse.results[0].id;
        parentType = "page_id";
        console.log(`✅ Found page within database to use as parent: ${parentId}`);
      } else {
        parentType = "database_id";
      }
    } catch (error) {
      console.log('✅ Parent ID appears to be a valid page ID');
    }
    
    const newDatabase = await notion.databases.create({
      parent: { type: parentType, [parentType === "page_id" ? "page_id" : "database_id"]: parentId },
      title: [{ type: "text", text: { content: "Wanderlog" } }],
      properties: WANDERLOG_SCHEMA,
      description: [{ type: "text", text: { content: "Daily commit summaries and development insights" } }]
    });

    wanderlogDatabaseId = newDatabase.id;
    console.log(`✅ Created Wanderlog database: ${wanderlogDatabaseId}`);
    return wanderlogDatabaseId;
  } catch (error) {
    console.error('❌ Error ensuring Wanderlog database:', error);
    throw error;
  }
}

// Get commits from the previous day
async function getPreviousDayCommits() {
  validateEnvironment();
  initializeClients();
  
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  console.log(`🔍 Fetching commits from ${yesterday.toISOString()} to ${today.toISOString()}`);
  
  try {
    // Get all repositories
    const repos = await octokit.rest.repos.listForAuthenticatedUser({
      per_page: 100,
      sort: 'updated',
      direction: 'desc'
    });
    
    const allCommits = [];
    
    for (const repo of repos.data) {
      try {
        console.log(`📝 Checking commits in ${repo.full_name}...`);
        
        const commits = await octokit.rest.repos.listCommits({
          owner: repo.owner.login,
          repo: repo.name,
          since: yesterday.toISOString(),
          until: today.toISOString(),
          per_page: 100
        });
        
        if (commits.data.length > 0) {
          console.log(`✅ Found ${commits.data.length} commits in ${repo.full_name}`);
          
          for (const commit of commits.data) {
            allCommits.push({
              id: commit.sha,
              message: commit.commit.message,
              author: commit.commit.author.name,
              date: commit.commit.author.date,
              repo: repo.full_name,
              url: commit.html_url
            });
          }
        }
      } catch (error) {
        console.warn(`⚠️ Error fetching commits from ${repo.full_name}:`, error.message);
      }
    }
    
    console.log(`📊 Total commits found: ${allCommits.length}`);
    return allCommits;
  } catch (error) {
    console.error('❌ Error fetching commits:', error);
    return [];
  }
}

// Filter out insignificant commits
function filterSignificantCommits(commits) {
  const insignificantPatterns = [
    /^fix typo/i,
    /^typo$/i,
    /^correct typo/i,
    /^fix grammar/i,
    /^grammar fix/i,
    /^spelling/i,
    /^fix spelling/i,
    /^update readme$/i,
    /^readme update$/i,
    /^bump version/i,
    /^version bump/i,
    /^merge branch/i,
    /^revert/i,
    /^wip$/i,
    /^work in progress$/i,
    /^temp$/i,
    /^temporary$/i,
    /^test$/i,
    /^testing$/i,
    /^debug$/i,
    /^console\.log/i,
    /^remove console/i,
    /^cleanup$/i,
    /^format$/i,
    /^lint$/i,
    /^eslint$/i,
    /^prettier$/i
  ];
  
  return commits.filter(commit => {
    const message = commit.message.toLowerCase();
    
    // Skip if message matches any insignificant pattern
    for (const pattern of insignificantPatterns) {
      if (pattern.test(message)) {
        return false;
      }
    }
    
    // Skip if message is too short (likely not significant)
    if (message.length < 10) {
      return false;
    }
    
    // Skip if it's just a merge commit
    if (message.includes('merge') && message.length < 50) {
      return false;
    }
    
    return true;
  });
}

// Generate summary using GPT-4o-mini
async function generateCommitSummary(commits) {
  validateEnvironment();
  initializeClients();
  
  if (commits.length === 0) {
    return {
      title: "No significant commits today",
      summary: "No significant development activity was recorded for this day.",
      insights: "A quiet day in the development journey.",
      focusAreas: "No specific focus areas identified."
    };
  }
  
  const commitText = commits.map(commit => 
    `- ${commit.message} (${commit.repo})`
  ).join('\n');
  
  const prompt = `Analyze these ${commits.length} commits from yesterday and create a compelling daily development summary. Focus on creating a story about the development work, not just listing commits.

Commits:
${commitText}

Please provide a JSON response with the following structure:
{
  "title": "An engaging title that captures the day's development story (max 100 chars)",
  "summary": "A compelling 2-3 sentence summary of the day's development work that tells a story",
  "insights": "Key insights about project coverage, focus areas, and development patterns (2-3 sentences)",
  "focusAreas": "Main focus areas or themes from the commits (comma-separated list)"
}

Make it engaging and story-like, but factual. Don't create fiction - base everything on the actual commits.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a development journalist who creates engaging daily summaries of coding work. Focus on the story and insights, not just technical details."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 1000
    });
    
    const response = completion.choices[0].message.content;
    return JSON.parse(response);
  } catch (error) {
    console.error('❌ Error generating summary with GPT-4o-mini:', error);
    
    // Fallback summary
    const projects = [...new Set(commits.map(c => c.repo.split('/')[1]))];
    return {
      title: `Development Activity: ${commits.length} commits across ${projects.length} projects`,
      summary: `Completed ${commits.length} commits across ${projects.join(', ')}. Development work focused on various improvements and features.`,
      insights: `Work spanned ${projects.length} different projects, showing diverse development activity.`,
      focusAreas: projects.join(', ')
    };
  }
}

// Create Wanderlog entry in Notion
async function createWanderlogEntry(summary, commits) {
  validateEnvironment();
  initializeClients();
  
  try {
    await ensureWanderlogDatabase();
    
    if (!wanderlogDatabaseId) {
      throw new Error('Failed to get valid Wanderlog database ID');
    }
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    
    const projects = [...new Set(commits.map(c => c.repo.split('/')[1]))];
    
    const entry = {
      parent: { database_id: wanderlogDatabaseId },
      properties: {
        "Title": {
          title: [{ type: "text", text: { content: summary.title } }]
        },
        "Date": {
          date: { start: yesterday.toISOString() }
        },
        "Commit Count": {
          number: commits.length
        },
        "Projects": {
          rich_text: [{ type: "text", text: { content: projects.join(', ') } }]
        },
        "Summary": {
          rich_text: [{ type: "text", text: { content: summary.summary } }]
        },
        "Insights": {
          rich_text: [{ type: "text", text: { content: summary.insights } }]
        },
        "Focus Areas": {
          rich_text: [{ type: "text", text: { content: summary.focusAreas } }]
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
    console.log(`✅ Created Wanderlog entry: ${summary.title}`);
    return result;
  } catch (error) {
    console.error('❌ Error creating Wanderlog entry:', error);
    throw error;
  }
}

// Main function to process daily commits
async function processDailyCommits() {
  validateEnvironment();
  initializeClients();
  
  try {
    console.log('🌅 Starting daily commit processing...');
    
    // Get commits from previous day
    const allCommits = await getPreviousDayCommits();
    
    if (allCommits.length === 0) {
      console.log('📭 No commits found for previous day, skipping Wanderlog entry');
      return;
    }
    
    // Filter significant commits
    const significantCommits = filterSignificantCommits(allCommits);
    console.log(`📊 Filtered to ${significantCommits.length} significant commits (from ${allCommits.length} total)`);
    
    if (significantCommits.length === 0) {
      console.log('📭 No significant commits found, skipping Wanderlog entry');
      return;
    }
    
    // Generate summary
    const summary = await generateCommitSummary(significantCommits);
    
    // Create Notion entry
    await createWanderlogEntry(summary, significantCommits);
    
    console.log('✅ Daily commit processing completed successfully');
  } catch (error) {
    console.error('❌ Error in daily commit processing:', error);
  }
}

// Schedule daily processing at 6am EST
function scheduleDailyProcessing() {
  // Run at 6am EST (11am UTC during standard time, 10am UTC during daylight time)
  // Using 11am UTC as a safe default
  cron.schedule('0 11 * * *', () => {
    console.log('⏰ Scheduled daily commit processing triggered');
    processDailyCommits();
  }, {
    timezone: "UTC"
  });
  
  console.log('⏰ Daily commit processing scheduled for 6am EST (11am UTC)');
}

// Manual trigger function for testing
async function runManualProcessing() {
  console.log('🔧 Running manual daily commit processing...');
  await processDailyCommits();
}

module.exports = {
  processDailyCommits,
  scheduleDailyProcessing,
  runManualProcessing,
  ensureWanderlogDatabase,
  getPreviousDayCommits,
  filterSignificantCommits,
  generateCommitSummary,
  createWanderlogEntry
};
