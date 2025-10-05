/**
 * Test Suite for Project Models - Epic 9 (Jest Version)
 * Tests data models, validation, and business logic
 */

const {
  ProjectStatus,
  PrdStatus,
  TaskListStatus,
  ProjectHealthModel,
  ProjectOverviewModel,
  ProgressAnalyticsModel,
  ApiResponseModel
} = require('./models/project-models');

describe('Project Models', () => {
  describe('ProjectHealthModel', () => {
    it('should create health model with default values', () => {
      const health = new ProjectHealthModel();
      
      expect(health.status).toBe(ProjectStatus.UNKNOWN);
      expect(health.healthScore).toBe(0);
      expect(health.lastActivity).toBeNull();
      expect(health.prdStatus).toBe(PrdStatus.MISSING);
      expect(health.taskListStatus).toBe(TaskListStatus.MISSING);
      expect(health.completionVelocity).toBe(0);
      expect(Array.isArray(health.riskFactors)).toBe(true);
    });

    it('should create health model with provided data', () => {
      const data = {
        status: ProjectStatus.ACTIVE,
        healthScore: 85,
        lastActivity: '2024-01-15T10:30:00Z',
        prdStatus: PrdStatus.PRESENT,
        taskListStatus: TaskListStatus.PRESENT,
        completionVelocity: 2.5,
        riskFactors: ['No recent activity']
      };

      const health = new ProjectHealthModel(data);
      
      expect(health.status).toBe(ProjectStatus.ACTIVE);
      expect(health.healthScore).toBe(85);
      expect(health.lastActivity).toBeInstanceOf(Date);
      expect(health.prdStatus).toBe(PrdStatus.PRESENT);
      expect(health.taskListStatus).toBe(TaskListStatus.PRESENT);
      expect(health.completionVelocity).toBe(2.5);
      expect(Array.isArray(health.riskFactors)).toBe(true);
    });

    it('should clamp health score to valid range', () => {
      const health1 = new ProjectHealthModel({ healthScore: 150 });
      const health2 = new ProjectHealthModel({ healthScore: -50 });
      
      expect(health1.healthScore).toBe(100);
      expect(health2.healthScore).toBe(0);
    });

    it('should calculate health score correctly', () => {
      const health = new ProjectHealthModel({
        lastActivity: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
        prdStatus: PrdStatus.PRESENT,
        taskListStatus: TaskListStatus.PRESENT,
        completionVelocity: 2.0
      });

      const score = health.calculateHealthScore();
      
      expect(typeof score).toBe('number');
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
      expect(score).toBeGreaterThan(0);
    });

    it('should identify risk factors correctly', () => {
      const health = new ProjectHealthModel({
        lastActivity: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // 60 days ago
        prdStatus: PrdStatus.MISSING,
        taskListStatus: TaskListStatus.OUTDATED,
        completionVelocity: 0,
        healthScore: 20
      });

      const risks = health.identifyRiskFactors();
      
      expect(Array.isArray(risks)).toBe(true);
      expect(risks.length).toBeGreaterThan(0);
      expect(risks).toContain('No recent activity');
      expect(risks).toContain('Missing PRD');
      expect(risks).toContain('Outdated task list');
      expect(risks).toContain('No completion velocity');
      expect(risks).toContain('Low health score');
    });

    it('should get correct health status', () => {
      const excellent = new ProjectHealthModel({ healthScore: 90 });
      const good = new ProjectHealthModel({ healthScore: 70 });
      const fair = new ProjectHealthModel({ healthScore: 50 });
      const poor = new ProjectHealthModel({ healthScore: 30 });
      const critical = new ProjectHealthModel({ healthScore: 10 });

      expect(excellent.getHealthStatus()).toBe('excellent');
      expect(good.getHealthStatus()).toBe('good');
      expect(fair.getHealthStatus()).toBe('fair');
      expect(poor.getHealthStatus()).toBe('poor');
      expect(critical.getHealthStatus()).toBe('critical');
    });
  });

  describe('ProjectOverviewModel', () => {
    it('should create overview model with default values', () => {
      const overview = new ProjectOverviewModel();
      
      expect(overview.name).toBe('');
      expect(overview.repository).toBe('');
      expect(overview.status).toBe(ProjectStatus.UNKNOWN);
      expect(overview.category).toBe('Miscellaneous / Standalone');
      expect(overview.health).toBeInstanceOf(ProjectHealthModel);
      expect(overview.progress).toBe(0);
      expect(overview.storiesTotal).toBe(0);
      expect(overview.storiesCompleted).toBe(0);
      expect(overview.tasksTotal).toBe(0);
      expect(overview.tasksCompleted).toBe(0);
      expect(overview.lastActivity).toBeNull();
      expect(overview.totalCommits).toBe(0);
      expect(overview.color).toBe('#6B7280');
      expect(overview.hasPrd).toBe(false);
      expect(overview.hasTaskList).toBe(false);
    });

    it('should calculate completion percentage correctly', () => {
      const overview1 = new ProjectOverviewModel({
        storiesTotal: 20,
        storiesCompleted: 15
      });

      const overview2 = new ProjectOverviewModel({
        storiesTotal: 0,
        storiesCompleted: 0
      });

      expect(overview1.getCompletionPercentage()).toBe(75);
      expect(overview2.getCompletionPercentage()).toBe(0);
    });

    it('should get correct activity status', () => {
      const now = new Date();
      const recent = new ProjectOverviewModel({
        lastActivity: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000) // 3 days ago
      });
      const moderate = new ProjectOverviewModel({
        lastActivity: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000) // 20 days ago
      });
      const stale = new ProjectOverviewModel({
        lastActivity: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000) // 60 days ago
      });
      const inactive = new ProjectOverviewModel({
        lastActivity: new Date(now.getTime() - 120 * 24 * 60 * 60 * 1000) // 120 days ago
      });
      const noActivity = new ProjectOverviewModel({
        lastActivity: null
      });

      expect(recent.getActivityStatus()).toBe('recent');
      expect(moderate.getActivityStatus()).toBe('moderate');
      expect(stale.getActivityStatus()).toBe('stale');
      expect(inactive.getActivityStatus()).toBe('inactive');
      expect(noActivity.getActivityStatus()).toBe('inactive');
    });
  });

  describe('ProgressAnalyticsModel', () => {
    it('should create analytics model with default values', () => {
      const analytics = new ProgressAnalyticsModel();
      
      expect(analytics.projectId).toBe('');
      expect(analytics.projectName).toBe('');
      expect(analytics.totalStories).toBe(0);
      expect(analytics.completedStories).toBe(0);
      expect(analytics.totalTasks).toBe(0);
      expect(analytics.completedTasks).toBe(0);
      expect(analytics.incompleteStories).toBe(0);
      expect(analytics.incompleteTasks).toBe(0);
      expect(analytics.velocity).toBe(0);
      expect(analytics.trend).toBe('stable');
      expect(Array.isArray(analytics.blockedItems)).toBe(true);
      expect(Array.isArray(analytics.staleItems)).toBe(true);
    });

    it('should calculate story completion percentage correctly', () => {
      const analytics1 = new ProgressAnalyticsModel({
        totalStories: 20,
        completedStories: 15
      });

      const analytics2 = new ProgressAnalyticsModel({
        totalStories: 0,
        completedStories: 0
      });

      expect(analytics1.getStoryCompletionPercentage()).toBe(75);
      expect(analytics2.getStoryCompletionPercentage()).toBe(0);
    });

    it('should calculate task completion percentage correctly', () => {
      const analytics1 = new ProgressAnalyticsModel({
        totalTasks: 50,
        completedTasks: 40
      });

      const analytics2 = new ProgressAnalyticsModel({
        totalTasks: 0,
        completedTasks: 0
      });

      expect(analytics1.getTaskCompletionPercentage()).toBe(80);
      expect(analytics2.getTaskCompletionPercentage()).toBe(0);
    });

    it('should calculate overall completion percentage correctly', () => {
      const analytics1 = new ProgressAnalyticsModel({
        totalStories: 20,
        completedStories: 15,
        totalTasks: 50,
        completedTasks: 40
      });

      const analytics2 = new ProgressAnalyticsModel({
        totalStories: 0,
        completedStories: 0,
        totalTasks: 0,
        completedTasks: 0
      });

      expect(analytics1.getOverallCompletionPercentage()).toBe(79);
      expect(analytics2.getOverallCompletionPercentage()).toBe(0);
    });
  });

  describe('ApiResponseModel', () => {
    it('should create success response', () => {
      const data = { test: 'data' };
      const metadata = { timestamp: '2024-01-15T10:30:00Z' };
      const response = ApiResponseModel.success(data, metadata);
      
      expect(response.success).toBe(true);
      expect(response.data).toBe(data);
      expect(response.error).toBeNull();
      expect(response.metadata.timestamp).toBe('2024-01-15T10:30:00Z');
    });

    it('should create error response', () => {
      const error = 'Test error message';
      const metadata = { errorType: 'validation' };
      const response = ApiResponseModel.error(error, metadata);
      
      expect(response.success).toBe(false);
      expect(response.data).toBeNull();
      expect(response.error).toBe(error);
      expect(response.metadata.errorType).toBe('validation');
    });

    it('should create response with default values', () => {
      const response = new ApiResponseModel();
      
      expect(response.success).toBe(true);
      expect(response.data).toBeNull();
      expect(response.error).toBeNull();
      expect(typeof response.metadata).toBe('object');
      expect(typeof response.metadata.timestamp).toBe('string');
    });
  });

  describe('Enums', () => {
    it('should have correct project status values', () => {
      expect(ProjectStatus.ACTIVE).toBe('active');
      expect(ProjectStatus.PLANNING).toBe('planning');
      expect(ProjectStatus.PAUSED).toBe('paused');
      expect(ProjectStatus.COMPLETED).toBe('completed');
      expect(ProjectStatus.UNKNOWN).toBe('unknown');
    });

    it('should have correct PRD status values', () => {
      expect(PrdStatus.PRESENT).toBe('present');
      expect(PrdStatus.MISSING).toBe('missing');
      expect(PrdStatus.OUTDATED).toBe('outdated');
    });

    it('should have correct task list status values', () => {
      expect(TaskListStatus.PRESENT).toBe('present');
      expect(TaskListStatus.MISSING).toBe('missing');
      expect(TaskListStatus.OUTDATED).toBe('outdated');
    });
  });
});
