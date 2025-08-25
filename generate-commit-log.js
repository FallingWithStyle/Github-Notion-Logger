const fs = require('fs');
const path = require('path');
const timezoneConfig = require('./timezone-config');

// Available colors for projects (matching the frontend)
const availableColors = ['🟩', '🟥', '🟪', '🟦', '🟨', '🟧', '🟫', '⬛', '⬜', '🟣', '🟢', '🔴', '🔵', '🟡', '🟠'];

// Example function to generate commit log data
// You can modify this to fetch real data from Notion API or manually enter your data
function generateCommitLog() {
    // This is sample data - replace with your actual commit data
    const commitLog = [
        {
            "date": "2025-01-01",
            "projects": {
                "glyph": 3,
                "friend-party": 2,
                "audventr": 3
            }
        },
        {
            "date": "2025-01-02",
            "projects": {
                "glyph": 2,
                "friend-party": 4,
                "audventr": 2
            }
        },
        {
            "date": "2025-01-03",
            "projects": {
                "glyph": 1,
                "friend-party": 3,
                "audventr": 1,
                "github-notion-logger": 2
            }
        },
        {
            "date": "2025-01-04",
            "projects": {
                "glyph": 5,
                "friend-party": 1,
                "audventr": 4
            }
        },
        {
            "date": "2025-01-05",
            "projects": {
                "glyph": 2,
                "friend-party": 3,
                "audventr": 2,
                "github-notion-logger": 1
            }
        },
        {
            "date": "2025-01-06",
            "projects": {
                "glyph": 0,
                "friend-party": 2,
                "audventr": 1
            }
        },
        {
            "date": "2025-01-07",
            "projects": {
                "glyph": 4,
                "friend-party": 1,
                "audventr": 3,
                "github-notion-logger": 2,
                "new-project-a": 1,
                "new-project-b": 2
            }
        },
        {
            "date": "2025-01-08",
            "projects": {
                "glyph": 1,
                "friend-party": 2,
                "new-project-c": 3,
                "new-project-d": 1
            }
        },
        {
            "date": "2025-01-09",
            "projects": {
                "glyph": 2,
                "friend-party": 1,
                "new-project-e": 4,
                "new-project-f": 2
            }
        },
        {
            "date": "2025-01-10",
            "projects": {
                "glyph": 3,
                "friend-party": 2,
                "new-project-g": 1,
                "new-project-h": 3
            }
        }
    ];

    return commitLog;
}

// Function to save commit log to file
function saveCommitLog(commitLog, outputPath) {
    // Prefer persisted data dir if available
    const DATA_DIR = process.env.DATA_DIR || (fs.existsSync('/data') ? '/data' : path.join(__dirname, 'data'));
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const resolvedPath = outputPath || path.join(DATA_DIR, 'commit-log.json');
    try {
        fs.writeFileSync(resolvedPath, JSON.stringify(commitLog, null, 2));
        console.log(`✅ Commit log saved to ${resolvedPath}`);
        
        // Show color assignment info
        console.log('\n🎨 Color Assignment Info:');
        const projectColors = {};
        const colorUsage = {};
        
        // Initialize color usage
        availableColors.forEach(color => {
            colorUsage[color] = 0;
        });
        
        // Simulate the same color assignment logic as the frontend
        commitLog.forEach(day => {
            Object.keys(day.projects).forEach(project => {
                if (!projectColors[project]) {
                    // Find least used color
                    let minUsage = Infinity;
                    let leastUsedColor = availableColors[0];
                    
                    availableColors.forEach(color => {
                        if (colorUsage[color] < minUsage) {
                            minUsage = colorUsage[color];
                            leastUsedColor = color;
                        }
                    });
                    
                    projectColors[project] = leastUsedColor;
                    colorUsage[leastUsedColor]++;
                }
            });
        });
        
        // Display project color assignments
        Object.entries(projectColors).forEach(([project, color]) => {
            console.log(`  ${color} ${project}`);
        });
        
    } catch (error) {
        console.error('❌ Error saving commit log:', error);
    }
}

// Function to fetch data from Notion database
async function fetchFromNotion(since = '2025-01-01') {
    const { Client } = require('@notionhq/client');
    
    // Check if required environment variables are set
    if (!process.env.NOTION_API_KEY) {
        console.error('❌ NOTION_API_KEY environment variable not set');
        return null;
    }
    
    if (!process.env.NOTION_COMMIT_FROM_GITHUB_LOG_ID) {
        console.error('❌ NOTION_COMMIT_FROM_GITHUB_LOG_ID environment variable not set');
        return null;
    }
    
    const notion = new Client({ auth: process.env.NOTION_API_KEY });
    const databaseId = process.env.NOTION_COMMIT_FROM_GITHUB_LOG_ID;
    
    try {
        console.log(`🔄 Fetching commits from Notion database since ${since}...`);
        
        const commitData = {};
        let hasMore = true;
        let startCursor = undefined;
        
        // Fetch all pages from the database
        while (hasMore) {
            const response = await notion.databases.query({
                database_id: databaseId,
                filter: {
                    property: "Date",
                    date: {
                        on_or_after: since
                    }
                },
                page_size: 100,
                start_cursor: startCursor
            });
            
            // Process each page
            response.results.forEach(page => {
                const projectName = page.properties["Project Name"]?.title?.[0]?.text?.content;
                const date = page.properties["Date"]?.date?.start;
                
                if (projectName && date) {
                    // The date from Notion is already processed with timezone logic
                    // Just extract the date portion (YYYY-MM-DD) for grouping
                    const dateObj = new Date(date);
                    const dateKey = dateObj.toISOString().split('T')[0];
                    
                    if (!commitData[dateKey]) {
                        commitData[dateKey] = {};
                    }
                    
                    if (!commitData[dateKey][projectName]) {
                        commitData[dateKey][projectName] = 0;
                    }
                    
                    commitData[dateKey][projectName]++;
                }
            });
            
            hasMore = response.has_more;
            startCursor = response.next_cursor;
            
            // Add a small delay to avoid rate limiting
            if (hasMore) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
        
        // Convert to the expected format
        const commitLog = Object.entries(commitData).map(([date, projects]) => ({
            date,
            projects
        }));
        
        // Sort by date
        commitLog.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        return commitLog;
        
    } catch (error) {
        console.error('❌ Error fetching Notion data:', error);
        return null;
    }
}

// Main execution
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.includes('--notion')) {
        const since = args.find(arg => arg.startsWith('--since='))?.split('=')[1] || '2025-01-01';
        
        console.log('🔄 Fetching data from Notion...');
        fetchFromNotion(since).then(commitLog => {
            if (commitLog) {
                saveCommitLog(commitLog);
                console.log(`✅ Fetched ${commitLog.length} days of commit data from Notion`);
            } else {
                console.log('❌ Failed to fetch data from Notion');
            }
        });
    } else {
        console.log('📝 Generating sample commit log...');
        const commitLog = generateCommitLog();
        saveCommitLog(commitLog);
        console.log('\n💡 To fetch real data from Notion, run:');
        console.log('   node generate-commit-log.js --notion');
        console.log('   node generate-commit-log.js --notion --since=2025-01-01');
    }
}

module.exports = { generateCommitLog, saveCommitLog, fetchFromNotion }; 