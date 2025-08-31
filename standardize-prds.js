#!/usr/bin/env node

require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const { Octokit } = require('@octokit/rest');
const { addPrdStoryEntry, getPrdStoryEntry } = require('./notion');

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

// Common PRD file patterns to look for
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
  'roadmap.md',
  // Flexible naming patterns
  /^PRD.*\.md$/i,           // PRDv2.md, PRD-2025.md, PRD_Final.md
  /^.*PRD.*\.md$/i,         // Project-PRD.md, My-PRD.md
  /^.*requirements.*\.md$/i, // project-requirements.md, requirements-v2.md
  /^.*features.*\.md$/i,    // project-features.md, features-2025.md
  /^.*stories.*\.md$/i,     // project-stories.md, user-stories.md
  /^.*roadmap.*\.md$/i      // project-roadmap.md, roadmap-2025.md
];

// Schema validation patterns
const SCHEMA_VALIDATION_PATTERNS = {
  // Check if file has clear story structure
  hasStoryStructure: [
    /^#{1,3}\s+[^#\n]+$/gm,           // Headers
    /^[-*]\s+\[?[^\]]*\]?\s*[-–—]\s+/gm,  // Bullet points with status
    /^\d+\.\s+\[?[^\]]*\]?\s*[-–—]\s+/gm, // Numbered lists with status
    /^[A-Za-z]+:\s+[^\n]+$/gm,        // Status: Title format
    /^[^-]+[-–—]\s+[A-Za-z]+$/gm      // Title - Status format
  ],
  
  // Check if file has clear project context
  hasProjectContext: [
    /project|feature|story|requirement|roadmap/i,
    /user\s+story|user\s+requirement/i,
    /epic|sprint|milestone/i
  ]
};

// Minimum required content length for a valid PRD
const MIN_VALID_CONTENT_LENGTH = 200; // characters

// Standard story statuses
const STANDARD_STATUSES = ['Idea', 'Planning', 'Active', 'Review', 'Done'];

// Standard story point values
const STANDARD_STORY_POINTS = ['1', '2', '3', '5', '8', '13', '21'];

// AI-powered story extraction patterns
const STORY_PATTERNS = [
  // Markdown headers with status indicators
  /^#{1,3}\s*\[?([^\]]+)\]?\s*[-–—]\s*([^\n]+)$/gm,
  // Bullet points with status
  /^[-*]\s*\[?([^\]]+)\]?\s*[-–—]\s*([^\n]+)$/gm,
  // Numbered lists with status
  /^\d+\.\s*\[?([^\]]+)\]?\s*[-–—]\s*([^\n]+)$/gm,
  // Status: Title format
  /^([A-Za-z]+):\s*([^\n]+)$/gm,
  // Title - Status format
  /^([^-]+)\s*[-–—]\s*([A-Za-z]+)$/gm
];

// Priority indicators
const PRIORITY_INDICATORS = {
  'high': 5,
  'critical': 5,
  'urgent': 5,
  'medium': 3,
  'normal': 3,
  'low': 1,
  'nice-to-have': 1,
  'future': 1
};

// Story point indicators
const STORY_POINT_INDICATORS = {
  'tiny': '1',
  'small': '2',
  'medium': '3',
  'large': '5',
  'xlarge': '8',
  'xxlarge': '13',
  'epic': '21'
};

async function getAllRepositories() {
  try {
    console.log('🔍 Fetching all repositories...');
    
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
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`✅ Found ${repos.length} repositories`);
    return repos;
  } catch (error) {
    console.error('❌ Error fetching repositories:', error.message);
    return [];
  }
}

