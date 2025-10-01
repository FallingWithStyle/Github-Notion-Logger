/**
 * Project Management Service for Epic 9
 * Handles project overview and management operations
 */

const DataConsistencyService = require('./data-consistency-service');
const ErrorHandlingService = require('./error-handling-service');
const PerformanceOptimizationService = require('./performance-optimization-service');
const { ProjectOverviewModel, ApiResponseModel } = require('../models/project-models');

class ProjectManagementService {
  constructor() {
    this.consistencyService = new DataConsistencyService();
    this.errorHandler = new ErrorHandlingService();
    this.performanceOptimizer = new PerformanceOptimizationService();
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Get project overview with health indicators
   * @param {Object} filters - Filter criteria
   * @returns {Promise<Object>} Project overview data
   */
  async getProjectOverview(filters = {}) {
    try {
      console.log('📊 Getting project overview...', filters);

      const cacheKey = `overview:${JSON.stringify(filters)}`;
      const cached = this.performanceOptimizer.getCachedData(cacheKey);
      
      if (cached) {
        console.log('📈 Returning cached project overview');
        return ApiResponseModel.success(cached, { cached: true });
      }

      // Set timeout for the entire operation
      const timeout = filters.timeout || 10000; // 10 second default timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Operation timed out after ${timeout}ms`)), timeout);
      });

      // Get data from multiple sources with timeout
      const dataPromise = this.gatherProjectData(filters);
      const sources = await Promise.race([dataPromise, timeoutPromise]);
      
      // Reconcile data for each project in parallel
      const reconciliationPromises = sources.projectNames.map(async (projectName) => {
        try {
          const projectSources = {
            githubData: sources.githubData[projectName],
            notionData: sources.notionData[projectName],
            commitLogData: sources.commitLogData[projectName],
            cachedData: sources.cachedData[projectName]
          };

          const reconciledData = await this.consistencyService.reconcileProjectData(
            projectName, 
            projectSources
          );

          const projectOverview = this.consistencyService.createProjectOverviewModel(reconciledData);
          return { projectName, data: projectOverview.toJSON(), error: null };

        } catch (error) {
          console.warn(`⚠️ Failed to reconcile data for ${projectName}:`, error.message);
          return { projectName, data: null, error: error.message };
        }
      });

      // Wait for all reconciliations to complete in parallel with timeout
      const reconciliationResults = await Promise.race([
        Promise.all(reconciliationPromises),
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Reconciliation timed out')), timeout);
        })
      ]);
      
      // Filter out failed reconciliations and collect successful ones
      const reconciledProjects = reconciliationResults
        .filter(result => result.data !== null)
        .map(result => result.data);

      // Apply filters with performance optimization
      const filteredProjects = this.performanceOptimizer.optimizeFiltering(reconciledProjects, filters);

      // Sort projects with performance optimization
      const sortedProjects = this.performanceOptimizer.optimizeSorting(filteredProjects, filters.sortBy || 'lastActivity');

      // Apply pagination
      const paginatedProjects = this.applyPagination(sortedProjects, filters);

      // Cache the results
      this.performanceOptimizer.setCachedData(cacheKey, sortedProjects);

      return ApiResponseModel.success(paginatedProjects, {
        total: sortedProjects.length,
        filters: filters,
        pagination: this.calculatePaginationMetadata(sortedProjects.length, filters),
        cached: false
      });

    } catch (error) {
      return this.errorHandler.handleApiError(error, 'getProjectOverview', this.getFallbackProjectData());
    }
  }

  /**
   * Apply pagination to project data
   * @param {Array} projects - Array of projects
   * @param {Object} filters - Filter criteria including pagination
   * @returns {Array} Paginated project data
   */
  applyPagination(projects, filters) {
    const page = parseInt(filters.page) || 1;
    const limit = parseInt(filters.limit) || 10;
    
    // Ensure page and limit are positive
    const validPage = Math.max(1, page);
    const validLimit = Math.max(1, Math.min(100, limit)); // Cap at 100 items per page
    
    const startIndex = (validPage - 1) * validLimit;
    const endIndex = startIndex + validLimit;
    
    return projects.slice(startIndex, endIndex);
  }

  /**
   * Calculate pagination metadata
   * @param {number} totalItems - Total number of items
   * @param {Object} filters - Filter criteria including pagination
   * @returns {Object} Pagination metadata
   */
  calculatePaginationMetadata(totalItems, filters) {
    const page = parseInt(filters.page) || 1;
    const limit = parseInt(filters.limit) || 10;
    
    // Ensure page and limit are positive
    const validPage = Math.max(1, page);
    const validLimit = Math.max(1, Math.min(100, limit)); // Cap at 100 items per page
    
    const totalPages = Math.ceil(totalItems / validLimit);
    const hasNext = validPage < totalPages;
    const hasPrev = validPage > 1;
    
    return {
      page: validPage,
      limit: validLimit,
      total: totalItems,
      totalPages: totalPages,
      hasNext: hasNext,
      hasPrev: hasPrev
    };
  }

  /**
   * Get project health status
   * @param {string} projectName - Name of the project
   * @returns {Promise<Object>} Project health data
   */
  async getProjectHealth(projectName) {
    try {
      console.log(`🏥 Getting health status for project: ${projectName}`);

      const cacheKey = `health:${projectName}`;
      const cached = this.cache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        return ApiResponseModel.success(cached.data, { cached: true });
      }

      // Get data for specific project
      const sources = await this.gatherProjectData({ projectName });
      const projectSources = {
        githubData: sources.githubData[projectName],
        notionData: sources.notionData[projectName],
        commitLogData: sources.commitLogData[projectName],
        cachedData: sources.cachedData[projectName]
      };

      const reconciledData = await this.consistencyService.reconcileProjectData(
        projectName, 
        projectSources
      );

      const healthModel = this.consistencyService.createProjectHealthModel(reconciledData);
      const healthData = healthModel.toJSON();

      // Cache the result
      this.cache.set(cacheKey, {
        data: healthData,
        timestamp: Date.now()
      });

      return ApiResponseModel.success(healthData, { cached: false });

    } catch (error) {
      console.error(`❌ Error getting project health for ${projectName}:`, error);
      return ApiResponseModel.error(`Failed to get project health: ${error.message}`);
    }
  }

  /**
   * Get project categories
   * @returns {Promise<Object>} Available project categories
   */
  async getProjectCategories() {
    try {
      const overview = await this.getProjectOverview();
      if (!overview.success) {
        throw new Error(overview.error);
      }

      const categories = [...new Set(overview.data.map(p => p.category))];
      const categoryStats = categories.map(category => {
        const projects = overview.data.filter(p => p.category === category);
        return {
          name: category,
          count: projects.length,
          activeCount: projects.filter(p => p.health.healthStatus === 'excellent' || p.health.healthStatus === 'good').length,
          averageHealth: Math.round(projects.reduce((sum, p) => sum + p.health.healthScore, 0) / projects.length)
        };
      });

      return ApiResponseModel.success(categoryStats, { total: categories.length });

    } catch (error) {
      console.error('❌ Error getting project categories:', error);
      return ApiResponseModel.error(`Failed to get project categories: ${error.message}`);
    }
  }

  /**
   * Search projects
   * @param {string} query - Search query
   * @param {Object} filters - Additional filters
   * @returns {Promise<Object>} Search results
   */
  async searchProjects(query, filters = {}) {
    try {
      console.log(`🔍 Searching projects: "${query}"`);

      if (!query || query.trim().length < 2) {
        return ApiResponseModel.success([], { query, total: 0 });
      }

      const searchFilters = {
        ...filters,
        search: query.trim()
      };

      const overview = await this.getProjectOverview(searchFilters);
      if (!overview.success) {
        throw new Error(overview.error);
      }

      return ApiResponseModel.success(overview.data, {
        query,
        total: overview.data.length
      });

    } catch (error) {
      console.error('❌ Error searching projects:', error);
      return ApiResponseModel.error(`Failed to search projects: ${error.message}`);
    }
  }

  /**
   * Gather project data from multiple sources
   */
  async gatherProjectData(filters = {}) {
    const sources = {
      projectNames: [],
      githubData: {},
      notionData: {},
      commitLogData: {},
      cachedData: {}
    };

    try {
      // Get cached repository data
      const { getAllCachedRepositories } = require('../notion');
      const cachedRepos = await getAllCachedRepositories();
      
      // Filter out repos with undefined names and use repository field as name
      const validRepos = cachedRepos.filter(repo => repo.repository && repo.repository !== 'undefined');
      sources.projectNames = validRepos.map(repo => repo.repository);
      
      validRepos.forEach(repo => {
        sources.cachedData[repo.repository] = {
          name: repo.repository,
          progress: repo.progress || 0,
          storiesTotal: repo.storyCount || 0,
          storiesCompleted: Math.round(((repo.storyCount || 0) * (repo.progress || 0)) / 100),
          tasksTotal: repo.taskCount || 0,
          tasksCompleted: Math.round(((repo.taskCount || 0) * (repo.progress || 0)) / 100),
          hasPrd: repo.hasPrd || false,
          hasTaskList: repo.taskCount > 0,
          lastActivity: repo.lastScanned,
          category: repo.category || 'Miscellaneous / Standalone',
          status: repo.status || 'unknown'
        };
      });

      // Get real GitHub data for each project in parallel
      const githubPromises = sources.projectNames.map(async (projectName) => {
        try {
          const githubData = await this.fetchGitHubData(projectName);
          return { projectName, data: githubData, error: null };
        } catch (error) {
          console.warn(`⚠️ Failed to fetch GitHub data for ${projectName}:`, error.message);
          return { 
            projectName, 
            data: {
              commits: 0,
              prs: 0,
              issues: 0,
              lastActivity: null,
              error: error.message
            }, 
            error: error.message 
          };
        }
      });

      // Get real Notion data for each project in parallel
      const notionPromises = sources.projectNames.map(async (projectName) => {
        try {
          const notionData = await this.fetchNotionData(projectName);
          return { projectName, data: notionData, error: null };
        } catch (error) {
          console.warn(`⚠️ Failed to fetch Notion data for ${projectName}:`, error.message);
          return { 
            projectName, 
            data: {
              stories: 0,
              tasks: 0,
              lastUpdated: null,
              error: error.message
            }, 
            error: error.message 
          };
        }
      });

      // Wait for all GitHub and Notion data to be fetched in parallel
      const [githubResults, notionResults] = await Promise.all([
        Promise.all(githubPromises),
        Promise.all(notionPromises)
      ]);

      // Process results
      githubResults.forEach(({ projectName, data }) => {
        sources.githubData[projectName] = data;
      });

      notionResults.forEach(({ projectName, data }) => {
        sources.notionData[projectName] = data;
      });

      // Get commit log data
      const commitLogData = await this.getCommitLogData();
      Object.entries(commitLogData).forEach(([projectName, data]) => {
        sources.commitLogData[projectName] = data;
      });

      // Filter project names based on filters
      if (filters.projectName) {
        sources.projectNames = sources.projectNames.filter(name => 
          name.toLowerCase().includes(filters.projectName.toLowerCase())
        );
      }

      if (filters.category) {
        sources.projectNames = sources.projectNames.filter(name => {
          const project = sources.cachedData[name];
          return project && project.category === filters.category;
        });
      }

      if (filters.status) {
        sources.projectNames = sources.projectNames.filter(name => {
          const project = sources.cachedData[name];
          return project && project.status === filters.status;
        });
      }

      return sources;

    } catch (error) {
      console.error('❌ Error gathering project data:', error);
      throw error;
    }
  }

  /**
   * Fetch GitHub data for a specific project
   */
  async fetchGitHubData(projectName) {
    try {
      // Check if GitHub token is available
      if (!process.env.GITHUB_TOKEN) {
        console.warn(`⚠️ No GitHub token available for ${projectName}, using fallback data`);
        return this.getFallbackGitHubData(projectName);
      }

      const { Octokit } = require('@octokit/rest');
      const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
      
      const owner = process.env.GITHUB_OWNER || 'your-username';
      const repo = projectName;

      try {
        // Fetch repository information
        const repoInfo = await octokit.repos.get({ owner, repo });
        
        // Fetch recent commits (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const commits = await octokit.repos.listCommits({
          owner,
          repo,
          since: thirtyDaysAgo.toISOString(),
          per_page: 100
        });

        // Fetch open issues (with permission check)
        let issues = { data: [] };
        try {
          issues = await octokit.issues.listForRepo({
            owner,
            repo,
            state: 'open',
            per_page: 100
          });
        } catch (error) {
          if (error.status === 403) {
            console.warn(`⚠️ No permission to access issues for ${projectName}, skipping issues data`);
            issues = { data: [] };
          } else {
            throw error;
          }
        }

        // Fetch open pull requests (with permission check)
        let pullRequests = { data: [] };
        try {
          pullRequests = await octokit.pulls.list({
            owner,
            repo,
            state: 'open',
            per_page: 100
          });
        } catch (error) {
          if (error.status === 403) {
            console.warn(`⚠️ No permission to access pull requests for ${projectName}, skipping PR data`);
            pullRequests = { data: [] };
          } else {
            throw error;
          }
        }

        return {
          commits: commits.data.length,
          prs: pullRequests.data.length,
          issues: issues.data.length,
          lastActivity: commits.data[0]?.commit?.author?.date || new Date().toISOString(),
          stars: repoInfo.data.stargazers_count,
          forks: repoInfo.data.forks_count,
          language: repoInfo.data.language || 'Unknown',
          size: repoInfo.data.size,
          _githubData: {
            lastUpdated: new Date(),
            source: 'github-api',
            owner,
            repo
          }
        };

      } catch (apiError) {
        if (apiError.status === 404) {
          console.warn(`⚠️ Repository ${owner}/${repo} not found, using fallback data`);
          return this.getFallbackGitHubData(projectName);
        }
        throw apiError;
      }

    } catch (error) {
      console.error(`❌ Error fetching GitHub data for ${projectName}:`, error);
      return this.getFallbackGitHubData(projectName);
    }
  }

  /**
   * Get fallback GitHub data when API is unavailable
   */
  getFallbackGitHubData(projectName) {
    return {
      commits: 0,
      prs: 0,
      issues: 0,
      lastActivity: null,
      stars: 0,
      forks: 0,
      language: 'Unknown',
      size: 0,
      _githubData: {
        lastUpdated: new Date(),
        source: 'fallback',
        error: 'GitHub API unavailable'
      }
    };
  }

  /**
   * Fetch Notion data for a specific project
   */
  async fetchNotionData(projectName) {
    try {
      // Check if Notion API key is available
      if (!process.env.NOTION_API_KEY) {
        console.warn(`⚠️ No Notion API key available for ${projectName}, using fallback data`);
        return this.getFallbackNotionData(projectName);
      }

      const { Client } = require('@notionhq/client');
      const notion = new Client({ auth: process.env.NOTION_API_KEY });
      
      // Use the existing cached repository data as the primary source
      // since it already contains real Notion data
      const { getAllCachedRepositories } = require('../notion');
      const cachedRepos = await getAllCachedRepositories();
      
      const projectRepo = cachedRepos.find(repo => 
        repo.repository && repo.repository.toLowerCase() === projectName.toLowerCase()
      );
      
      if (projectRepo) {
        return {
          stories: projectRepo.storyCount || 0,
          tasks: projectRepo.taskCount || 0,
          lastUpdated: projectRepo.lastScanned || new Date().toISOString(),
          pages: 1, // Notion database pages
          databases: 1, // Single database per project
          hasPrd: projectRepo.hasPrd || false,
          hasTaskList: (projectRepo.taskCount || 0) > 0,
          progress: projectRepo.progress || 0,
          category: projectRepo.category || 'Miscellaneous / Standalone',
          status: projectRepo.status || 'unknown',
          _notionData: {
            lastUpdated: new Date(),
            source: 'notion-cached',
            repository: projectName
          }
        };
      } else {
        console.warn(`⚠️ Project ${projectName} not found in cached Notion data, using fallback`);
        return this.getFallbackNotionData(projectName);
      }

    } catch (error) {
      console.error(`❌ Error fetching Notion data for ${projectName}:`, error);
      return this.getFallbackNotionData(projectName);
    }
  }

  /**
   * Get fallback Notion data when API is unavailable
   */
  getFallbackNotionData(projectName) {
    return {
      stories: 0,
      tasks: 0,
      lastUpdated: null,
      pages: 0,
      databases: 0,
      hasPrd: false,
      hasTaskList: false,
      progress: 0,
      category: 'Unknown',
      status: 'unknown',
      _notionData: {
        lastUpdated: new Date(),
        source: 'fallback',
        error: 'Notion data unavailable'
      }
    };
  }

  /**
   * Get commit log data
   */
  async getCommitLogData() {
    try {
      const fs = require('fs').promises;
      const path = require('path');
      
      const DATA_DIR = process.env.DATA_DIR || (require('fs').existsSync('/data') ? '/data' : path.join(__dirname, '..', 'data'));
      const COMMIT_LOG_PATH = path.join(DATA_DIR, 'commit-log.json');
      
      if (!require('fs').existsSync(COMMIT_LOG_PATH)) {
        return {};
      }

      const data = await fs.readFile(COMMIT_LOG_PATH, 'utf8');
      const commitLog = JSON.parse(data);

      // Process commit log data
      const projectData = {};
      const today = new Date();
      const ninetyDaysAgo = new Date(today);
      ninetyDaysAgo.setDate(today.getDate() - 90);

      commitLog
        .filter(day => new Date(day.date) >= ninetyDaysAgo)
        .forEach(day => {
          Object.entries(day.projects).forEach(([projectName, project]) => {
            if (!projectData[projectName]) {
              projectData[projectName] = {
                totalCommits: 0,
                lastActivity: null
              };
            }
            projectData[projectName].totalCommits += project.commits || 0;
            if (!projectData[projectName].lastActivity || new Date(day.date) > new Date(projectData[projectName].lastActivity)) {
              projectData[projectName].lastActivity = day.date;
            }
          });
        });

      return projectData;

    } catch (error) {
      console.warn('⚠️ Could not load commit log data:', error.message);
      return {};
    }
  }

  /**
   * Apply filters to project data
   */
  applyFilters(projects, filters) {
    let filtered = [...projects];

    // Search filter
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      filtered = filtered.filter(project => 
        project.name.toLowerCase().includes(searchTerm) ||
        project.category.toLowerCase().includes(searchTerm) ||
        project.repository.toLowerCase().includes(searchTerm)
      );
    }

    // Category filter
    if (filters.category) {
      filtered = filtered.filter(project => project.category === filters.category);
    }

    // Status filter
    if (filters.status) {
      filtered = filtered.filter(project => project.status === filters.status);
    }

    // Health status filter
    if (filters.healthStatus) {
      filtered = filtered.filter(project => project.health.healthStatus === filters.healthStatus);
    }

    // Activity status filter
    if (filters.activityStatus) {
      filtered = filtered.filter(project => project.activityStatus === filters.activityStatus);
    }

    return filtered;
  }

  /**
   * Sort projects
   */
  sortProjects(projects, sortBy) {
    const sorted = [...projects];

    switch (sortBy) {
      case 'name':
        return sorted.sort((a, b) => a.name.localeCompare(b.name));
      
      case 'healthScore':
        return sorted.sort((a, b) => b.health.healthScore - a.health.healthScore);
      
      case 'progress':
        return sorted.sort((a, b) => b.progress - a.progress);
      
      case 'lastActivity':
      default:
        return sorted.sort((a, b) => {
          if (!a.lastActivity && !b.lastActivity) return 0;
          if (!a.lastActivity) return 1;
          if (!b.lastActivity) return -1;
          return new Date(b.lastActivity) - new Date(a.lastActivity);
        });
    }
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
    console.log('🗑️ Project management cache cleared');
  }

  /**
   * Get cache status
   */
  getCacheStatus() {
    return {
      size: this.cache.size,
      timeout: this.cacheTimeout,
      entries: Array.from(this.cache.keys())
    };
  }

  /**
   * Get fallback project data when errors occur
   */
  getFallbackProjectData() {
    return this.errorHandler.getFallbackData('projects') || [];
  }

  /**
   * Set fallback project data
   */
  setFallbackProjectData(data) {
    this.errorHandler.setFallbackData('projects', data);
  }

  /**
   * Get project categories
   * @returns {Object} API response with categories
   */
  async getProjectCategories() {
    try {
      console.log('📂 Getting project categories...');

      const cacheKey = 'categories';
      const cached = this.performanceOptimizer.getCachedData(cacheKey);

      if (cached) {
        console.log('📈 Returning cached categories');
        return ApiResponseModel.success(cached, { cached: true });
      }

      // Get data from multiple sources
      const sources = await this.gatherProjectData();

      // Extract unique categories
      const categories = new Set();
      sources.projectNames.forEach(projectName => {
        const cachedData = sources.cachedData[projectName];
        if (cachedData && cachedData.category) {
          categories.add(cachedData.category);
        }
      });

      const categoriesArray = Array.from(categories).sort();

      // Cache the results
      this.performanceOptimizer.setCachedData(cacheKey, categoriesArray);

      return ApiResponseModel.success(categoriesArray, {
        total: categoriesArray.length,
        cached: false
      });

    } catch (error) {
      return this.errorHandler.handleApiError(error, 'getProjectCategories', []);
    }
  }

  /**
   * Search projects
   * @param {string} query - Search query
   * @param {Object} filters - Additional filters
   * @returns {Object} API response with search results
   */
  async searchProjects(query, filters = {}) {
    try {
      console.log(`🔍 Searching projects: "${query}" with filters:`, filters);

      const searchFilters = {
        ...filters,
        search: query
      };

      const result = await this.getProjectOverview(searchFilters);
      
      if (!result.success) {
        return result;
      }

      return ApiResponseModel.success(result.data, {
        query: query,
        total: result.data.length,
        filters: filters,
        pagination: result.metadata?.pagination || null,
        cached: result.metadata?.cached || false
      });

    } catch (error) {
      return this.errorHandler.handleApiError(error, 'searchProjects', []);
    }
  }
}

module.exports = ProjectManagementService;
