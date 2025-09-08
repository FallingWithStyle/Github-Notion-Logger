#!/usr/bin/env node

require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const { Octokit } = require('@octokit/rest');

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

// File patterns to look for
const PRD_FILE_PATTERNS = [
  'PRD.md',
  'prd.md',
  '*-prd.md',
  'prd-*.md',
  'README.md' // Often contains PRD content
];

const TASK_LIST_FILE_PATTERNS = [
  'task-list.md',
  'tasks.md',
  'TASKS.md',
  'TODO.md',
  'todo.md'
];

class PrdTaskProcessor {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  async getAllRepositories() {
    try {
      console.log('🔍 Fetching all repositories (including private)...');
      
      const repos = [];
      let page = 1;
      let hasMore = true;
      
      while (hasMore) {
        const response = await octokit.repos.listForAuthenticatedUser({
          page,
          per_page: 100,
          sort: 'updated',
          visibility: 'all' // This includes both public and private repos
        });
        
        if (response.data.length === 0) {
          hasMore = false;
        } else {
          repos.push(...response.data);
          page++;
        }
        
        // Rate limiting - increased delay to avoid API limits
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      console.log(`✅ Found ${repos.length} repositories (${repos.filter(r => r.private).length} private, ${repos.filter(r => !r.private).length} public)`);
      return repos;
    } catch (error) {
      console.error('❌ Error fetching repositories:', error.message);
      return [];
    }
  }

