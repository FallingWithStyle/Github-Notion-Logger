/**
 * Progress Tracking Service for Epic 9
 * Handles detailed progress tracking and analytics
 */

const DataConsistencyService = require('./data-consistency-service');
const ErrorHandlingService = require('./error-handling-service');
const PerformanceOptimizationService = require('./performance-optimization-service');
const { ProgressAnalyticsModel, ApiResponseModel } = require('../models/project-models');

class ProgressTrackingService {
  constructor() {
    this.consistencyService = new DataConsistencyService();
    this.errorHandler = new ErrorHandlingService();
    this.performanceOptimizer = new PerformanceOptimizationService();
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Get progress analytics for all projects
   * @param {Object} filters - Filter criteria
   * @returns {Promise<Object>} Progress analytics data
   */
  async getProgressAnalytics(filters = {}) {
    try {
      console.log('📈 Getting progress analytics...', filters);

      const cacheKey = `analytics:${JSON.stringify(filters)}`;
      const cached = this.cache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        console.log('📈 Returning cached progress analytics');
        return ApiResponseModel.success(cached.data, { cached: true });
      }

      // Get data from multiple sources
      const sources = await this.gatherProjectData(filters);
      
      // Create analytics for each project
      const analytics = [];
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

          const progressAnalytics = this.consistencyService.createProgressAnalyticsModel(reconciledData);
          analytics.push(progressAnalytics.toJSON());

        } catch (error) {
          console.warn(`⚠️ Failed to create analytics for ${projectName}:`, error.message);
          // Continue with other projects
        }
      }

      // Apply filters
      const filteredAnalytics = this.applyFilters(analytics, filters);

      // Calculate aggregate metrics
      const aggregateMetrics = this.calculateAggregateMetrics(filteredAnalytics);

      // Cache the results
      this.cache.set(cacheKey, {
        data: {
          projects: filteredAnalytics,
          aggregate: aggregateMetrics
        },
        timestamp: Date.now()
      });

