#!/usr/bin/env node

require('dotenv').config();
const { Octokit } = require('@octokit/rest');
const { addPrdStoryEntry, getPrdStoryEntry, updatePrdStoryEntry } = require('./notion');

// Validate required environment variables
if (!process.env.GITHUB_TOKEN) {
  console.error('❌ GITHUB_TOKEN environment variable not set');
  process.exit(1);
}

if (!process.env.GITHUB_OWNER) {
  console.error('❌ GITHUB_OWNER environment variable not set');
  process.exit(1);
}

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const owner = process.env.GITHUB_OWNER;

// Common PRD file patterns to monitor
const PRD_FILE_PATTERNS = [
  'PRD.md',
  'prd.md',
  'README.md',
  'REQUIREMENTS.md',
  'requirements.md',
  'FEATURES.md',
  'features.md',
  'STORIES.md',
  'stories.md',
  'ROADMAP.md',
  'roadmap.md'
];

// Story extraction patterns (same as standardization script)
const STORY_PATTERNS = [
  /^#{1,3}\s*\[?([^\]]+)\]?\s*[-–—]\s*([^\n]+)$/gm,
  /^[-*]\s*\[?([^\]]+)\]?\s*[-–—]\s*([^\n]+)$/gm,
  /^\d+\.\s*\[?([^\]]+)\]?\s*[-–—]\s*([^\n]+)$/gm,
  /^([A-Za-z]+):\s*([^\n]+)$/gm,
  /^([^-]+)\s*[-–—]\s*([A-Za-z]+)$/gm
];

// Priority and story point indicators
const PRIORITY_INDICATORS = {
  'high': 5, 'critical': 5, 'urgent': 5,
  'medium': 3, 'normal': 3,
  'low': 1, 'nice-to-have': 1, 'future': 1
};

const STORY_POINT_INDICATORS = {
  'tiny': '1', 'small': '2', 'medium': '3',
  'large': '5', 'xlarge': '8', 'xxlarge': '13', 'epic': '21'
};

// Cache for tracking file changes
const fileCache = new Map();
const storyCache = new Map();

class PrdFileWatcher {
  constructor() {
    this.isRunning = false;
    this.watchInterval = 5 * 60 * 1000; // Check every 5 minutes
    this.lastCheck = new Date();
  }

  async start() {
    if (this.isRunning) {
      console.log('⚠️ File watcher is already running');
      return;
    }

    console.log('🚀 Starting PRD file watcher...');
    this.isRunning = true;

    // Initial scan
    await this.scanAllRepositories();

    // Start periodic scanning
    this.startPeriodicScan();
  }

  stop() {
    console.log('🛑 Stopping PRD file watcher...');
    this.isRunning = false;
  }

  async startPeriodicScan() {
    while (this.isRunning) {
      try {
        await new Promise(resolve => setTimeout(resolve, this.watchInterval));
        
        if (this.isRunning) {
          console.log(`\n⏰ Periodic scan at ${new Date().toISOString()}`);
          await this.scanAllRepositories();
        }
      } catch (error) {
        console.error('❌ Error in periodic scan:', error.message);
      }
    }
  }

