/**
 * AI Context Service for Epic 10
 * Centralized AI context aggregation and management
 */

const ProjectManagementService = require('./project-management-service');
const ProgressTrackingService = require('./progress-tracking-service');
const DataConsistencyService = require('./data-consistency-service');
const PerformanceOptimizationService = require('./performance-optimization-service');
const ErrorHandlingService = require('./error-handling-service');

class AIContextService {
  constructor() {
    this.projectService = new ProjectManagementService();
    this.progressService = new ProgressTrackingService();
    this.consistencyService = new DataConsistencyService();
    this.performanceOptimizer = new PerformanceOptimizationService();
    this.errorHandler = new ErrorHandlingService();
    this.cache = new Map();
    this.contextTimeout = 2 * 60 * 1000; // 2 minutes
    this.maxContextSize = 10 * 1024 * 1024; // 10MB per context
  }

  /**
   * Get comprehensive project context for AI analysis
   * @param {string} projectName - Project identifier
   * @param {string} contextType - Type of context (general, planning, productivity, quality)
   * @returns {Promise<Object>} Formatted context data
   */
  async getProjectContext(projectName, contextType = 'general') {
    try {
      console.log(`🤖 Getting AI context for project: ${projectName}, type: ${contextType}`);

      const cacheKey = `project:${projectName}:${contextType}`;
      const cached = this.getCachedContext(cacheKey);
      if (cached) {
        console.log('📈 Returning cached project context');
        return cached;
      }

      // Get project data from multiple sources in parallel
      const [projectOverview, progressAnalytics, healthData] = await Promise.allSettled([
        this.projectService.getProjectOverview({ search: projectName, limit: 1 }),
        this.progressService.getProgressAnalytics({ search: projectName, limit: 1 }),
        this.projectService.getProjectHealth(projectName)
      ]);

      // Extract successful data
      const projectData = projectOverview.status === 'fulfilled' ? projectOverview.value.data?.[0] : null;
      const progressData = progressAnalytics.status === 'fulfilled' ? progressAnalytics.value.data?.projects?.[0] : null;
      const healthDataResult = healthData.status === 'fulfilled' ? healthData.value.data : null;

      if (!projectData) {
        throw new Error(`Project ${projectName} not found or no data available`);
      }

      // Format context based on type
      const context = this.formatProjectContext(projectData, progressData, healthDataResult, contextType);
      
      // Validate context size
      this.validateContextSize(context);
      
      // Cache the context
      this.setCachedContext(cacheKey, context);

      return context;

    } catch (error) {
      console.error(`❌ Error getting project context for ${projectName}:`, error);
      return this.createFallbackContext(projectName, contextType, error.message);
    }
  }

  /**
   * Get portfolio-wide context for comparative analysis
   * @param {Object} filters - Filter criteria
   * @returns {Promise<Object>} Portfolio context data
   */
  async getPortfolioContext(filters = {}) {
    try {
      console.log('🤖 Getting portfolio context...', filters);

      const cacheKey = `portfolio:${JSON.stringify(filters)}`;
      const cached = this.getCachedContext(cacheKey);
      if (cached) {
        console.log('📈 Returning cached portfolio context');
        return cached;
      }

      // Get portfolio data in parallel
      const [projectOverview, progressAnalytics] = await Promise.allSettled([
        this.projectService.getProjectOverview(filters),
        this.progressService.getProgressAnalytics(filters)
      ]);

      const projects = projectOverview.status === 'fulfilled' ? projectOverview.value.data : [];
      const progressData = progressAnalytics.status === 'fulfilled' ? progressAnalytics.value.data : { projects: [], aggregate: {} };

      // Format portfolio context
      const context = this.formatPortfolioContext(projects, progressData, filters);
      
      // Validate context size
      this.validateContextSize(context);
      
      // Cache the context
      this.setCachedContext(cacheKey, context);

      return context;

    } catch (error) {
      console.error('❌ Error getting portfolio context:', error);
      return this.createFallbackPortfolioContext(filters, error.message);
    }
  }