      return ApiResponseModel.success({
        projects: filteredAnalytics,
        aggregate: aggregateMetrics
      }, {
        total: filteredAnalytics.length,
        filters: filters,
        cached: false
      });

    } catch (error) {
      return this.errorHandler.handleApiError(error, 'getProgressAnalytics', this.getFallbackAnalyticsData());
    }
  }

  /**
   * Get incomplete work tracking
   * @param {Object} filters - Filter criteria
   * @returns {Promise<Object>} Incomplete work data
   */
  async getIncompleteWork(filters = {}) {
    try {
      console.log('📋 Getting incomplete work...', filters);

      const cacheKey = `incomplete:${JSON.stringify(filters)}`;
      const cached = this.cache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        return ApiResponseModel.success(cached.data, { cached: true });
      }

      // Get progress analytics
      const analytics = await this.getProgressAnalytics(filters);
      if (!analytics.success) {
        throw new Error(analytics.error);
      }

      // Extract incomplete work
      const incompleteWork = analytics.data.projects.map(project => ({
        projectId: project.projectId,
        projectName: project.projectName,
        incompleteStories: project.incompleteStories,
        incompleteTasks: project.incompleteTasks,
        totalIncomplete: project.incompleteStories + project.incompleteTasks,
        completionPercentage: project.overallCompletionPercentage,
        velocity: project.velocity,
        blockedItems: project.blockedItems,
        staleItems: project.staleItems,
        priority: this.calculatePriority(project)
      }));

      // Sort by priority and completion percentage
      incompleteWork.sort((a, b) => {
        if (a.priority !== b.priority) {
          return b.priority - a.priority; // Higher priority first
        }
        return a.completionPercentage - b.completionPercentage; // Lower completion first
      });

      // Cache the results
      this.cache.set(cacheKey, {
        data: incompleteWork,
        timestamp: Date.now()
      });

      return ApiResponseModel.success(incompleteWork, {
        total: incompleteWork.length,
        cached: false
      });

    } catch (error) {
      console.error('❌ Error getting incomplete work:', error);
      return ApiResponseModel.error(`Failed to get incomplete work: ${error.message}`);
    }
  }

  /**
   * Get velocity trends
   * @param {string} projectName - Optional project name for specific project trends
   * @returns {Promise<Object>} Velocity trend data
   */
  async getVelocityTrends(projectName = null) {
    try {
      console.log(`📊 Getting velocity trends${projectName ? ` for ${projectName}` : ''}...`);

      const cacheKey = `velocity:${projectName || 'all'}`;
      const cached = this.cache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        return ApiResponseModel.success(cached.data, { cached: true });
      }

      // Get historical data (simplified - in real implementation would use time-series data)
      const trends = await this.calculateVelocityTrends(projectName);

      // Cache the results
      this.cache.set(cacheKey, {
        data: trends,
        timestamp: Date.now()
      });

      return ApiResponseModel.success(trends, { cached: false });

    } catch (error) {
      console.error('❌ Error getting velocity trends:', error);
      return ApiResponseModel.error(`Failed to get velocity trends: ${error.message}`);
    }
  }

  /**
   * Get blocked and stale items
   * @param {Object} filters - Filter criteria
   * @returns {Promise<Object>} Blocked and stale items data
   */
  async getBlockedAndStaleItems(filters = {}) {
    try {
      console.log('🚫 Getting blocked and stale items...', filters);

      const cacheKey = `blocked:${JSON.stringify(filters)}`;
      const cached = this.cache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        return ApiResponseModel.success(cached.data, { cached: true });
      }

      // Get incomplete work
      const incompleteWork = await this.getIncompleteWork(filters);
      if (!incompleteWork.success) {
        throw new Error(incompleteWork.error);
      }

      // Extract blocked and stale items
      const blockedItems = [];
      const staleItems = [];

      incompleteWork.data.forEach(project => {
        project.blockedItems.forEach(item => {
          blockedItems.push({
            ...item,
            projectName: project.projectName,
            projectId: project.projectId
          });
        });

        project.staleItems.forEach(item => {
          staleItems.push({
            ...item,
            projectName: project.projectName,
            projectId: project.projectId
          });
        });
      });

      // Sort by age/priority
      blockedItems.sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity));
      staleItems.sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity));

      const result = {
        blockedItems,
        staleItems,
        summary: {
          totalBlocked: blockedItems.length,
          totalStale: staleItems.length,
          projectsWithBlockedItems: [...new Set(blockedItems.map(item => item.projectName))].length,
          projectsWithStaleItems: [...new Set(staleItems.map(item => item.projectName))].length
        }
      };

      // Cache the results
      this.cache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });

      return ApiResponseModel.success(result, { cached: false });

    } catch (error) {
      console.error('❌ Error getting blocked and stale items:', error);
      return ApiResponseModel.error(`Failed to get blocked and stale items: ${error.message}`);
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
   * Apply filters to analytics data
   */
  applyFilters(analytics, filters) {
    let filtered = [...analytics];

    // Project name filter
    if (filters.projectName) {
      const searchTerm = filters.projectName.toLowerCase();
      filtered = filtered.filter(project => 
        project.projectName.toLowerCase().includes(searchTerm)
      );
    }

    // Completion percentage filter
    if (filters.minCompletion !== undefined) {
      filtered = filtered.filter(project => 
        project.overallCompletionPercentage >= filters.minCompletion
      );
    }

    if (filters.maxCompletion !== undefined) {
      filtered = filtered.filter(project => 
        project.overallCompletionPercentage <= filters.maxCompletion
      );
    }

    // Velocity filter
    if (filters.minVelocity !== undefined) {
      filtered = filtered.filter(project => project.velocity >= filters.minVelocity);
    }

    return filtered;
  }

  /**
   * Calculate aggregate metrics
   */
  calculateAggregateMetrics(analytics) {
    if (analytics.length === 0) {
      return {
        totalProjects: 0,
        averageCompletion: 0,
        totalStories: 0,
        completedStories: 0,
        totalTasks: 0,
        completedTasks: 0,
        averageVelocity: 0,
        projectsWithBlockedItems: 0,
        projectsWithStaleItems: 0
      };
    }

    const totalStories = analytics.reduce((sum, p) => sum + p.totalStories, 0);
    const completedStories = analytics.reduce((sum, p) => sum + p.completedStories, 0);
    const totalTasks = analytics.reduce((sum, p) => sum + p.totalTasks, 0);
    const completedTasks = analytics.reduce((sum, p) => sum + p.completedTasks, 0);
    const totalIncomplete = analytics.reduce((sum, p) => sum + p.incompleteStories + p.incompleteTasks, 0);
    const averageVelocity = analytics.reduce((sum, p) => sum + p.velocity, 0) / analytics.length;
    const projectsWithBlockedItems = analytics.filter(p => p.blockedItems.length > 0).length;
    const projectsWithStaleItems = analytics.filter(p => p.staleItems.length > 0).length;

    return {
      totalProjects: analytics.length,
      averageCompletion: Math.round((completedStories + completedTasks) / (totalStories + totalTasks) * 100),
      totalStories,
      completedStories,
      totalTasks,
      completedTasks,
      totalIncomplete,
      averageVelocity: Math.round(averageVelocity * 10) / 10,
      projectsWithBlockedItems,
      projectsWithStaleItems,
      completionRate: totalStories + totalTasks > 0 ? 
        Math.round(((completedStories + completedTasks) / (totalStories + totalTasks)) * 100) : 0
    };
  }

  /**
   * Calculate priority for incomplete work
   */
  calculatePriority(project) {
    let priority = 0;

    // Higher priority for lower completion
    priority += (100 - project.overallCompletionPercentage) * 0.5;

    // Higher priority for more blocked items
    priority += project.blockedItems.length * 10;

    // Higher priority for more stale items
    priority += project.staleItems.length * 5;

    // Lower priority for higher velocity (making progress)
    priority -= project.velocity * 2;

    return Math.max(0, Math.round(priority));
  }

  /**
   * Calculate velocity trends (simplified)
   */
  async calculateVelocityTrends(projectName = null) {
    // This is a simplified implementation
    // In a real system, you'd analyze historical data over time
    
    const trends = {
      overall: {
        trend: 'stable',
        velocity: 0,
        change: 0
      },
      projects: []
    };

    if (projectName) {
      // Get specific project trend
      const analytics = await this.getProgressAnalytics({ projectName });
      if (analytics.success && analytics.data.projects.length > 0) {
        const project = analytics.data.projects[0];
        trends.projects.push({
          projectName: project.projectName,
          velocity: project.velocity,
          trend: project.trend,
          change: 0 // Would be calculated from historical data
        });
      }
    } else {
      // Get all projects trends
      const analytics = await this.getProgressAnalytics();
      if (analytics.success) {
        trends.projects = analytics.data.projects.map(project => ({
          projectName: project.projectName,
          velocity: project.velocity,
          trend: project.trend,
          change: 0 // Would be calculated from historical data
        }));

        // Calculate overall trend
        const totalVelocity = trends.projects.reduce((sum, p) => sum + p.velocity, 0);
        trends.overall.velocity = Math.round((totalVelocity / trends.projects.length) * 10) / 10;
      }
    }

    return trends;
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
    console.log('🗑️ Progress tracking cache cleared');
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
   * Get fallback analytics data when errors occur
   */
  getFallbackAnalyticsData() {
    return this.errorHandler.getFallbackData('analytics') || {
      projects: [],
      aggregate: {
        totalProjects: 0,
        averageCompletion: 0,
        totalStories: 0,
        completedStories: 0,
        totalTasks: 0,
        completedTasks: 0,
        averageVelocity: 0,
        projectsWithBlockedItems: 0,
        projectsWithStaleItems: 0
      }
    };
  }

  /**
   * Set fallback analytics data
   */
  setFallbackAnalyticsData(data) {
    this.errorHandler.setFallbackData('analytics', data);
  }
}

module.exports = ProgressTrackingService;