  async scanAllRepositories() {
    try {
      console.log('🔍 Scanning all repositories for PRD file changes...');
      
      const repos = await this.getAllRepositories();
      let totalChanges = 0;

      for (const repo of repos) {
        const changes = await this.scanRepository(repo.name);
        totalChanges += changes;
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      console.log(`✅ Scan complete. Total changes detected: ${totalChanges}`);
      this.lastCheck = new Date();
      
    } catch (error) {
      console.error('❌ Error scanning repositories:', error.message);
    }
  }

  async getAllRepositories() {
    try {
      const repos = [];
      let page = 1;
      let hasMore = true;
      
      while (hasMore) {
        const response = await octokit.repos.listForUser({
          username: owner,
          page,
          per_page: 100,
          sort: 'updated'
        });
        
        if (response.data.length === 0) {
          hasMore = false;
        } else {
          repos.push(...response.data);
          page++;
        }
        
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      return repos;
    } catch (error) {
      console.error('❌ Error fetching repositories:', error.message);
      return [];
    }
  }

  async scanRepository(repoName) {
    try {
      console.log(`🔍 Scanning repository: ${repoName}`);
      
      const currentFiles = await this.findPrdFiles(repoName);
      const cacheKey = `repo:${repoName}`;
      const cachedFiles = fileCache.get(cacheKey) || [];
      
      let changes = 0;
      
      // Check for new or modified files
      for (const file of currentFiles) {
        const fileKey = `${file.path}:${file.sha}`;
        const cachedFile = cachedFiles.find(f => f.path === file.path);
        
        if (!cachedFile || cachedFile.sha !== file.sha) {
          console.log(`📝 File changed: ${file.path}`);
          await this.processFileChange(repoName, file);
          changes++;
        }
      }
      
      // Update cache
      fileCache.set(cacheKey, currentFiles);
      
      if (changes > 0) {
        console.log(`✅ Repository ${repoName}: ${changes} changes detected`);
      }
      
      return changes;
      
    } catch (error) {
      console.error(`❌ Error scanning repository ${repoName}:`, error.message);
      return 0;
    }
  }

  async findPrdFiles(repoName) {
    try {
      const prdFiles = [];
      
      for (const pattern of PRD_FILE_PATTERNS) {
        try {
          const response = await octokit.search.code({
            q: `repo:${owner}/${repoName} filename:${pattern}`,
            per_page: 10
          });
          
          if (response.data.items.length > 0) {
            prdFiles.push(...response.data.items.map(item => ({
              name: item.name,
              path: item.path,
              sha: item.sha,
              url: item.html_url
            })));
          }
        } catch (error) {
          console.warn(`⚠️ Error searching for ${pattern} in ${repoName}:`, error.message);
        }
        
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      return prdFiles;
    } catch (error) {
      console.error(`❌ Error finding PRD files in ${repoName}:`, error.message);
      return [];
    }
  }

  async processFileChange(repoName, file) {
    try {
      console.log(`📄 Processing file change: ${file.path}`);
      
      const content = await this.getFileContent(repoName, file.path, file.sha);
      if (!content) {
        return;
      }
      
      const currentStories = this.extractStoriesFromContent(content, repoName);
      const cacheKey = `stories:${repoName}:${file.path}`;
      const cachedStories = storyCache.get(cacheKey) || [];
      
      // Compare current stories with cached stories
      const changes = this.detectStoryChanges(cachedStories, currentStories, repoName);
      
      if (changes.length > 0) {
        console.log(`📝 Detected ${changes.length} story changes in ${file.path}`);
        await this.processStoryChanges(changes);
      }
      
      // Update story cache
      storyCache.set(cacheKey, currentStories);
      
    } catch (error) {
      console.error(`❌ Error processing file change for ${file.path}:`, error.message);
    }
  }

  async getFileContent(repoName, filePath, sha) {
    try {
      const response = await octokit.git.getBlob({
        owner,
        repo: repoName,
        file_sha: sha
      });
      
      if (response.data.encoding === 'base64') {
        return Buffer.from(response.data.content, 'base64').toString('utf-8');
      }
      
      return response.data.content;
    } catch (error) {
      console.error(`❌ Error getting file content for ${filePath}:`, error.message);
      return null;
    }
  }

  extractStoriesFromContent(content, repoName) {
    const stories = [];
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (!line || line.startsWith('<!--') || line.startsWith('//')) {
        continue;
      }
      
      for (const pattern of STORY_PATTERNS) {
        const match = line.match(pattern);
        if (match) {
          const status = match[1]?.toLowerCase();
          const title = match[2] || match[1];
          
          if (title && title.length > 3) {
            let priority = 3;
            let storyPoints = null;
            
            // Determine priority and story points (same logic as standardization script)
            const lowerLine = line.toLowerCase();
            for (const [indicator, value] of Object.entries(PRIORITY_INDICATORS)) {
              if (lowerLine.includes(indicator)) {
                priority = value;
                break;
              }
            }
            
            for (const [indicator, value] of Object.entries(STORY_POINT_INDICATORS)) {
              if (lowerLine.includes(indicator)) {
                storyPoints = value;
                break;
              }
            }
            
            if (!storyPoints) {
              for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
                const contextLine = lines[j].toLowerCase();
                for (const [indicator, value] of Object.entries(STORY_POINT_INDICATORS)) {
                  if (contextLine.includes(indicator)) {
                    storyPoints = value;
                    break;
                  }
                }
                if (storyPoints) break;
              }
            }
            
            let standardStatus = 'Idea';
            if (status) {
              if (status.includes('done') || status.includes('complete')) {
                standardStatus = 'Done';
              } else if (status.includes('active') || status.includes('in-progress')) {
                standardStatus = 'Active';
              } else if (status.includes('plan') || status.includes('design')) {
                standardStatus = 'Planning';
              } else if (status.includes('review') || status.includes('testing')) {
                standardStatus = 'Review';
              }
            }
            
            stories.push({
              title: title.trim(),
              status: standardStatus,
              priority,
              storyPoints,
              repository: repoName,
              source: line
            });
            
            break;
          }
        }
      }
    }
    
    return stories;
  }

  detectStoryChanges(oldStories, newStories, repoName) {
    const changes = [];
    
    // Check for new stories
    for (const newStory of newStories) {
      const existingStory = oldStories.find(s => 
        s.title.toLowerCase() === newStory.title.toLowerCase()
      );
      
      if (!existingStory) {
        changes.push({
          type: 'new',
          story: newStory
        });
      } else if (existingStory.status !== newStory.status) {
        changes.push({
          type: 'status_change',
          oldStory: existingStory,
          newStory: newStory
        });
      }
    }
    
    // Check for removed stories
    for (const oldStory of oldStories) {
      const stillExists = newStories.find(s => 
        s.title.toLowerCase() === oldStory.title.toLowerCase()
      );
      
      if (!stillExists) {
        changes.push({
          type: 'removed',
          story: oldStory
        });
      }
    }
    
    return changes;
  }

  async processStoryChanges(changes) {
    try {
      console.log(`🔄 Processing ${changes.length} story changes...`);
      
      for (const change of changes) {
        try {
          switch (change.type) {
            case 'new':
              await this.addNewStory(change.story);
              break;
            case 'status_change':
              await this.updateStoryStatus(change.oldStory, change.newStory);
              break;
            case 'removed':
              await this.handleRemovedStory(change.story);
              break;
          }
          
          await new Promise(resolve => setTimeout(resolve, 200));
          
        } catch (error) {
          console.error(`❌ Error processing change:`, error.message);
        }
      }
      
    } catch (error) {
      console.error('❌ Error processing story changes:', error.message);
    }
  }

  async addNewStory(story) {
    try {
      console.log(`➕ Adding new story: ${story.title}`);
      
      await addPrdStoryEntry({
        projectName: story.repository,
        storyTitle: story.title,
        status: story.status,
        priority: story.priority,
        storyPoints: story.storyPoints,
        repository: story.repository,
        notes: `Auto-detected from PRD file: ${story.source}`
      });
      
      console.log(`✅ Added new story: ${story.title}`);
      
    } catch (error) {
      console.error(`❌ Error adding new story ${story.title}:`, error.message);
    }
  }

  async updateStoryStatus(oldStory, newStory) {
    try {
      console.log(`🔄 Updating story status: ${newStory.title} (${oldStory.status} → ${newStory.status})`);
      
      // Find existing story in Notion
      const existingStories = await getPrdStoryEntry(newStory.repository);
      const existingStory = existingStories.find(s => 
        s.storyTitle.toLowerCase() === newStory.title.toLowerCase() &&
        s.repository === newStory.repository
      );
      
      if (existingStory) {
        await updatePrdStoryEntry(existingStory.id, {
          status: newStory.status,
          priority: newStory.priority,
          storyPoints: newStory.storyPoints
        });
        
        console.log(`✅ Updated story status: ${newStory.title}`);
      } else {
        // Story doesn't exist in Notion, add it
        await this.addNewStory(newStory);
      }
      
    } catch (error) {
      console.error(`❌ Error updating story status for ${newStory.title}:`, error.message);
    }
  }

  async handleRemovedStory(story) {
    try {
      console.log(`🗑️ Story removed from PRD: ${story.title}`);
      
      // For now, we'll just log this. In the future, you might want to:
      // - Mark it as "Removed" in Notion
      // - Archive it
      // - Send a notification
      
      console.log(`ℹ️ Story "${story.title}" was removed from ${story.repository} PRD`);
      
    } catch (error) {
      console.error(`❌ Error handling removed story ${story.title}:`, error.message);
    }
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      lastCheck: this.lastCheck,
      watchInterval: this.watchInterval,
      cachedRepos: fileCache.size,
      cachedStories: storyCache.size
    };
  }
}

// CLI interface
async function main() {
  const watcher = new PrdFileWatcher();
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Received SIGINT, shutting down gracefully...');
    watcher.stop();
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
    watcher.stop();
    process.exit(0);
  });
  
  try {
    await watcher.start();
  } catch (error) {
    console.error('❌ Error starting file watcher:', error.message);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = PrdFileWatcher;
