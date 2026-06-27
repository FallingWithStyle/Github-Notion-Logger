/**
 * Data Consistency Service for Epic 9
 * Handles reconciliation between multiple data sources (GitHub, Notion, commit logs)
 */

const fs = require('fs').promises;
const path = require('path');
const { ProjectHealthModel, ProjectOverviewModel, ProgressAnalyticsModel } = require('../models/project-models');

class DataConsistencyService {
  constructor() {
    this.inconsistencies = new Map();
    this.lastReconciliation = null;
  }

  /**
   * Reconcile project data from multiple sources
   * @param {string} projectName - Name of the project to reconcile
   * @param {Object} sources - Data from different sources
   * @returns {Object} Reconciled project data
   */
  async reconcileProjectData(projectName, sources = {}) {
    try {
      console.log(`🔄 Reconciling data for project: ${projectName}`);

      const {
        githubData = null,
        notionData = null,
        commitLogData = null,
        cachedData = null
      } = sources;

      // Start with cached data as baseline
      let reconciledData = cachedData ? { ...cachedData } : {};

      // Apply GitHub data (most authoritative for repository info)
      if (githubData) {
        reconciledData = this.mergeGitHubData(reconciledData, githubData);
      }

      // Apply Notion data (most authoritative for progress info)
      if (notionData) {
        reconciledData = this.mergeNotionData(reconciledData, notionData);
      }

      // Apply commit log data (most authoritative for activity info)
      if (commitLogData) {
        reconciledData = this.mergeCommitLogData(reconciledData, commitLogData);
      }

      // Validate and clean the reconciled data
      reconciledData = this.validateReconciledData(reconciledData, projectName);

      // Check for inconsistencies
      const inconsistencies = this.detectInconsistencies(reconciledData, sources);
      if (inconsistencies.length > 0) {
        this.inconsistencies.set(projectName, {
          timestamp: new Date(),
          inconsistencies,
          sources
        });
        console.warn(`⚠️ Found ${inconsistencies.length} inconsistencies for ${projectName}`);
      }

      this.lastReconciliation = new Date();
      return reconciledData;

    } catch (error) {
      console.error(`❌ Error reconciling data for ${projectName}:`, error);
      throw new Error(`Data reconciliation failed for ${projectName}: ${error.message}`);
    }
  }

  /**
   * Merge GitHub data into reconciled data
   */
  mergeGitHubData(reconciledData, githubData) {
    return {
      ...reconciledData,
      name: githubData.name || reconciledData.name,
      repository: githubData.name || reconciledData.repository,
      lastActivity: githubData.lastActivity || reconciledData.lastActivity,
      totalCommits: githubData.commits || reconciledData.totalCommits,
      hasPrd: githubData.hasPrd !== undefined ? githubData.hasPrd : reconciledData.hasPrd,
      hasTaskList: githubData.hasTaskList !== undefined ? githubData.hasTaskList : reconciledData.hasTaskList,
      // GitHub metrics for health calculation
      githubCommits: githubData.commits || 0,
      githubPRs: githubData.prs || 0,
      githubIssues: githubData.issues || 0,
      // GitHub data source
      _githubData: {
        lastUpdated: new Date(),
        source: 'github'
      }
    };
  }

  /**
   * Merge Notion data into reconciled data
   */
  mergeNotionData(reconciledData, notionData) {
    return {
      ...reconciledData,
      progress: notionData.progress !== undefined ? notionData.progress : reconciledData.progress,
      storiesTotal: notionData.storiesTotal || reconciledData.storiesTotal,
      storiesCompleted: notionData.storiesCompleted || reconciledData.storiesCompleted,
      tasksTotal: notionData.tasksTotal || reconciledData.tasksTotal,
      tasksCompleted: notionData.tasksCompleted || reconciledData.tasksCompleted,
      category: notionData.category || reconciledData.category,
      status: notionData.status || reconciledData.status,
      // Notion data source
      _notionData: {
        lastUpdated: new Date(),
        source: 'notion'
      }
    };
  }

  /**
   * Merge commit log data into reconciled data
   */
  mergeCommitLogData(reconciledData, commitLogData) {
    return {
      ...reconciledData,
      lastActivity: commitLogData.lastActivity || reconciledData.lastActivity,
      totalCommits: commitLogData.totalCommits || reconciledData.totalCommits,
      // Commit log data source
      _commitLogData: {
        lastUpdated: new Date(),
        source: 'commit-log'
      }
    };
  }

  /**
   * Validate reconciled data and apply business rules
   */
  validateReconciledData(data, projectName) {
    // Ensure required fields
    if (!data.name) {
      data.name = projectName;
    }
    if (!data.repository) {
      data.repository = projectName;
    }

    // Validate numeric fields
    data.progress = Math.max(0, Math.min(100, data.progress || 0));
    data.storiesTotal = Math.max(0, data.storiesTotal || 0);
    data.storiesCompleted = Math.max(0, Math.min(data.storiesTotal, data.storiesCompleted || 0));
    data.tasksTotal = Math.max(0, data.tasksTotal || 0);
    data.tasksCompleted = Math.max(0, Math.min(data.tasksTotal, data.tasksCompleted || 0));
    data.totalCommits = Math.max(0, data.totalCommits || 0);

    // Validate dates
    if (data.lastActivity && typeof data.lastActivity === 'string') {
      data.lastActivity = new Date(data.lastActivity);
    }

    // Ensure boolean fields
    data.hasPrd = Boolean(data.hasPrd);
    data.hasTaskList = Boolean(data.hasTaskList);

    // Set default category if missing
    if (!data.category) {
      data.category = 'Miscellaneous / Standalone';
    }

    // Set default status if missing
    if (!data.status) {
      data.status = 'unknown';
    }

    return data;
  }

