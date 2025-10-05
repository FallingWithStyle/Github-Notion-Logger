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
  "Created": { date: {} },
  "First Commit Date": { date: {} },
  "Commit Count": { number: {} },
  "Projects": { rich_text: {} },
  "Summary": { rich_text: {} },
  "Insights": { rich_text: {} },
  "Focus Areas": { rich_text: {} }
};

// Ensure Wanderlog database exists
async function ensureWanderlogDatabase() {
  console.log('🔄 Ensuring Wanderlog database exists...');
  
  // Initialize clients if needed
  initializeClients();
  
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

// Get commits for a specific date
async function getCommitsForDate(dateString) {
  validateEnvironment();
  initializeClients();
  
  const targetDate = new Date(dateString);
  targetDate.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);
  
  console.log(`🔍 Fetching commits from ${targetDate.toISOString()} to ${endOfDay.toISOString()}`);
  
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
          since: targetDate.toISOString(),
          until: endOfDay.toISOString(),
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
        if (error.status !== 409) { // Skip empty repositories
          console.log(`⚠️ Error fetching commits from ${repo.full_name}: ${error.message}`);
        }
      }
    }
    
    console.log(`📊 Total commits found: ${allCommits.length}`);
    return allCommits;
  } catch (error) {
    console.error('❌ Error fetching commits for date:', error);
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
  
  const prompt = `Analyze these ${commits.length} commits and create a compelling daily development summary. Focus on drawing meaningful insights about development patterns, project priorities, and technical decisions.

Commits:
${commitText}

Please provide a JSON response with the following structure:
{
  "title": "A creative, varied title that captures the day's development story (max 100 chars). Use different styles: questions, metaphors, alliteration, or action-oriented phrases. Avoid repetitive patterns.",
  "summary": "A compelling 2-3 sentence summary that specifically mentions project names and concrete technical work. Vary your sentence structure and approach - sometimes start with the impact, sometimes with the technical work, sometimes with the projects involved.",
  "insights": "Deep insights about development patterns, project priorities, technical decisions, and what this reveals about the developer's focus and approach (3-4 sentences)",
  "focusAreas": "Main focus areas or themes from the commits (comma-separated list)"
}

TITLE VARIETY EXAMPLES (use different styles):
- "Breaking Barriers: VoiceHub's Audio Revolution Takes Flight"
- "When Code Meets Creativity: A Day of Cross-Project Innovation"
- "The Great Refactor: Audventr's Architectural Transformation"
- "Bug Squashing Marathon: 42 Fixes Across 6 Projects"
- "From Chaos to Clarity: Streamlining the Development Pipeline"
- "The Performance Puzzle: Solving Speed Issues One Commit at a Time"
- "Feature Frenzy: New Capabilities Emerge Across the Stack"
- "The Integration Dance: Connecting the Dots Between Projects"

SUMMARY VARIETY EXAMPLES (vary your approach):
- "Today's work spanned multiple fronts: VoiceHub received major audio processing upgrades while Audventr saw significant architectural improvements..."
- "The development team focused heavily on performance optimization, with Kitch receiving 42 commits dedicated to deployment streamlining..."
- "Cross-project collaboration was the theme of the day, with shared infrastructure improvements benefiting both Devra and Friend-Party..."
- "A day of consolidation saw the team addressing technical debt across multiple repositories, with particular attention to error handling and user experience..."

IMPORTANT: When mentioning project names, use ONLY the actual project name (the part after the slash in the repo path). For example:
- "FallingWithStyle/VoiceHub" should be referred to as "VoiceHub"
- "FallingWithStyle/Audventr" should be referred to as "Audventr" 
- "FallingWithStyle/Github-Notion-Logger" should be referred to as "Github-Notion-Logger"
- "FallingWithStyle/Kitch" should be referred to as "Kitch"

NEVER refer to "FallingWithStyle" as a project - it's the GitHub username, not a project name.

Focus on insights such as:
- What patterns emerge in the types of work being done across different projects?
- What does the commit distribution across projects reveal about priorities?
- Are there any interesting technical decisions or architectural changes in specific projects?
- What does the commit message style and content reveal about development approach?
- Are there any signs of technical debt, refactoring, or innovation in particular projects?
- What does the work suggest about the developer's current challenges or goals?

CRITICAL: Vary your writing style! Don't use the same sentence structures, title patterns, or summary approaches. Be creative while staying factual and specific about project names and technical work.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a creative senior development analyst who creates varied, engaging daily summaries of coding work. Your role is to identify patterns, draw meaningful conclusions, and provide strategic insights about development practices, project priorities, and technical decisions. CRITICAL: Vary your writing style, title formats, and summary approaches. Use different sentence structures, creative titles, and varied summary styles to avoid repetition. When mentioning projects, use ONLY the actual project name (the part after the slash in repo paths like 'FallingWithStyle/ProjectName' - refer to it as just 'ProjectName'). NEVER refer to 'FallingWithStyle' as a project name - it's the GitHub username. Focus on what the commits reveal about the developer's approach, challenges, and goals rather than just describing what was done."
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
    
    // Clean up the response to extract JSON
    let jsonResponse = response.trim();
    
    // Remove markdown code blocks if present
    if (jsonResponse.startsWith('```json')) {
      jsonResponse = jsonResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (jsonResponse.startsWith('```')) {
      jsonResponse = jsonResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    
    return JSON.parse(jsonResponse);
  } catch (error) {
    console.error('❌ Error generating summary with GPT-4o-mini:', error);
    
    // Fallback summary
    const projects = [...new Set(commits.map(c => c.repo.split('/')[1]))];
    const projectCount = projects.length;
    const commitCount = commits.length;
    
    // Analyze commit patterns for insights
    const commitTypes = commits.map(c => {
      const msg = c.message.toLowerCase();
      if (msg.includes('fix') || msg.includes('bug')) return 'fixes';
      if (msg.includes('add') || msg.includes('implement') || msg.includes('create')) return 'features';
      if (msg.includes('refactor') || msg.includes('improve') || msg.includes('optimize')) return 'improvements';
      if (msg.includes('update') || msg.includes('upgrade')) return 'updates';
      return 'other';
    });
    
    const typeCounts = commitTypes.reduce((acc, type) => {
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});
    
    const dominantType = Object.entries(typeCounts).reduce((a, b) => typeCounts[a[0]] > typeCounts[b[0]] ? a : b)[0];
    
    // Create project-specific summaries
    const projectSummaries = projects.map(project => {
      const projectCommits = commits.filter(c => c.repo.includes(project));
      const projectTypeCounts = projectCommits.map(c => {
        const msg = c.message.toLowerCase();
        if (msg.includes('fix') || msg.includes('bug')) return 'fixes';
        if (msg.includes('add') || msg.includes('implement') || msg.includes('create')) return 'features';
        if (msg.includes('refactor') || msg.includes('improve') || msg.includes('optimize')) return 'improvements';
        if (msg.includes('update') || msg.includes('upgrade')) return 'updates';
        return 'other';
      }).reduce((acc, type) => {
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {});
      
      const projectDominantType = Object.entries(projectTypeCounts).reduce((a, b) => projectTypeCounts[a[0]] > projectTypeCounts[b[0]] ? a : b)[0];
      return `${project} (${projectDominantType})`;
    });
    
    return {
      title: `Development Focus: ${commitCount} commits across ${projectCount} projects`,
      summary: `Developers completed ${commitCount} commits across ${projects.join(' and ')} with a focus on ${dominantType}. The work demonstrates active development with ${projectSummaries.join(', ')} being the primary activities.`,
      insights: `The commit distribution reveals ${projectCount > 1 ? 'multi-project development' : 'focused single-project work'}, with ${dominantType} being the primary activity type. This suggests ${dominantType === 'features' ? 'active feature development' : dominantType === 'fixes' ? 'bug resolution and maintenance' : dominantType === 'improvements' ? 'code quality and optimization work' : 'general development activity'}.`,
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
    
    const projects = [...new Set(commits.map(c => c.repo.split('/')[1]))];
    
    // Find the earliest commit date
    const commitDates = commits.map(c => new Date(c.date)).filter(d => !isNaN(d.getTime()));
    const firstCommitDate = commitDates.length > 0 ? new Date(Math.min(...commitDates)) : new Date();
    
    const entry = {
      parent: { database_id: wanderlogDatabaseId },
      properties: {
        "Title": {
          title: [{ type: "text", text: { content: summary.title } }]
        },
        "Created": {
          date: { start: new Date().toISOString() }
        },
        "First Commit Date": {
          date: { start: firstCommitDate.toISOString() }
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
async function processDailyCommits(specificDate = null) {
  validateEnvironment();
  initializeClients();
  
  try {
    console.log('🌅 Starting daily commit processing...');
    
    // Get commits from specified date or previous day
    const allCommits = specificDate ? 
      await getCommitsForDate(specificDate) : 
      await getPreviousDayCommits();
    
    if (allCommits.length === 0) {
      console.log('📭 No commits found, skipping Wanderlog entry');
      return { created: false };
    }
    
    // Filter significant commits
    const significantCommits = filterSignificantCommits(allCommits);
    console.log(`📊 Filtered to ${significantCommits.length} significant commits (from ${allCommits.length} total)`);
    
    if (significantCommits.length === 0) {
      console.log('📭 No significant commits found, skipping Wanderlog entry');
      return { created: false };
    }
    
    // Generate summary
    const summary = await generateCommitSummary(significantCommits);
    
    // Create Notion entry
    await createWanderlogEntry(summary, significantCommits);
    
    console.log('✅ Daily commit processing completed successfully');
    return { created: true, title: summary.title };
  } catch (error) {
    console.error('❌ Error in daily commit processing:', error);
    throw error;
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
  getCommitsForDate,
  filterSignificantCommits,
  generateCommitSummary,
  createWanderlogEntry
};
