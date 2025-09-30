/**
 * Data models for Epic 9: Projects and Progress View Redesign
 * Defines explicit data contracts and validation schemas
 */

/**
 * Project Health Status Enum
 */
const ProjectStatus = {
  ACTIVE: 'active',
  PLANNING: 'planning', 
  PAUSED: 'paused',
  COMPLETED: 'completed',
  UNKNOWN: 'unknown'
};

/**
 * PRD Status Enum
 */
const PrdStatus = {
  PRESENT: 'present',
  MISSING: 'missing',
  OUTDATED: 'outdated'
};

/**
 * Task List Status Enum
 */
const TaskListStatus = {
  PRESENT: 'present',
  MISSING: 'missing',
  OUTDATED: 'outdated'
};

/**
 * Project Health Model
 * Comprehensive health assessment for project management
 */
class ProjectHealthModel {
  constructor(data = {}) {
    this.status = data.status || ProjectStatus.UNKNOWN;
    this.healthScore = Math.max(0, Math.min(100, data.healthScore || 0));
    this.lastActivity = data.lastActivity ? new Date(data.lastActivity) : null;
    this.prdStatus = data.prdStatus || PrdStatus.MISSING;
    this.taskListStatus = data.taskListStatus || TaskListStatus.MISSING;
    this.completionVelocity = Math.max(0, data.completionVelocity || 0);
    this.riskFactors = Array.isArray(data.riskFactors) ? data.riskFactors : [];
    this.lastUpdated = new Date();
  }

  /**
   * Calculate overall health score based on various factors
   */
  calculateHealthScore() {
    let score = 0;
    let factors = 0;

    // Activity factor (40% weight)
    if (this.lastActivity) {
      const daysSinceActivity = Math.floor((Date.now() - this.lastActivity.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSinceActivity <= 7) {
        score += 40;
      } else if (daysSinceActivity <= 30) {
        score += 25;
      } else if (daysSinceActivity <= 90) {
        score += 10;
      }
    }
    factors += 40;

    // PRD status factor (25% weight)
    if (this.prdStatus === PrdStatus.PRESENT) {
      score += 25;
    } else if (this.prdStatus === PrdStatus.OUTDATED) {
      score += 15;
    }
    factors += 25;

    // Task list status factor (20% weight)
    if (this.taskListStatus === TaskListStatus.PRESENT) {
      score += 20;
    } else if (this.taskListStatus === TaskListStatus.OUTDATED) {
      score += 10;
    }
    factors += 20;

    // Completion velocity factor (15% weight)
    if (this.completionVelocity > 0) {
      score += Math.min(15, this.completionVelocity * 2);
    }
    factors += 15;

    this.healthScore = factors > 0 ? Math.round((score / factors) * 100) : 0;
    return this.healthScore;
  }

  /**
   * Identify risk factors based on current state
   */
  identifyRiskFactors() {
    const risks = [];

    if (!this.lastActivity || (Date.now() - this.lastActivity.getTime()) > (30 * 24 * 60 * 60 * 1000)) {
      risks.push('No recent activity');
    }

    if (this.prdStatus === PrdStatus.MISSING) {
      risks.push('Missing PRD');
    } else if (this.prdStatus === PrdStatus.OUTDATED) {
      risks.push('Outdated PRD');
    }

    if (this.taskListStatus === TaskListStatus.MISSING) {
      risks.push('Missing task list');
    } else if (this.taskListStatus === TaskListStatus.OUTDATED) {
      risks.push('Outdated task list');
    }

    if (this.completionVelocity === 0) {
      risks.push('No completion velocity');
    }

    if (this.healthScore < 30) {
      risks.push('Low health score');
    }

    this.riskFactors = risks;
    return risks;
  }

  /**
   * Get health status based on score
   */
  getHealthStatus() {
    if (this.healthScore >= 80) return 'excellent';
    if (this.healthScore >= 60) return 'good';
    if (this.healthScore >= 40) return 'fair';
    if (this.healthScore >= 20) return 'poor';
    return 'critical';
  }

  /**
   * Convert to plain object for API responses
   */
  toJSON() {
    return {
      status: this.status,
      healthScore: this.healthScore,
      lastActivity: this.lastActivity?.toISOString(),
      prdStatus: this.prdStatus,
      taskListStatus: this.taskListStatus,
      completionVelocity: this.completionVelocity,
      riskFactors: this.riskFactors,
      healthStatus: this.getHealthStatus(),
      lastUpdated: this.lastUpdated.toISOString()
    };
  }
}

/**
 * Project Overview Model
 * High-level project information for project management view
 */
class ProjectOverviewModel {
  constructor(data = {}) {
    this.name = data.name || '';
    this.repository = data.repository || data.name || '';
    this.status = data.status || ProjectStatus.UNKNOWN;
    this.category = data.category || 'Miscellaneous / Standalone';
    this.health = new ProjectHealthModel(data.health || {});
    this.progress = Math.max(0, Math.min(100, data.progress || 0));
    this.storiesTotal = Math.max(0, data.storiesTotal || 0);
    this.storiesCompleted = Math.max(0, data.storiesCompleted || 0);
    this.tasksTotal = Math.max(0, data.tasksTotal || 0);
    this.tasksCompleted = Math.max(0, data.tasksCompleted || 0);
    this.lastActivity = data.lastActivity ? new Date(data.lastActivity) : null;
    this.totalCommits = Math.max(0, data.totalCommits || 0);
    this.color = data.color || '#6B7280';
    this.hasPrd = Boolean(data.hasPrd);
    this.hasTaskList = Boolean(data.hasTaskList);
    this.lastUpdated = new Date();
  }