  /**
   * Detect inconsistencies between data sources
   */
  detectInconsistencies(reconciledData, sources) {
    const inconsistencies = [];

    // Check progress consistency
    if (sources.notionData && sources.cachedData) {
      const notionProgress = sources.notionData.progress;
      const cachedProgress = sources.cachedData.progress;
      if (notionProgress !== undefined && cachedProgress !== undefined && 
          Math.abs(notionProgress - cachedProgress) > 5) {
        inconsistencies.push({
          type: 'progress_mismatch',
          field: 'progress',
          notion: notionProgress,
          cached: cachedProgress,
          reconciled: reconciledData.progress
        });
      }
    }

    // Check story count consistency
    if (sources.notionData && sources.cachedData) {
      const notionStories = sources.notionData.storiesTotal;
      const cachedStories = sources.cachedData.storiesTotal;
      if (notionStories !== undefined && cachedStories !== undefined && 
          notionStories !== cachedStories) {
        inconsistencies.push({
          type: 'story_count_mismatch',
          field: 'storiesTotal',
          notion: notionStories,
          cached: cachedStories,
          reconciled: reconciledData.storiesTotal
        });
      }
    }

    // Check activity consistency
    if (sources.githubData && sources.commitLogData) {
      const githubActivity = sources.githubData.updated_at;
      const commitActivity = sources.commitLogData.lastActivity;
      if (githubActivity && commitActivity) {
        const githubDate = new Date(githubActivity);
        const commitDate = new Date(commitActivity);
        const daysDiff = Math.abs(githubDate - commitDate) / (1000 * 60 * 60 * 24);
        if (daysDiff > 7) {
          inconsistencies.push({
            type: 'activity_mismatch',
            field: 'lastActivity',
            github: githubActivity,
            commitLog: commitActivity,
            reconciled: reconciledData.lastActivity
          });
        }
      }
    }

    return inconsistencies;
  }

  /**
   * Get inconsistencies for a specific project
   */
  getInconsistencies(projectName) {
    return this.inconsistencies.get(projectName) || null;
  }

  /**
   * Get all inconsistencies
   */
  getAllInconsistencies() {
    return Array.from(this.inconsistencies.entries()).map(([project, data]) => ({
      project,
      ...data
    }));
  }

  /**
   * Clear inconsistencies for a project
   */
  clearInconsistencies(projectName) {
    this.inconsistencies.delete(projectName);
  }

  /**
   * Get reconciliation status
   */
  getReconciliationStatus() {
    return {
      lastReconciliation: this.lastReconciliation,
      totalInconsistencies: this.inconsistencies.size,
      projectsWithInconsistencies: Array.from(this.inconsistencies.keys())
    };
  }

  /**
   * Create project health model from reconciled data
   */
  createProjectHealthModel(data) {
    const healthData = {
      status: data.status,
      lastActivity: data.lastActivity,
      prdStatus: data.hasPrd ? 'present' : 'missing',
      taskListStatus: data.hasTaskList ? 'present' : 'missing',
      completionVelocity: this.calculateCompletionVelocity(data),
      riskFactors: [],
      // Add GitHub data for health calculation
      githubCommits: data.githubCommits || 0,
      githubPRs: data.githubPRs || 0,
      githubIssues: data.githubIssues || 0
    };

    const healthModel = new ProjectHealthModel(healthData);
    healthModel.calculateHealthScore();
    healthModel.identifyRiskFactors();

    return healthModel;
  }

  /**
   * Calculate completion velocity (stories completed per week)
   */
  calculateCompletionVelocity(data) {
    // This is a simplified calculation
    // In a real implementation, you'd track velocity over time
    if (data.storiesTotal === 0) return 0;
    
    const completionRate = data.storiesCompleted / data.storiesTotal;
    // Assume 4 weeks average project duration
    return Math.round(completionRate * 4);
  }

  /**
   * Create project overview model from reconciled data
   */
  createProjectOverviewModel(data) {
    const healthModel = this.createProjectHealthModel(data);
    
    const overviewData = {
      ...data,
      health: {
        ...healthModel.toJSON(),
        // Include GitHub data so health factors are preserved
        githubCommits: data.githubCommits || 0,
        githubPRs: data.githubPRs || 0,
        githubIssues: data.githubIssues || 0
      }
    };

    return new ProjectOverviewModel(overviewData);
  }

  /**
   * Create progress analytics model from reconciled data
   */
  createProgressAnalyticsModel(data) {
    const analyticsData = {
      projectId: data.name,
      projectName: data.name,
      totalStories: data.storiesTotal,
      completedStories: data.storiesCompleted,
      totalTasks: data.tasksTotal,
      completedTasks: data.tasksCompleted,
      incompleteStories: Math.max(0, data.storiesTotal - data.storiesCompleted),
      incompleteTasks: Math.max(0, data.tasksTotal - data.tasksCompleted),
      velocity: this.calculateCompletionVelocity(data),
      trend: 'stable' // Would be calculated from historical data
    };

    const analyticsModel = new ProgressAnalyticsModel(analyticsData);
    analyticsModel.blockedItems = analyticsModel.identifyBlockedItems();
    analyticsModel.staleItems = analyticsModel.identifyStaleItems();

    return analyticsModel;
  }
}

module.exports = DataConsistencyService;