  /**
   * Get quick wins analysis context
   * @param {Object} filters - Filter criteria
   * @returns {Promise<Object>} Quick wins context
   */
  async getQuickWinsContext(filters = {}) {
    try {
      console.log('🤖 Getting quick wins context...', filters);

      const cacheKey = `quickwins:${JSON.stringify(filters)}`;
      const cached = this.getCachedContext(cacheKey);
      if (cached) {
        console.log('📈 Returning cached quick wins context');
        return cached;
      }

      // Get progress data focused on incomplete work
      const progressData = await this.progressService.getProgressAnalytics({
        ...filters,
        includeIncomplete: true
      });

      if (!progressData.success || !progressData.data?.projects) {
        throw new Error('No progress data available for quick wins analysis');
      }

      // Analyze for quick wins
      const quickWins = this.analyzeQuickWins(progressData.data.projects);
      
      const context = {
        type: 'quickWins',
        timestamp: new Date().toISOString(),
        analysis: {
          quickWins: quickWins,
          totalProjects: progressData.data.projects.length,
          totalIncompleteStories: progressData.data.aggregate?.incompleteStories || 0,
          totalIncompleteTasks: progressData.data.aggregate?.incompleteTasks || 0
        },
        filters: filters
      };

      // Cache the context
      this.setCachedContext(cacheKey, context);

      return context;

    } catch (error) {
      console.error('❌ Error getting quick wins context:', error);
      return this.createFallbackQuickWinsContext(filters, error.message);
    }
  }

  /**
   * Get focus areas analysis context
   * @param {Object} filters - Filter criteria
   * @returns {Promise<Object>} Focus areas context
   */
  async getFocusAreasContext(filters = {}) {
    try {
      console.log('🤖 Getting focus areas context...', filters);

      const cacheKey = `focusareas:${JSON.stringify(filters)}`;
      const cached = this.getCachedContext(cacheKey);
      if (cached) {
        console.log('📈 Returning cached focus areas context');
        return cached;
      }

      // Get project and progress data
      const [projectData, progressData] = await Promise.allSettled([
        this.projectService.getProjectOverview(filters),
        this.progressService.getProgressAnalytics(filters)
      ]);

      const projects = projectData.status === 'fulfilled' ? projectData.value.data : [];
      const progress = progressData.status === 'fulfilled' ? progressData.value.data : { projects: [] };

      // Analyze focus areas
      const focusAreas = this.analyzeFocusAreas(projects, progress.projects);
      
      const context = {
        type: 'focusAreas',
        timestamp: new Date().toISOString(),
        analysis: {
          focusAreas: focusAreas,
          totalProjects: projects.length,
          healthDistribution: this.calculateHealthDistribution(projects)
        },
        filters: filters
      };

      // Cache the context
      this.setCachedContext(cacheKey, context);

      return context;

    } catch (error) {
      console.error('❌ Error getting focus areas context:', error);
      return this.createFallbackFocusAreasContext(filters, error.message);
    }
  }

  /**
   * Format project context for AI consumption
   * @param {Object} projectData - Project overview data
   * @param {Object} progressData - Progress analytics data
   * @param {Object} healthData - Health data
   * @param {string} contextType - Type of context
   * @returns {Object} Formatted context
   */
  formatProjectContext(projectData, progressData, healthData, contextType) {
    const baseContext = {
      type: 'project',
      contextType: contextType,
      timestamp: new Date().toISOString(),
      project: {
        name: projectData.name,
        repository: projectData.repository,
        status: projectData.status,
        category: projectData.category,
        healthScore: projectData.health?.healthScore || 0,
        lastActivity: projectData.lastActivity,
        completionPercentage: projectData.completionPercentage || 0
      },
      activity: {
        totalCommits: projectData.totalCommits || 0,
        activityStatus: projectData.activityStatus || 'unknown',
        lastActivity: projectData.lastActivity
      },
      progress: {
        storiesCompleted: projectData.storiesCompleted || 0,
        storiesTotal: projectData.storiesTotal || 0,
        tasksCompleted: projectData.tasksCompleted || 0,
        tasksTotal: projectData.tasksTotal || 0,
        completionPercentage: projectData.completionPercentage || 0
      },
      health: {
        status: projectData.health?.status || 'unknown',
        healthScore: projectData.health?.healthScore || 0,
        riskFactors: projectData.health?.riskFactors || [],
        lastUpdated: projectData.health?.lastUpdated
      }
    };

    // Add context-specific data
    switch (contextType) {
      case 'planning':
        baseContext.planning = {
          prdStatus: projectData.hasPrd ? 'present' : 'missing',
          taskListStatus: projectData.hasTaskList ? 'present' : 'missing',
          weeklyGoals: [], // Would come from weekly planning data
          blockers: projectData.health?.riskFactors || []
        };
        break;
      
      case 'productivity':
        baseContext.productivity = {
          velocity: progressData?.velocity || 0,
          trend: progressData?.trend || 'stable',
          recentActivity: this.calculateRecentActivity(projectData),
          efficiency: this.calculateEfficiency(projectData, progressData)
        };
        break;
      
      case 'quality':
        baseContext.quality = {
          codeQuality: this.assessCodeQuality(projectData),
          documentation: {
            prdPresent: projectData.hasPrd,
            taskListPresent: projectData.hasTaskList
          },
          maintenance: this.assessMaintenance(projectData)
        };
        break;
    }

    return baseContext;
  }