  /**
   * Calculate completion percentage
   */
  getCompletionPercentage() {
    if (this.storiesTotal === 0) return 0;
    return Math.round((this.storiesCompleted / this.storiesTotal) * 100);
  }

  /**
   * Get activity status
   */
  getActivityStatus() {
    if (!this.lastActivity) return 'inactive';
    
    const daysSinceActivity = Math.floor((Date.now() - this.lastActivity.getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceActivity <= 7) return 'recent';
    if (daysSinceActivity <= 30) return 'moderate';
    if (daysSinceActivity <= 90) return 'stale';
    return 'inactive';
  }

  /**
   * Convert to plain object for API responses
   */
  toJSON() {
    return {
      name: this.name,
      repository: this.repository,
      status: this.status,
      category: this.category,
      health: this.health.toJSON(),
      progress: this.progress,
      storiesTotal: this.storiesTotal,
      storiesCompleted: this.storiesCompleted,
      tasksTotal: this.tasksTotal,
      tasksCompleted: this.tasksCompleted,
      completionPercentage: this.getCompletionPercentage(),
      lastActivity: this.lastActivity?.toISOString(),
      activityStatus: this.getActivityStatus(),
      totalCommits: this.totalCommits,
      color: this.color,
      hasPrd: this.hasPrd,
      hasTaskList: this.hasTaskList,
      lastUpdated: this.lastUpdated.toISOString()
    };
  }
}

/**
 * Progress Analytics Model
 * Detailed progress tracking for progress view
 */
class ProgressAnalyticsModel {
  constructor(data = {}) {
    this.projectId = data.projectId || '';
    this.projectName = data.projectName || '';
    this.totalStories = Math.max(0, data.totalStories || 0);
    this.completedStories = Math.max(0, data.completedStories || 0);
    this.totalTasks = Math.max(0, data.totalTasks || 0);
    this.completedTasks = Math.max(0, data.completedTasks || 0);
    this.incompleteStories = Math.max(0, data.incompleteStories || 0);
    this.incompleteTasks = Math.max(0, data.incompleteTasks || 0);
    this.velocity = data.velocity || 0; // stories completed per week
    this.trend = data.trend || 'stable'; // 'increasing', 'decreasing', 'stable'
    this.blockedItems = Array.isArray(data.blockedItems) ? data.blockedItems : [];
    this.staleItems = Array.isArray(data.staleItems) ? data.staleItems : [];
    this.lastUpdated = new Date();
  }

  /**
   * Calculate story completion percentage
   */
  getStoryCompletionPercentage() {
    if (this.totalStories === 0) return 0;
    return Math.round((this.completedStories / this.totalStories) * 100);
  }

  /**
   * Calculate task completion percentage
   */
  getTaskCompletionPercentage() {
    if (this.totalTasks === 0) return 0;
    return Math.round((this.completedTasks / this.totalTasks) * 100);
  }

  /**
   * Calculate overall completion percentage
   */
  getOverallCompletionPercentage() {
    const totalItems = this.totalStories + this.totalTasks;
    const completedItems = this.completedStories + this.completedTasks;
    if (totalItems === 0) return 0;
    return Math.round((completedItems / totalItems) * 100);
  }

  /**
   * Identify blocked items (stories/tasks with no recent activity)
   */
  identifyBlockedItems() {
    // This would typically check for items with no updates in X days
    // For now, return empty array - implementation would depend on data source
    return [];
  }

  /**
   * Identify stale items (items that haven't been touched in a while)
   */
  identifyStaleItems() {
    // This would typically check for items with no updates in Y days
    // For now, return empty array - implementation would depend on data source
    return [];
  }

  /**
   * Convert to plain object for API responses
   */
  toJSON() {
    return {
      projectId: this.projectId,
      projectName: this.projectName,
      totalStories: this.totalStories,
      completedStories: this.completedStories,
      totalTasks: this.totalTasks,
      completedTasks: this.completedTasks,
      incompleteStories: this.incompleteStories,
      incompleteTasks: this.incompleteTasks,
      storyCompletionPercentage: this.getStoryCompletionPercentage(),
      taskCompletionPercentage: this.getTaskCompletionPercentage(),
      overallCompletionPercentage: this.getOverallCompletionPercentage(),
      velocity: this.velocity,
      trend: this.trend,
      blockedItems: this.blockedItems,
      staleItems: this.staleItems,
      lastUpdated: this.lastUpdated.toISOString()
    };
  }
}

/**
 * API Response Model
 * Standardized API response format
 */
class ApiResponseModel {
  constructor(success = true, data = null, error = null, metadata = {}) {
    this.success = success;
    this.data = data;
    this.error = error;
    this.metadata = {
      timestamp: new Date().toISOString(),
      ...metadata
    };
  }

  static success(data, metadata = {}) {
    return new ApiResponseModel(true, data, null, metadata);
  }

  static error(error, metadata = {}) {
    return new ApiResponseModel(false, null, error, metadata);
  }

  toJSON() {
    return {
      success: this.success,
      data: this.data,
      error: this.error,
      metadata: this.metadata
    };
  }
}

module.exports = {
  ProjectStatus,
  PrdStatus,
  TaskListStatus,
  ProjectHealthModel,
  ProjectOverviewModel,
  ProgressAnalyticsModel,
  ApiResponseModel
};
