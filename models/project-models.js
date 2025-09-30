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
    
    // Store GitHub data for health calculation
    this.githubCommits = data.githubCommits || 0;
    this.githubPRs = data.githubPRs || 0;
    this.githubIssues = data.githubIssues || 0;
  }

  /**
   * Calculate overall health score based on various factors
   */
  calculateHealthScore() {
    let score = 0;
    let factors = 0;
    this.healthFactors = {};

    // Activity factor (25% weight)
    const activityScore = this.calculateActivityScore();
    score += activityScore * 0.25;
    factors += 25;
    this.healthFactors.activity = activityScore;
    

    // Commit frequency factor (20% weight)
    const commitScore = this.calculateCommitScore();
    score += commitScore * 0.20;
    factors += 20;
    this.healthFactors.commits = commitScore;

    // PR activity factor (15% weight)
    const prScore = this.calculatePRScore();
    score += prScore * 0.15;
    factors += 15;
    this.healthFactors.prs = prScore;

    // Issue resolution factor (10% weight)
    const issueScore = this.calculateIssueScore();
    score += issueScore * 0.10;
    factors += 10;
    this.healthFactors.issues = issueScore;

    // Documentation factor (10% weight)
    const docScore = this.calculateDocumentationScore();
    score += docScore * 0.10;
    factors += 10;
    this.healthFactors.documentation = docScore;

    // PRD status factor (10% weight)
    const prdScore = this.calculatePRDScore();
    score += prdScore * 0.10;
    factors += 10;
    this.healthFactors.prd = prdScore;

    this.healthScore = factors > 0 ? Math.round((score / factors) * 100) : 0;
    return this.healthScore;
  }

  /**
   * Calculate activity score based on recent activity
   */
  calculateActivityScore() {
    if (!this.lastActivity) return 0;
    
    const daysSinceActivity = Math.floor((Date.now() - this.lastActivity.getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceActivity <= 7) return 100;
    if (daysSinceActivity <= 30) return 75;
    if (daysSinceActivity <= 90) return 50;
    if (daysSinceActivity <= 180) return 25;
    return 0;
  }

  /**
   * Calculate commit score based on commit frequency
   */
  calculateCommitScore() {
    // This would use real GitHub commit data
    const commitCount = this.githubCommits || 0;
    if (commitCount >= 50) return 100;
    if (commitCount >= 20) return 80;
    if (commitCount >= 10) return 60;
    if (commitCount >= 5) return 40;
    if (commitCount >= 1) return 20;
    return 0;
  }

  /**
   * Calculate PR score based on PR activity
   */
  calculatePRScore() {
    // This would use real GitHub PR data
    const prCount = this.githubPRs || 0;
    if (prCount >= 10) return 100;
    if (prCount >= 5) return 80;
    if (prCount >= 3) return 60;
    if (prCount >= 1) return 40;
    return 0;
  }

  /**
   * Calculate issue score based on issue resolution
   */
  calculateIssueScore() {
    // This would use real GitHub issue data
    const issueCount = this.githubIssues || 0;
    if (issueCount >= 5) return 100;
    if (issueCount >= 3) return 80;
    if (issueCount >= 1) return 60;
    return 0;
  }

  /**
   * Calculate documentation score
   */
  calculateDocumentationScore() {
    let score = 0;
    
    // PRD presence
    if (this.prdStatus === PrdStatus.PRESENT) score += 50;
    else if (this.prdStatus === PrdStatus.OUTDATED) score += 25;
    
    // Task list presence
    if (this.taskListStatus === TaskListStatus.PRESENT) score += 50;
    else if (this.taskListStatus === TaskListStatus.OUTDATED) score += 25;
    
    return score;
  }

  /**
   * Calculate PRD score
   */
  calculatePRDScore() {
    if (this.prdStatus === PrdStatus.PRESENT) return 100;
    if (this.prdStatus === PrdStatus.OUTDATED) return 60;
    return 0;
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
      healthFactors: this.healthFactors || {},
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
    // Recalculate health score to ensure health factors are computed
    this.health.calculateHealthScore();
    this.health.identifyRiskFactors();
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
    const blockedItems = [];
    const now = new Date();
    const staleThreshold = 14; // days
    
    // Check incomplete stories for blocking patterns
    for (let i = 0; i < this.incompleteStories; i++) {
      const storyId = `story-${this.projectId}-${i + 1}`;
      const lastActivity = this.getLastActivityForItem(storyId);
      const daysSinceActivity = lastActivity ? 
        Math.floor((now - lastActivity.getTime()) / (1000 * 60 * 60 * 24)) : 30;
      
      // Consider a story blocked if it hasn't been updated in 14+ days
      if (daysSinceActivity >= staleThreshold) {
        blockedItems.push({
          id: storyId,
          title: `Story ${i + 1}`,
          type: 'story',
          reason: 'No activity for 14+ days',
          lastActivity: lastActivity?.toISOString() || null,
          daysBlocked: daysSinceActivity,
          priority: this.calculateItemPriority(daysSinceActivity, 'story')
        });
      }
    }
    
    // Check incomplete tasks for blocking patterns
    for (let i = 0; i < this.incompleteTasks; i++) {
      const taskId = `task-${this.projectId}-${i + 1}`;
      const lastActivity = this.getLastActivityForItem(taskId);
      const daysSinceActivity = lastActivity ? 
        Math.floor((now - lastActivity.getTime()) / (1000 * 60 * 60 * 24)) : 30;
      
      // Consider a task blocked if it hasn't been updated in 14+ days
      if (daysSinceActivity >= staleThreshold) {
        blockedItems.push({
          id: taskId,
          title: `Task ${i + 1}`,
          type: 'task',
          reason: 'No activity for 14+ days',
          lastActivity: lastActivity?.toISOString() || null,
          daysBlocked: daysSinceActivity,
          priority: this.calculateItemPriority(daysSinceActivity, 'task')
        });
      }
    }
    
    return blockedItems.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Identify stale items (items that haven't been touched in a while)
   */
  identifyStaleItems() {
    const staleItems = [];
    const now = new Date();
    const staleThreshold = 7; // days
    
    // Check all work items for staleness
    const totalItems = this.incompleteStories + this.incompleteTasks;
    
    for (let i = 0; i < totalItems; i++) {
      const itemId = `item-${this.projectId}-${i + 1}`;
      const lastActivity = this.getLastActivityForItem(itemId);
      const daysSinceActivity = lastActivity ? 
        Math.floor((now - lastActivity.getTime()) / (1000 * 60 * 60 * 24)) : 30;
      
      // Consider an item stale if it hasn't been updated in 7+ days
      if (daysSinceActivity >= staleThreshold) {
        const isStory = i < this.incompleteStories;
        staleItems.push({
          id: itemId,
          title: `${isStory ? 'Story' : 'Task'} ${i + 1}`,
          type: isStory ? 'story' : 'task',
          reason: 'No activity for 7+ days',
          lastActivity: lastActivity?.toISOString() || null,
          daysStale: daysSinceActivity,
          priority: this.calculateItemPriority(daysSinceActivity, isStory ? 'story' : 'task')
        });
      }
    }
    
    return staleItems.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Get last activity for a work item (simulated)
   */
  getLastActivityForItem(itemId) {
    // In a real implementation, this would query the actual data source
    // For now, simulate based on project velocity and item age
    const now = new Date();
    const daysAgo = Math.floor(Math.random() * 30) + 1; // 1-30 days ago
    const lastActivity = new Date(now);
    lastActivity.setDate(now.getDate() - daysAgo);
    return lastActivity;
  }

  /**
   * Calculate priority for a work item based on staleness and type
   */
  calculateItemPriority(daysSinceActivity, type) {
    let priority = daysSinceActivity * 10; // Base priority on days
    
    // Stories are higher priority than tasks
    if (type === 'story') {
      priority += 50;
    }
    
    // Items in projects with low velocity are higher priority
    if (this.velocity < 5) {
      priority += 30;
    }
    
    return Math.max(0, priority);
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
