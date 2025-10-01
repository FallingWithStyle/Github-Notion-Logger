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
      
      // Create analytics for each project in parallel
      const analyticsPromises = sources.projectNames.map(async (projectName) => {
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
          return { projectName, data: progressAnalytics.toJSON(), error: null };

        } catch (error) {
          console.warn(`⚠️ Failed to create analytics for ${projectName}:`, error.message);
          return { projectName, data: null, error: error.message };
        }
      });

      // Wait for all analytics to be created in parallel
      const analyticsResults = await Promise.all(analyticsPromises);
      
      // Filter out failed analytics and collect successful ones
      const analytics = analyticsResults
        .filter(result => result.data !== null)
        .map(result => result.data);

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
   * @param {Object|string} options - Options object with days, or project name string
   * @returns {Promise<Object>} Velocity trend data
   */
  async getVelocityTrends(options = {}) {
    try {
      // Handle both old string parameter and new options object
      let projectName = null;
      let days = 30; // Default to 30 days
      
      if (typeof options === 'string') {
        projectName = options;
      } else if (typeof options === 'object' && options !== null) {
        projectName = options.projectName || null;
        days = options.days || 30;
      }

      console.log(`📊 Getting velocity trends${projectName ? ` for ${projectName}` : ''}...`);

      const cacheKey = `velocity:${projectName || 'all'}:${days}`;
      const cached = this.cache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        return ApiResponseModel.success(cached.data, { cached: true });
      }

      // Get historical data (simplified - in real implementation would use time-series data)
      const trends = await this.calculateVelocityTrends(projectName, days);

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
   * Get blocked items (alias for getBlockedAndStaleItems)
   * @param {Object} filters - Filter criteria
   * @returns {Promise<Object>} Blocked items data
   */
  async getBlockedItems(filters = {}) {
    return this.getBlockedAndStaleItems(filters);
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

      // Apply pagination if specified
      const limit = parseInt(filters.limit) || 100; // Default to 100 items
      const offset = parseInt(filters.offset) || 0;
      const validLimit = Math.max(1, Math.min(1000, limit)); // Cap at 1000 items
      const validOffset = Math.max(0, offset);

      const paginatedBlockedItems = blockedItems.slice(validOffset, validOffset + validLimit);
      const paginatedStaleItems = staleItems.slice(validOffset, validOffset + validLimit);

      const result = {
        blockedItems: paginatedBlockedItems,
        staleItems: paginatedStaleItems,
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

      // Calculate pagination metadata
      const pagination = this.calculatePaginationMetadata(blockedItems.length + staleItems.length, filters);

      return ApiResponseModel.success(result, { 
        cached: false,
        pagination: pagination
      });

    } catch (error) {
      console.error('❌ Error getting blocked and stale items:', error);
      return ApiResponseModel.error(`Failed to get blocked and stale items: ${error.message}`);
    }
  }

  /**
   * Calculate pagination metadata
   * @param {number} totalItems - Total number of items
   * @param {Object} filters - Filter criteria including pagination
   * @returns {Object} Pagination metadata
   */
  calculatePaginationMetadata(totalItems, filters) {
    const limit = parseInt(filters.limit) || 100;
    const validLimit = Math.max(1, Math.min(1000, limit)); // Cap at 1000 items per page
    
    let page, offset, hasMore;
    
    // Support both page-based and offset-based pagination
    if (filters.offset !== undefined) {
      // Offset-based pagination
      offset = parseInt(filters.offset) || 0;
      page = Math.floor(offset / validLimit) + 1;
      hasMore = (offset + validLimit) < totalItems;
    } else {
      // Page-based pagination (default)
      page = parseInt(filters.page) || 1;
      const validPage = Math.max(1, page);
      offset = (validPage - 1) * validLimit;
      const totalPages = Math.ceil(totalItems / validLimit);
      hasMore = validPage < totalPages;
    }
    
    const totalPages = Math.ceil(totalItems / validLimit);
    const hasNext = hasMore;
    const hasPrev = page > 1;
    
    return {
      page: page,
      limit: validLimit,
      offset: offset,
      total: totalItems,
      totalPages: totalPages,
      hasNext: hasNext,
      hasPrev: hasPrev,
      hasMore: hasMore
    };
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
   * Calculate velocity trends from historical data
   */
  async calculateVelocityTrends(projectName = null, days = 30) {
    try {
      // Get historical commit data for velocity calculation
      const commitLogData = await this.getHistoricalCommitData(days);
      
      const trends = [];
      
      if (projectName) {
        // Calculate trend for specific project
        const projectTrend = await this.calculateProjectVelocityTrend(projectName, commitLogData);
        trends.push(projectTrend);
      } else {
        // Calculate trends for all projects
        const projectNames = Object.keys(commitLogData);
        
        for (const name of projectNames) {
          const projectTrend = await this.calculateProjectVelocityTrend(name, commitLogData);
          trends.push(projectTrend);
        }
      }

      return {
        trends: trends,
        overall: {
          trend: trends.length > 0 ? trends[0].trend : 'stable',
          velocity: trends.length > 0 ? trends.reduce((sum, p) => sum + p.velocity, 0) / trends.length : 0,
          change: trends.length > 0 ? trends.reduce((sum, p) => sum + p.change, 0) / trends.length : 0
        }
      };
    } catch (error) {
      console.error('❌ Error calculating velocity trends:', error);
      return {
        overall: { trend: 'unknown', velocity: 0, change: 0 },
        projects: []
      };
    }
  }

  /**
   * Get historical commit data for velocity calculation
   */
  async getHistoricalCommitData(days = 30) {
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

      // Process commit log data for velocity calculation
      const projectData = {};
      const today = new Date();
      const cutoffDate = new Date(today);
      cutoffDate.setDate(today.getDate() - days);

      commitLog
        .filter(day => new Date(day.date) >= cutoffDate)
        .forEach(day => {
          Object.entries(day.projects).forEach(([projectName, commitCount]) => {
            if (!projectData[projectName]) {
              projectData[projectName] = {
                dailyCommits: [],
                weeklyVelocity: [],
                monthlyVelocity: []
              };
            }
            projectData[projectName].dailyCommits.push({
              date: day.date,
              commits: commitCount
            });
          });
        });

      // Calculate weekly and monthly velocity for each project
      Object.keys(projectData).forEach(projectName => {
        const project = projectData[projectName];
        project.weeklyVelocity = this.calculateWeeklyVelocity(project.dailyCommits);
        project.monthlyVelocity = this.calculateMonthlyVelocity(project.dailyCommits);
      });

      return projectData;
    } catch (error) {
      console.error('❌ Error getting historical commit data:', error);
      return {};
    }
  }

  /**
   * Calculate velocity trend for a specific project
   */
  async calculateProjectVelocityTrend(projectName, commitLogData) {
    const projectData = commitLogData[projectName];
    
    if (!projectData || !projectData.weeklyVelocity || projectData.weeklyVelocity.length === 0) {
      return {
        projectName,
        velocity: 0,
        trend: 'unknown',
        change: 0
      };
    }

    const weeklyVelocity = projectData.weeklyVelocity;
    const currentVelocity = weeklyVelocity[weeklyVelocity.length - 1] || 0;
    const previousVelocity = weeklyVelocity[weeklyVelocity.length - 2] || 0;
    
    const change = previousVelocity > 0 ? 
      Math.round(((currentVelocity - previousVelocity) / previousVelocity) * 100) : 0;
    
    const trend = this.determineTrendFromChange(change);

    return {
      projectName,
      velocity: Math.round(currentVelocity * 10) / 10,
      trend,
      change
    };
  }

  /**
   * Calculate weekly velocity from daily commits
   */
  calculateWeeklyVelocity(dailyCommits) {
    const weeklyVelocity = [];
    const sortedCommits = dailyCommits.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    for (let i = 0; i < sortedCommits.length; i += 7) {
      const weekCommits = sortedCommits.slice(i, i + 7);
      const weekVelocity = weekCommits.reduce((sum, day) => sum + day.commits, 0);
      weeklyVelocity.push(weekVelocity);
    }
    
    return weeklyVelocity;
  }

  /**
   * Calculate monthly velocity from daily commits
   */
  calculateMonthlyVelocity(dailyCommits) {
    const monthlyVelocity = [];
    const sortedCommits = dailyCommits.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    for (let i = 0; i < sortedCommits.length; i += 30) {
      const monthCommits = sortedCommits.slice(i, i + 30);
      const monthVelocity = monthCommits.reduce((sum, day) => sum + day.commits, 0);
      monthlyVelocity.push(monthVelocity);
    }
    
    return monthlyVelocity;
  }

  /**
   * Determine trend from velocity change
   */
  determineTrendFromChange(change) {
    if (change > 10) return 'increasing';
    if (change < -10) return 'decreasing';
    return 'stable';
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