  /**
   * Format portfolio context for AI consumption
   * @param {Array} projects - Array of project data
   * @param {Object} progressData - Progress analytics data
   * @param {Object} filters - Applied filters
   * @returns {Object} Formatted portfolio context
   */
  formatPortfolioContext(projects, progressData, filters) {
    return {
      type: 'portfolio',
      timestamp: new Date().toISOString(),
      summary: {
        totalProjects: projects.length,
        activeProjects: projects.filter(p => p.status === 'active').length,
        averageHealthScore: this.calculateAverageHealthScore(projects),
        totalCompletion: this.calculateTotalCompletion(projects)
      },
      projects: projects.map(project => ({
        name: project.name,
        status: project.status,
        healthScore: project.health?.healthScore || 0,
        completionPercentage: project.completionPercentage || 0,
        lastActivity: project.lastActivity,
        category: project.category
      })),
      aggregate: progressData.aggregate || {},
      filters: filters
    };
  }

  /**
   * Analyze projects for quick wins
   * @param {Array} projects - Array of project data
   * @returns {Array} Quick wins analysis
   */
  analyzeQuickWins(projects) {
    return projects
      .filter(project => project.incompleteStories > 0 || project.incompleteTasks > 0)
      .map(project => {
        const completionRate = project.overallCompletionPercentage || 0;
        const remainingWork = (project.incompleteStories || 0) + (project.incompleteTasks || 0);
        const velocity = project.velocity || 0;
        
        // Calculate quick win score (higher is better)
        const quickWinScore = this.calculateQuickWinScore(completionRate, remainingWork, velocity);
        
        return {
          project: project.projectName,
          title: `Complete ${project.projectName} remaining work`,
          completionRate: completionRate,
          remainingWork: remainingWork,
          velocity: velocity,
          quickWinScore: quickWinScore,
          estimatedEffort: this.estimateEffort(remainingWork, velocity),
          impact: this.assessImpact(completionRate, project.healthScore || 0)
        };
      })
      .sort((a, b) => b.quickWinScore - a.quickWinScore)
      .slice(0, 10); // Top 10 quick wins
  }

