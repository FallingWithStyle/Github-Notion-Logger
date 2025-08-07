const fs = require('fs');
const path = require('path');

// Available colors for projects (matching the frontend)
const availableColors = ['🟩', '🟥', '🟪', '🟦', '🟨', '🟧', '🟫', '⬛', '⬜', '🟣', '🟢', '🔴', '🔵', '🟡', '🟠'];

// Example function to generate commit log data
// You can modify this to fetch real data from GitHub API or manually enter your data
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
function saveCommitLog(commitLog, outputPath = 'public/commit-log.json') {
    try {
        fs.writeFileSync(outputPath, JSON.stringify(commitLog, null, 2));
        console.log(`✅ Commit log saved to ${outputPath}`);
        
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

// Function to fetch real GitHub data (requires GitHub API token)
async function fetchGitHubCommits(username, token, since = '2025-01-01') {
    const { Octokit } = require('@octokit/rest');
    const octokit = new Octokit({ auth: token });
    
    try {
        // Get user's repositories
        const { data: repos } = await octokit.repos.listForUser({
            username,
            per_page: 100
        });
        
        const commitData = {};
        
        // Fetch commits for each repository
        for (const repo of repos) {
            try {
                const { data: commits } = await octokit.repos.listCommits({
                    owner: username,
                    repo: repo.name,
                    since,
                    per_page: 100
                });
                
                // Group commits by date
                commits.forEach(commit => {
                    const date = commit.commit.author.date.split('T')[0];
                    if (!commitData[date]) {
                        commitData[date] = {};
                    }
                    if (!commitData[date][repo.name]) {
                        commitData[date][repo.name] = 0;
                    }
                    commitData[date][repo.name]++;
                });
                
            } catch (error) {
                console.warn(`⚠️  Could not fetch commits for ${repo.name}:`, error.message);
            }
        }
        
        // Convert to the expected format
        const commitLog = Object.entries(commitData).map(([date, projects]) => ({
            date,
            projects
        }));
        
        return commitLog;
        
    } catch (error) {
        console.error('❌ Error fetching GitHub data:', error);
        return null;
    }
}

// Main execution
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.includes('--github') && args.includes('--username') && args.includes('--token')) {
        const usernameIndex = args.indexOf('--username') + 1;
        const tokenIndex = args.indexOf('--token') + 1;
        const username = args[usernameIndex];
        const token = args[tokenIndex];
        
        console.log(`🔄 Fetching GitHub commits for ${username}...`);
        fetchGitHubCommits(username, token).then(commitLog => {
            if (commitLog) {
                saveCommitLog(commitLog);
            }
        });
    } else {
        console.log('📝 Generating sample commit log...');
        const commitLog = generateCommitLog();
        saveCommitLog(commitLog);
        console.log('\n💡 To fetch real GitHub data, run:');
        console.log('   node generate-commit-log.js --github --username YOUR_USERNAME --token YOUR_TOKEN');
    }
}

module.exports = { generateCommitLog, saveCommitLog, fetchGitHubCommits }; 