async function findPrdFiles(repoName) {
  try {
    console.log(`🔍 Searching for PRD files in ${repoName}...`);
    
    const prdFiles = [];
    
    for (const pattern of PRD_FILE_PATTERNS) {
      try {
        let searchQuery;
        
        if (typeof pattern === 'string') {
          // Exact filename match
          searchQuery = `repo:${owner}/${repoName} filename:${pattern}`;
        } else if (pattern instanceof RegExp) {
          // Regex pattern - search more broadly and filter results
          searchQuery = `repo:${owner}/${repoName} filename:*.md`;
        }
        
        const response = await octokit.search.code({
          q: searchQuery,
          per_page: 100
        });
        
        if (response.data.items.length > 0) {
          // Filter results based on pattern type
          let matchingFiles = response.data.items;
          
          if (pattern instanceof RegExp) {
            // Apply regex filter to filenames
            matchingFiles = response.data.items.filter(item => 
              pattern.test(item.name)
            );
          }
          
          if (matchingFiles.length > 0) {
            prdFiles.push(...matchingFiles.map(item => ({
              name: item.name,
              path: item.path,
              sha: item.sha,
              url: item.html_url,
              // Include additional metadata for better prioritization
              repository: repoName,
              owner: owner
            })));
          }
        }
      } catch (error) {
        console.warn(`⚠️ Error searching for pattern ${pattern} in ${repoName}:`, error.message);
      }
      
      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Ensure only one PRD per project by prioritizing the most relevant one
    const prioritizedPrdFiles = await prioritizePrdFiles(prdFiles);
    
    console.log(`📁 Found ${prdFiles.length} potential PRD files in ${repoName}, selected ${prioritizedPrdFiles.length} for processing`);
    return prioritizedPrdFiles;
  } catch (error) {
    console.error(`❌ Error searching for PRD files in ${repoName}:`, error.message);
    return [];
  }
}

// Prioritize PRD files to ensure only one per project
async function prioritizePrdFiles(files) {
  if (files.length === 0) return [];
  if (files.length === 1) return files;
  
  // Filter out deprecated files first
  const nonDeprecatedFiles = files.filter(file => {
    const fileName = file.name.toLowerCase();
    const filePath = file.path.toLowerCase();
    
    // Skip files with "deprecated" in name or path
    if (fileName.includes('deprecated') || filePath.includes('deprecated')) {
      console.log(`🚫 Skipping deprecated file: ${file.path}`);
      return false;
    }
    
    return true;
  });
  
  if (nonDeprecatedFiles.length === 0) {
    console.log(`⚠️ All PRD files in this project appear to be deprecated`);
    return [];
  }
  
  if (nonDeprecatedFiles.length === 1) {
    return nonDeprecatedFiles;
  }
  
  // Get commit dates for better prioritization
  const filesWithDates = await Promise.all(
    nonDeprecatedFiles.map(async (file) => {
      try {
        // Get the most recent commit for this file
        const response = await octokit.repos.listCommits({
          owner: file.owner,
          repo: file.repository,
          path: file.path,
          per_page: 1
        });
        
        const lastCommit = response.data[0];
        const commitDate = lastCommit ? new Date(lastCommit.commit.author.date) : new Date(0);
        
        return {
          ...file,
          lastModified: commitDate
        };
      } catch (error) {
        console.warn(`⚠️ Could not get commit date for ${file.path}:`, error.message);
        return {
          ...file,
          lastModified: new Date(0) // Default to old date if we can't get commit info
        };
      }
    })
  );
  
  // Priority scoring system
  const priorityScores = filesWithDates.map(file => {
    let score = 0;
    const fileName = file.name.toLowerCase();
    
    // Higher priority for standard names
    if (fileName === 'prd.md') score += 100;
    else if (fileName === 'readme.md') score += 90;
    else if (fileName === 'requirements.md') score += 85;
    else if (fileName === 'features.md') score += 80;
    else if (fileName === 'stories.md') score += 75;
    else if (fileName === 'roadmap.md') score += 70;
    
    // Bonus for version indicators (likely more current)
    if (/\d{4}/.test(fileName)) score += 20; // Year
    if (/v\d+/.test(fileName)) score += 15;  // Version
    if (/final|latest|current/i.test(fileName)) score += 10;
    
    // Bonus for clear PRD indicators
    if (/prd/i.test(fileName)) score += 25;
    
    // Bonus for recent modifications (weighted by recency)
    const now = new Date();
    const daysSinceModified = Math.floor((now - file.lastModified) / (1000 * 60 * 60 * 24));
    
    if (daysSinceModified <= 7) score += 50;        // Modified in last week
    else if (daysSinceModified <= 30) score += 30;  // Modified in last month
    else if (daysSinceModified <= 90) score += 15;  // Modified in last 3 months
    else if (daysSinceModified <= 365) score += 5;  // Modified in last year
    
    return { file, score, daysSinceModified };
  });
  
  // Sort by score (highest first) and return the top one
  priorityScores.sort((a, b) => b.score - a.score);
  
  console.log(`📊 PRD file priority scores for ${nonDeprecatedFiles[0].path.split('/')[0]}:`);
  priorityScores.forEach(({ file, score, daysSinceModified }) => {
    const dateStr = file.lastModified.toISOString().split('T')[0];
    console.log(`   ${file.name}: ${score} points (modified ${daysSinceModified} days ago, ${dateStr})`);
  });
  
  return [priorityScores[0].file];
}

async function getFileContent(repoName, filePath, sha) {
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

function extractStoriesFromContent(content, repoName) {
  const stories = [];
  const lines = content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip empty lines and comments
    if (!line || line.startsWith('<!--') || line.startsWith('//')) {
      continue;
    }
    
    // Try to extract story information using AI patterns
    for (const pattern of STORY_PATTERNS) {
      const match = line.match(pattern);
      if (match) {
        const status = match[1]?.toLowerCase();
        const title = match[2] || match[1];
        
        if (title && title.length > 3) {
          // Determine priority from context
          let priority = 3; // Default medium
          let storyPoints = null;
          
          // Check for priority indicators in the line or surrounding context
          const lowerLine = line.toLowerCase();
          for (const [indicator, value] of Object.entries(PRIORITY_INDICATORS)) {
            if (lowerLine.includes(indicator)) {
              priority = value;
              break;
            }
          }
          
          // Check for story point indicators
          for (const [indicator, value] of Object.entries(STORY_POINT_INDICATORS)) {
            if (lowerLine.includes(indicator)) {
              storyPoints = value;
              break;
            }
          }
          
          // Look for story points in surrounding context (next few lines)
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
          
          // Map status to standard statuses
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
          
          break; // Found a match, move to next line
        }
      }
    }
  }
  
  return stories;
}

async function processPrdFile(repoName, filePath, sha) {
  try {
    console.log(`📄 Processing PRD file: ${filePath}`);
    
    const content = await getFileContent(repoName, filePath, sha);
    if (!content) {
      console.warn(`⚠️ Could not retrieve content for ${filePath}`);
      return null;
    }
    
    // Validate PRD schema before processing
    if (!validatePrdSchema(content)) {
      console.warn(`⚠️ PRD ${filePath} does not match expected schema - needs updating`);
      return {
        repoName,
        filePath,
        sha,
        needsSchemaUpdate: true,
        validationIssues: getValidationIssues(content)
      };
    }
    
    // Extract stories using AI patterns
    const stories = await extractStoriesFromContent(content, repoName);
    
    if (stories.length === 0) {
      console.warn(`⚠️ No stories found in ${filePath}`);
      return null;
    }
    
    console.log(`✅ Extracted ${stories.length} stories from ${filePath}`);
    
    return {
      repoName,
      filePath,
      sha,
      stories,
      needsSchemaUpdate: false
    };
  } catch (error) {
    console.error(`❌ Error processing PRD file ${filePath}:`, error.message);
    return null;
  }
}

// Validate if PRD content matches expected schema
function validatePrdSchema(content) {
  if (!content || content.length < MIN_VALID_CONTENT_LENGTH) {
    return false;
  }
  
  // Check for story structure patterns
  const hasStoryStructure = SCHEMA_VALIDATION_PATTERNS.hasStoryStructure.some(pattern => 
    pattern.test(content)
  );
  
  // Check for project context patterns
  const hasProjectContext = SCHEMA_VALIDATION_PATTERNS.hasProjectContext.some(pattern => 
    pattern.test(content)
  );
  
  return hasStoryStructure && hasProjectContext;
}

// Get specific validation issues for debugging
function getValidationIssues(content) {
  const issues = [];
  
  if (!content || content.length < MIN_VALID_CONTENT_LENGTH) {
    issues.push(`Content too short (${content?.length || 0} chars, need ${MIN_VALID_CONTENT_LENGTH}+)`);
  }
  
  const hasStoryStructure = SCHEMA_VALIDATION_PATTERNS.hasStoryStructure.some(pattern => 
    pattern.test(content)
  );
  if (!hasStoryStructure) {
    issues.push('Missing clear story structure (headers, bullet points, status indicators)');
  }
  
  const hasProjectContext = SCHEMA_VALIDATION_PATTERNS.hasProjectContext.some(pattern => 
    pattern.test(content)
  );
  if (!hasProjectContext) {
    issues.push('Missing project context (project, feature, story, requirement keywords)');
  }
  
  return issues;
}

async function processRepository(repoName) {
  try {
    console.log(`\n🔄 Processing repository: ${repoName}`);
    
    const prdFiles = await findPrdFiles(repoName);
    if (prdFiles.length === 0) {
      console.log(`⚠️ No PRD files found in ${repoName}`);
      return [];
    }
    
    const allStories = [];
    
    for (const file of prdFiles) {
      console.log(`📄 Processing file: ${file.path}`);
      
      const result = await processPrdFile(repoName, file.path, file.sha);
      if (!result) {
        continue;
      }
      
      if (result.needsSchemaUpdate) {
        console.log(`⚠️ PRD ${file.path} needs schema update:`, result.validationIssues.join(', '));
        continue;
      }
      
      console.log(`📝 Extracted ${result.stories.length} stories from ${file.path}`);
      allStories.push(...result.stories);
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`✅ Total stories extracted from ${repoName}: ${allStories.length}`);
    return allStories;
  } catch (error) {
    console.error(`❌ Error processing repository ${repoName}:`, error.message);
    return [];
  }
}

async function saveStoriesToNotion(stories) {
  try {
    console.log(`\n💾 Saving ${stories.length} stories to Notion...`);
    
    let saved = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const story of stories) {
      try {
        // Check if story already exists
        const existingStories = await getPrdStoryEntry(story.repository, story.status);
        const exists = existingStories.some(s => 
          s.storyTitle.toLowerCase() === story.title.toLowerCase() &&
          s.repository === story.repository
        );
        
        if (exists) {
          console.log(`⏭️ Skipping existing story: ${story.title}`);
          skipped++;
          continue;
        }
        
        // Save to Notion
        await addPrdStoryEntry({
          projectName: story.repository,
          storyTitle: story.title,
          status: story.status,
          priority: story.priority,
          storyPoints: story.storyPoints,
          repository: story.repository,
          notes: `Extracted from: ${story.source}`
        });
        
        console.log(`✅ Saved story: ${story.title}`);
        saved++;
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error) {
        console.error(`❌ Error saving story ${story.title}:`, error.message);
        errors++;
      }
    }
    
    console.log(`\n📊 Story Processing Summary:`);
    console.log(`✅ Saved: ${saved}`);
    console.log(`⏭️ Skipped: ${skipped}`);
    console.log(`❌ Errors: ${errors}`);
    
  } catch (error) {
    console.error('❌ Error saving stories to Notion:', error.message);
  }
}

async function main() {
  try {
    console.log('🚀 Starting PRD standardization process...');
    
    // Get all repositories
    const repos = await getAllRepositories();
    if (repos.length === 0) {
      console.log('❌ No repositories found');
      return;
    }
    
    // Process each repository
    const allStories = [];
    for (const repo of repos) {
      const stories = await processRepository(repo.name);
      allStories.push(...stories);
    }
    
    console.log(`\n📊 Total stories extracted: ${allStories.length}`);
    
    if (allStories.length > 0) {
      // Save to Notion
      await saveStoriesToNotion(allStories);
    }
    
    console.log('\n🎉 PRD standardization complete!');
    
  } catch (error) {
    console.error('❌ Error in main process:', error.message);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = {
  getAllRepositories,
  findPrdFiles,
  prioritizePrdFiles,
  extractStoriesFromContent,
  processRepository,
  saveStoriesToNotion
};