  /**
   * Analyze focus areas for project portfolio
   * @param {Array} projects - Array of project data
   * @param {Array} progressData - Array of progress data
   * @returns {Array} Focus areas analysis
   */
  analyzeFocusAreas(projects, progressData) {
    const focusAreas = [];

    // Analyze by health score
    const lowHealthProjects = projects.filter(p => (p.health?.healthScore || 0) < 50);
    if (lowHealthProjects.length > 0) {
      focusAreas.push({
        type: 'health',
        priority: 'high',
        title: 'Low Health Projects',
        projects: lowHealthProjects.map(p => p.name),
        reasoning: `${lowHealthProjects.length} projects have health scores below 50`,
        recommendations: ['Review project status', 'Address risk factors', 'Reallocate resources']
      });
    }

    // Analyze by activity
    const staleProjects = projects.filter(p => p.activityStatus === 'stale' || p.activityStatus === 'inactive');
    if (staleProjects.length > 0) {
      focusAreas.push({
        type: 'activity',
        priority: 'medium',
        title: 'Inactive Projects',
        projects: staleProjects.map(p => p.name),
        reasoning: `${staleProjects.length} projects show no recent activity`,
        recommendations: ['Review project viability', 'Consider pausing or closing', 'Reassign resources']
      });
    }

    // Analyze by completion
    const highCompletionProjects = projects.filter(p => (p.completionPercentage || 0) > 80);
    if (highCompletionProjects.length > 0) {
      focusAreas.push({
        type: 'completion',
        priority: 'high',
        title: 'Near Completion Projects',
        projects: highCompletionProjects.map(p => p.name),
        reasoning: `${highCompletionProjects.length} projects are 80%+ complete`,
        recommendations: ['Focus on finishing touches', 'Plan next phase', 'Celebrate progress']
      });
    }

    return focusAreas.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * Calculate quick win score
   * @param {number} completionRate - Project completion rate
   * @param {number} remainingWork - Remaining work items
   * @param {number} velocity - Project velocity
   * @returns {number} Quick win score (0-100)
   */
  calculateQuickWinScore(completionRate, remainingWork, velocity) {
    // Higher completion rate = better quick win
    const completionScore = Math.min(completionRate, 90) * 0.4; // Cap at 90% for scoring
    
    // Lower remaining work = better quick win
    const workScore = Math.max(0, 100 - (remainingWork * 2)) * 0.3;
    
    // Higher velocity = better quick win
    const velocityScore = Math.min(velocity * 20, 100) * 0.3;
    
    return Math.round(completionScore + workScore + velocityScore);
  }

  /**
   * Calculate average health score across projects
   * @param {Array} projects - Array of project data
   * @returns {number} Average health score
   */
  calculateAverageHealthScore(projects) {
    if (projects.length === 0) return 0;
    const totalScore = projects.reduce((sum, project) => sum + (project.health?.healthScore || 0), 0);
    return Math.round(totalScore / projects.length);
  }

  /**
   * Calculate total completion across projects
   * @param {Array} projects - Array of project data
   * @returns {number} Total completion percentage
   */
  calculateTotalCompletion(projects) {
    if (projects.length === 0) return 0;
    const totalCompletion = projects.reduce((sum, project) => sum + (project.completionPercentage || 0), 0);
    return Math.round(totalCompletion / projects.length);
  }

  /**
   * Calculate health distribution across projects
   * @param {Array} projects - Array of project data
   * @returns {Object} Health distribution
   */
  calculateHealthDistribution(projects) {
    const distribution = {
      excellent: 0, // 80-100
      good: 0,      // 60-79
      fair: 0,      // 40-59
      poor: 0,      // 20-39
      critical: 0   // 0-19
    };

    projects.forEach(project => {
      const score = project.health?.healthScore || 0;
      if (score >= 80) distribution.excellent++;
      else if (score >= 60) distribution.good++;
      else if (score >= 40) distribution.fair++;
      else if (score >= 20) distribution.poor++;
      else distribution.critical++;
    });

    return distribution;
  }

  /**
   * Calculate recent activity score
   * @param {Object} projectData - Project data
   * @returns {Object} Recent activity analysis
   */
  calculateRecentActivity(projectData) {
    const lastActivity = new Date(projectData.lastActivity);
    const now = new Date();
    const daysSinceActivity = Math.floor((now - lastActivity) / (1000 * 60 * 60 * 24));
    
    return {
      daysSinceActivity,
      activityLevel: daysSinceActivity <= 1 ? 'high' : daysSinceActivity <= 7 ? 'medium' : 'low',
      totalCommits: projectData.totalCommits || 0
    };
  }

  /**
   * Calculate project efficiency
   * @param {Object} projectData - Project data
   * @param {Object} progressData - Progress data
   * @returns {Object} Efficiency metrics
   */
  calculateEfficiency(projectData, progressData) {
    const completionRate = projectData.completionPercentage || 0;
    const velocity = progressData?.velocity || 0;
    const timeToComplete = velocity > 0 ? (100 - completionRate) / velocity : 0;
    
    return {
      completionRate,
      velocity,
      estimatedTimeToComplete: Math.round(timeToComplete),
      efficiency: Math.min(completionRate / Math.max(timeToComplete, 1), 100)
    };
  }

  /**
   * Assess code quality indicators
   * @param {Object} projectData - Project data
   * @returns {Object} Code quality assessment
   */
  assessCodeQuality(projectData) {
    return {
      commitFrequency: this.calculateCommitFrequency(projectData),
      documentation: {
        prdPresent: projectData.hasPrd,
        taskListPresent: projectData.hasTaskList
      },
      activity: projectData.activityStatus
    };
  }

  /**
   * Assess maintenance indicators
   * @param {Object} projectData - Project data
   * @returns {Object} Maintenance assessment
   */
  assessMaintenance(projectData) {
    return {
      lastActivity: projectData.lastActivity,
      activityStatus: projectData.activityStatus,
      healthScore: projectData.health?.healthScore || 0,
      riskFactors: projectData.health?.riskFactors || []
    };
  }

  /**
   * Calculate commit frequency
   * @param {Object} projectData - Project data
   * @returns {string} Commit frequency level
   */
  calculateCommitFrequency(projectData) {
    const totalCommits = projectData.totalCommits || 0;
    const lastActivity = new Date(projectData.lastActivity);
    const now = new Date();
    const daysSinceActivity = Math.floor((now - lastActivity) / (1000 * 60 * 60 * 24));
    
    if (daysSinceActivity === 0) return 'daily';
    if (daysSinceActivity <= 7) return 'weekly';
    if (daysSinceActivity <= 30) return 'monthly';
    return 'rare';
  }

  /**
   * Estimate effort for remaining work
   * @param {number} remainingWork - Number of remaining work items
   * @param {number} velocity - Project velocity
   * @returns {string} Estimated effort
   */
  estimateEffort(remainingWork, velocity) {
    if (velocity === 0) return 'unknown';
    const days = Math.ceil(remainingWork / velocity);
    if (days <= 1) return '1 day';
    if (days <= 3) return '2-3 days';
    if (days <= 7) return '1 week';
    if (days <= 14) return '1-2 weeks';
    return '2+ weeks';
  }

  /**
   * Assess impact of completing work
   * @param {number} completionRate - Current completion rate
   * @param {number} healthScore - Project health score
   * @returns {string} Impact level
   */
  assessImpact(completionRate, healthScore) {
    if (completionRate >= 90) return 'high - near completion';
    if (completionRate >= 70) return 'medium - significant progress';
    if (healthScore >= 70) return 'medium - healthy project';
    return 'low - early stage or struggling';
  }

  /**
   * Get cached context
   * @param {string} key - Cache key
   * @returns {Object|null} Cached context or null
   */
  getCachedContext(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.contextTimeout) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  /**
   * Set cached context
   * @param {string} key - Cache key
   * @param {Object} data - Context data
   */
  setCachedContext(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Validate context size
   * @param {Object} context - Context object
   */
  validateContextSize(context) {
    const size = JSON.stringify(context).length;
    if (size > this.maxContextSize) {
      console.warn(`⚠️ Context size ${size} exceeds limit ${this.maxContextSize}`);
      // Could implement context compression here
    }
  }

  /**
   * Create fallback context when data is unavailable
   * @param {string} projectName - Project name
   * @param {string} contextType - Context type
   * @param {string} error - Error message
   * @returns {Object} Fallback context
   */
  createFallbackContext(projectName, contextType, error) {
    return {
      type: 'project',
      contextType: contextType,
      timestamp: new Date().toISOString(),
      project: {
        name: projectName,
        status: 'unknown',
        healthScore: 0,
        completionPercentage: 0
      },
      error: {
        message: error,
        fallback: true
      },
      recommendations: [
        'Check project data availability',
        'Verify service connections',
        'Try again in a few minutes'
      ]
    };
  }

  /**
   * Create fallback portfolio context
   * @param {Object} filters - Applied filters
   * @param {string} error - Error message
   * @returns {Object} Fallback portfolio context
   */
  createFallbackPortfolioContext(filters, error) {
    return {
      type: 'portfolio',
      timestamp: new Date().toISOString(),
      summary: {
        totalProjects: 0,
        activeProjects: 0,
        averageHealthScore: 0,
        totalCompletion: 0
      },
      projects: [],
      error: {
        message: error,
        fallback: true
      },
      recommendations: [
        'Check data service availability',
        'Verify project data sources',
        'Try with different filters'
      ]
    };
  }

  /**
   * Create fallback quick wins context
   * @param {Object} filters - Applied filters
   * @param {string} error - Error message
   * @returns {Object} Fallback quick wins context
   */
  createFallbackQuickWinsContext(filters, error) {
    return {
      type: 'quickWins',
      timestamp: new Date().toISOString(),
      analysis: {
        quickWins: [],
        totalProjects: 0,
        totalIncompleteStories: 0,
        totalIncompleteTasks: 0
      },
      error: {
        message: error,
        fallback: true
      },
      recommendations: [
        'Check progress data availability',
        'Verify project status',
        'Try refreshing the data'
      ]
    };
  }

  /**
   * Create fallback focus areas context
   * @param {Object} filters - Applied filters
   * @param {string} error - Error message
   * @returns {Object} Fallback focus areas context
   */
  createFallbackFocusAreasContext(filters, error) {
    return {
      type: 'focusAreas',
      timestamp: new Date().toISOString(),
      analysis: {
        focusAreas: [],
        totalProjects: 0,
        healthDistribution: {
          excellent: 0,
          good: 0,
          fair: 0,
          poor: 0,
          critical: 0
        }
      },
      error: {
        message: error,
        fallback: true
      },
      recommendations: [
        'Check project data availability',
        'Verify health score calculations',
        'Try with different project filters'
      ]
    };
  }

  /**
   * Clear expired cache entries
   */
  clearExpiredCache() {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.contextTimeout) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      maxSize: 1000, // Could be configurable
      hitRate: 0, // Would need to track hits/misses
      memoryUsage: JSON.stringify([...this.cache.values()]).length
    };
  }
}

module.exports = AIContextService;
