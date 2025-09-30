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

      // Get data from multiple sources
      const sources = await this.gatherProjectData(filters);
      
      // Reconcile data for each project
      const reconciledProjects = [];
      for (const projectName of sources.projectNames) {
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
          reconciledProjects.push(projectOverview.toJSON());

        } catch (error) {
          console.warn(`⚠️ Failed to reconcile data for ${projectName}:`, error.message);
          // Continue with other projects
        }
      }

      // Apply filters with performance optimization
      const filteredProjects = this.performanceOptimizer.optimizeFiltering(reconciledProjects, filters);

      // Sort projects with performance optimization
      const sortedProjects = this.performanceOptimizer.optimizeSorting(filteredProjects, filters.sortBy || 'lastActivity');

      // Cache the results
      this.performanceOptimizer.setCachedData(cacheKey, sortedProjects);

      return ApiResponseModel.success(sortedProjects, {
        total: sortedProjects.length,
        filters: filters,
        cached: false
      });

    } catch (error) {
      return this.errorHandler.handleApiError(error, 'getProjectOverview', this.getFallbackProjectData());
    }
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
      
      sources.projectNames = cachedRepos.map(repo => repo.name);
      cachedRepos.forEach(repo => {
        sources.cachedData[repo.name] = {
          name: repo.name,
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

      const data = await fs.readFileSync(COMMIT_LOG_PATH, 'utf8');
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
}

module.exports = ProjectManagementService;