  async findProjectFiles(repoName) {
    try {
      const files = {
        prd: null,
        taskList: null
      };

      // Search for PRD files with specific patterns
      try {
        const prdQueries = [
          `repo:${owner}/${repoName} filename:PRD.md`,
          `repo:${owner}/${repoName} filename:prd.md`,
          `repo:${owner}/${repoName} filename:README.md`,
          `repo:${owner}/${repoName} filename:REQUIREMENTS.md`,
          `repo:${owner}/${repoName} filename:requirements.md`
        ];

        for (const query of prdQueries) {
          try {
            const response = await octokit.search.code({
              q: query,
              per_page: 10,
              visibility: 'all'
            });

            if (response.data.items.length > 0) {
              const prdFile = response.data.items[0]; // Take the first match
              files.prd = {
                name: prdFile.name,
                path: prdFile.path,
                sha: prdFile.sha,
                url: prdFile.html_url
              };
              break; // Found a PRD file, stop searching
            }
          } catch (error) {
            if (error.status !== 422) { // 422 is "validation failed" for empty results
              console.warn(`⚠️ Error searching for PRD with query "${query}":`, error.message);
            }
          }
          
          // Small delay between queries
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.warn(`⚠️ Error searching for PRD files in ${repoName}:`, error.message);
      }

      // Search for task-list files with specific patterns
      try {
        const taskQueries = [
          `repo:${owner}/${repoName} filename:task-list.md`,
          `repo:${owner}/${repoName} filename:tasks.md`,
          `repo:${owner}/${repoName} filename:TODO.md`,
          `repo:${owner}/${repoName} filename:todo.md`
        ];

        for (const query of taskQueries) {
          try {
            const response = await octokit.search.code({
              q: query,
              per_page: 10,
              visibility: 'all'
            });

            if (response.data.items.length > 0) {
              const taskFile = response.data.items[0]; // Take the first match
              files.taskList = {
                name: taskFile.name,
                path: taskFile.path,
                sha: taskFile.sha,
                url: taskFile.html_url
              };
              break; // Found a task-list file, stop searching
            }
          } catch (error) {
            if (error.status !== 422) { // 422 is "validation failed" for empty results
              console.warn(`⚠️ Error searching for task-list with query "${query}":`, error.message);
            }
          }
          
          // Small delay between queries
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.warn(`⚠️ Error searching for task-list files in ${repoName}:`, error.message);
      }

      return files;
    } catch (error) {
      console.error(`❌ Error finding project files in ${repoName}:`, error.message);
      return { prd: null, taskList: null };
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

  parsePrdContent(content, repoName) {
    const stories = [];
    const lines = content.split('\n');
    
    // Patterns for extracting stories from PRD
    const storyPatterns = [
      // Epic headers: ## Epic 1: [Story Title]
      /^#{1,3}\s+Epic\s+\d+:\s*(.+)$/gm,
      // Story headers: #### Story 1.1: [Story Title]
      /^#{1,6}\s+Story\s+\d+\.\d+:\s*(.+)$/gm,
      // Feature headers: ### [Feature Name]
      /^#{1,3}\s+([^#\n]+?)(?:\s*[-–—]\s*([^\n]+))?$/gm,
      // Bullet points with meaningful content
      /^[-*]\s+([A-Z][^-\n]+?)(?:\s*[-–—]\s*([^\n]+))?$/gm,
      // Numbered lists with meaningful content
      /^\d+\.\s+([A-Z][^-\n]+?)(?:\s*[-–—]\s*([^\n]+))?$/gm
    ];

    const statusOnlyWords = ['IMPLEMENTED', 'DESIGNED', 'PLANNED', 'REVIEW', 'ACTIVE', 'DONE', 'TODO', 'IN PROGRESS'];
    const seenTitles = new Set();

    for (const pattern of storyPatterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        let title = match[1]?.trim();
        let description = match[2]?.trim() || '';

        // Skip if title is just a status word or too short
        if (!title || statusOnlyWords.includes(title.toUpperCase()) || title.length < 5) {
          continue;
        }

        // Skip if title is generic
        if (title.toLowerCase().includes('status') || title.toLowerCase().includes('progress')) {
          continue;
        }

        // Deduplicate
        const normalizedTitle = title.toLowerCase().replace(/[^\w\s]/g, '').trim();
        if (seenTitles.has(normalizedTitle)) {
          continue;
        }
        seenTitles.add(normalizedTitle);

        // Determine priority and status
        let priority = 3; // Default medium
        const titleLower = title.toLowerCase();
        
        if (titleLower.includes('high') || titleLower.includes('critical') || titleLower.includes('urgent')) {
          priority = 5;
        } else if (titleLower.includes('low') || titleLower.includes('nice-to-have') || titleLower.includes('future')) {
          priority = 1;
        }

        let status = 'Idea'; // Default
        const fullText = (title + ' ' + description).toLowerCase();
        for (const standardStatus of ['Active', 'Planning', 'Review', 'Idea', 'Done']) {
          if (fullText.includes(standardStatus.toLowerCase())) {
            status = standardStatus;
            break;
          }
        }

        stories.push({
          title: title,
          status: status,
          priority: priority,
          repository: repoName,
          source: 'PRD',
          description: description
        });
      }
    }

    return stories;
  }

  parseTaskListContent(content, repoName) {
    const tasks = [];
    const lines = content.split('\n');
    
    // Patterns for extracting tasks from task-list.md
    const taskPatterns = [
      // Checkbox format: - [x] Task description
      /^[-*]\s+\[([ x])\]\s+(.+)$/gm,
      // Numbered checkbox: 1. [x] Task description
      /^\d+\.\s+\[([ x])\]\s+(.+)$/gm
    ];

    const seenTasks = new Set();

    for (const pattern of taskPatterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        const isCompleted = match[1] === 'x';
        const description = match[2]?.trim();

        if (!description || description.length < 3) {
          continue;
        }

        // Deduplicate
        const normalizedDesc = description.toLowerCase().replace(/[^\w\s]/g, '').trim();
        if (seenTasks.has(normalizedDesc)) {
          continue;
        }
        seenTasks.add(normalizedDesc);

        // Extract story/epic context if available
        let storyContext = '';
        const linesBefore = lines.slice(0, lines.indexOf(match[0]));
        for (let i = linesBefore.length - 1; i >= 0; i--) {
          const line = linesBefore[i];
          if (line.match(/^#{1,6}\s+/) && (line.includes('Story') || line.includes('Epic') || line.includes('Task'))) {
            storyContext = line.replace(/^#{1,6}\s+/, '').trim();
            break;
          }
        }

        tasks.push({
          description: description,
          completed: isCompleted,
          storyContext: storyContext,
          repository: repoName,
          source: 'task-list'
        });
      }
    }

    return tasks;
  }

  calculateProgress(stories, tasks) {
    const progress = {
      totalStories: stories.length,
      completedStories: 0,
      totalTasks: tasks.length,
      completedTasks: 0,
      progressPercentage: 0,
      storyProgress: {},
      taskProgress: {}
    };

    // Calculate story progress
    stories.forEach(story => {
      if (story.status === 'Done') {
        progress.completedStories++;
      }
      
      if (!progress.storyProgress[story.status]) {
        progress.storyProgress[story.status] = 0;
      }
      progress.storyProgress[story.status]++;
    });

    // Calculate task progress
    tasks.forEach(task => {
      if (task.completed) {
        progress.completedTasks++;
      }
    });

    // Calculate overall progress percentage
    if (progress.totalStories > 0 && progress.totalTasks > 0) {
      const storyProgress = progress.completedStories / progress.totalStories;
      const taskProgress = progress.completedTasks / progress.totalTasks;
      progress.progressPercentage = Math.round(((storyProgress + taskProgress) / 2) * 100);
    } else if (progress.totalStories > 0) {
      progress.progressPercentage = Math.round((progress.completedStories / progress.totalStories) * 100);
    } else if (progress.totalTasks > 0) {
      progress.progressPercentage = Math.round((progress.completedTasks / progress.totalTasks) * 100);
    }

    return progress;
  }

  async processRepository(repoName) {
    try {
      console.log(`🔄 Scanning repository: ${repoName}`);
      
      const files = await this.findProjectFiles(repoName);
      const result = {
        repository: repoName,
        hasPrd: !!files.prd,
        hasTaskList: !!files.taskList,
        stories: [],
        tasks: [],
        progress: null,
        lastUpdated: new Date()
      };

      // Process PRD file
      if (files.prd) {
        const prdContent = await this.getFileContent(repoName, files.prd.path, files.prd.sha);
        if (prdContent) {
          result.stories = this.parsePrdContent(prdContent, repoName);
          console.log(`📝 Found ${result.stories.length} stories in PRD`);
        }
      }

      // Process task-list file
      if (files.taskList) {
        const taskContent = await this.getFileContent(repoName, files.taskList.path, files.taskList.sha);
        if (taskContent) {
          result.tasks = this.parseTaskListContent(taskContent, repoName);
          console.log(`✅ Found ${result.tasks.length} tasks in task-list`);
        }
      }

      // Calculate progress
      if (result.stories.length > 0 || result.tasks.length > 0) {
        result.progress = this.calculateProgress(result.stories, result.tasks);
        console.log(`📊 Progress: ${result.progress.progressPercentage}% (${result.progress.completedStories}/${result.progress.totalStories} stories, ${result.progress.completedTasks}/${result.progress.totalTasks} tasks)`);
      }

      return result;
    } catch (error) {
      console.error(`❌ Error processing repository ${repoName}:`, error.message);
      return {
        repository: repoName,
        hasPrd: false,
        hasTaskList: false,
        stories: [],
        tasks: [],
        progress: null,
        error: error.message,
        lastUpdated: new Date()
      };
    }
  }

  async processAllRepositories() {
    try {
      console.log('🚀 Starting PRD and task-list processing...');
      
      const repos = await this.getAllRepositories();
      if (repos.length === 0) {
        console.log('❌ No repositories found');
        return [];
      }

      const results = [];
      const batchSize = 3; // Process 3 repositories at a time
      
      for (let i = 0; i < repos.length; i += batchSize) {
        const batch = repos.slice(i, i + batchSize);
        console.log(`\n📦 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(repos.length/batchSize)} (${batch.length} repos)`);
        
        // Process batch in parallel
        const batchPromises = batch.map(repo => this.processRepository(repo.name));
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
        
        // Delay between batches to avoid rate limits
        if (i + batchSize < repos.length) {
          console.log('⏳ Waiting 5 seconds before next batch...');
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }

      console.log(`\n📊 Processing complete! Processed ${results.length} repositories`);
      
      // Summary
      const withPrd = results.filter(r => r.hasPrd).length;
      const withTaskList = results.filter(r => r.hasTaskList).length;
      const withBoth = results.filter(r => r.hasPrd && r.hasTaskList).length;
      const totalStories = results.reduce((sum, r) => sum + r.stories.length, 0);
      const totalTasks = results.reduce((sum, r) => sum + r.tasks.length, 0);

      console.log(`📈 Summary:`);
      console.log(`   Repositories with PRD: ${withPrd}`);
      console.log(`   Repositories with task-list: ${withTaskList}`);
      console.log(`   Repositories with both: ${withBoth}`);
      console.log(`   Total stories: ${totalStories}`);
      console.log(`   Total tasks: ${totalTasks}`);

      return results;
    } catch (error) {
      console.error('❌ Error processing repositories:', error.message);
      return [];
    }
  }

  // Cache management
  getCachedData(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    return null;
  }

  setCachedData(key, data) {
    this.cache.set(key, {
      data: data,
      timestamp: Date.now()
    });
  }

  clearCache() {
    this.cache.clear();
  }
}

// Run the script
if (require.main === module) {
  const processor = new PrdTaskProcessor();
  processor.processAllRepositories()
    .then(results => {
      console.log('\n🎉 Processing complete!');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Error:', error.message);
      process.exit(1);
    });
}

module.exports = PrdTaskProcessor;
