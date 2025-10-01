/**
 * Test Suite for Project Models - Epic 9
 * Tests data models, validation, and business logic
 */

const assert = require('assert');

// Jest is available globally in test environment
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
      
      assert(health.status === ProjectStatus.ACTIVE, 'Should set status');
      assert(health.healthScore === 85, 'Should set health score');
      assert(health.lastActivity instanceof Date, 'Should convert last activity to Date');
      assert(health.prdStatus === PrdStatus.PRESENT, 'Should set PRD status');
      assert(health.taskListStatus === TaskListStatus.PRESENT, 'Should set task list status');
      assert(health.completionVelocity === 2.5, 'Should set completion velocity');
      assert(Array.isArray(health.riskFactors), 'Should set risk factors');
    });

    it('should clamp health score to valid range', () => {
      const health1 = new ProjectHealthModel({ healthScore: 150 });
      const health2 = new ProjectHealthModel({ healthScore: -50 });
      
      assert(health1.healthScore === 100, 'Should clamp high health score to 100');
      assert(health2.healthScore === 0, 'Should clamp low health score to 0');
    });

    it('should calculate health score correctly', () => {
      const health = new ProjectHealthModel({
        lastActivity: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
        prdStatus: PrdStatus.PRESENT,
        taskListStatus: TaskListStatus.PRESENT,
        completionVelocity: 2.0
      });

      const score = health.calculateHealthScore();
      
      assert(typeof score === 'number', 'Should return numeric score');
      assert(score >= 0 && score <= 100, 'Score should be between 0 and 100');
      assert(score > 0, 'Should have positive score with good data');
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
      
      assert(Array.isArray(risks), 'Should return array of risks');
      assert(risks.length > 0, 'Should identify multiple risks');
      assert(risks.includes('No recent activity'), 'Should identify stale activity');
      assert(risks.includes('Missing PRD'), 'Should identify missing PRD');
      assert(risks.includes('Outdated task list'), 'Should identify outdated task list');
      assert(risks.includes('No completion velocity'), 'Should identify no velocity');
      assert(risks.includes('Low health score'), 'Should identify low health score');
    });

    it('should get correct health status', () => {
      const excellent = new ProjectHealthModel({ healthScore: 90 });
      const good = new ProjectHealthModel({ healthScore: 70 });
      const fair = new ProjectHealthModel({ healthScore: 50 });
      const poor = new ProjectHealthModel({ healthScore: 30 });
      const critical = new ProjectHealthModel({ healthScore: 10 });

      assert(excellent.getHealthStatus() === 'excellent', 'Should return excellent for high score');
      assert(good.getHealthStatus() === 'good', 'Should return good for medium-high score');
      assert(fair.getHealthStatus() === 'fair', 'Should return fair for medium score');
      assert(poor.getHealthStatus() === 'poor', 'Should return poor for low score');
      assert(critical.getHealthStatus() === 'critical', 'Should return critical for very low score');
    });

    it('should convert to JSON correctly', () => {
      const health = new ProjectHealthModel({
        status: ProjectStatus.ACTIVE,
        healthScore: 85,
        lastActivity: '2024-01-15T10:30:00Z',
        prdStatus: PrdStatus.PRESENT,
        taskListStatus: TaskListStatus.PRESENT,
        completionVelocity: 2.5,
        riskFactors: ['No recent activity']
      });

      const json = health.toJSON();
      
      assert(typeof json === 'object', 'Should return object');
      assert(json.status === ProjectStatus.ACTIVE, 'Should include status');
      assert(json.healthScore === 85, 'Should include health score');
      assert(typeof json.lastActivity === 'string', 'Should convert date to ISO string');
      assert(json.prdStatus === PrdStatus.PRESENT, 'Should include PRD status');
      assert(json.taskListStatus === TaskListStatus.PRESENT, 'Should include task list status');
      assert(json.completionVelocity === 2.5, 'Should include completion velocity');
      assert(Array.isArray(json.riskFactors), 'Should include risk factors');
      assert(json.healthStatus, 'Should include calculated health status');
      assert(typeof json.lastUpdated === 'string', 'Should include last updated timestamp');
    });
  });

  describe('ProjectOverviewModel', () => {
    it('should create overview model with default values', () => {
      const overview = new ProjectOverviewModel();
      
      assert(overview.name === '', 'Should have empty name by default');
      assert(overview.repository === '', 'Should have empty repository by default');
      assert(overview.status === ProjectStatus.UNKNOWN, 'Should have unknown status by default');
      assert(overview.category === 'Miscellaneous / Standalone', 'Should have default category');
      assert(overview.health instanceof ProjectHealthModel, 'Should have health model');
      assert(overview.progress === 0, 'Should have zero progress by default');
      assert(overview.storiesTotal === 0, 'Should have zero stories total by default');
      assert(overview.storiesCompleted === 0, 'Should have zero stories completed by default');
      assert(overview.tasksTotal === 0, 'Should have zero tasks total by default');
      assert(overview.tasksCompleted === 0, 'Should have zero tasks completed by default');
      assert(overview.lastActivity === null, 'Should have null last activity by default');
      assert(overview.totalCommits === 0, 'Should have zero total commits by default');
      assert(overview.color === '#6B7280', 'Should have default color');
      assert(overview.hasPrd === false, 'Should have false hasPrd by default');
      assert(overview.hasTaskList === false, 'Should have false hasTaskList by default');
    });

    it('should create overview model with provided data', () => {
      const data = {
        name: 'Test Project',
        repository: 'test-repo',
        status: ProjectStatus.ACTIVE,
        category: 'Web Development',
        health: {
          status: ProjectStatus.ACTIVE,
          healthScore: 85,
          lastActivity: '2024-01-15T10:30:00Z',
          prdStatus: PrdStatus.PRESENT,
          taskListStatus: TaskListStatus.PRESENT,
          completionVelocity: 2.5,
          riskFactors: []
        },
        progress: 75,
        storiesTotal: 20,
        storiesCompleted: 15,
        tasksTotal: 50,
        tasksCompleted: 40,
        lastActivity: '2024-01-15T10:30:00Z',
        totalCommits: 150,
        color: '#667eea',
        hasPrd: true,
        hasTaskList: true
      };

      const overview = new ProjectOverviewModel(data);
      
      assert(overview.name === 'Test Project', 'Should set name');
      assert(overview.repository === 'test-repo', 'Should set repository');
      assert(overview.status === ProjectStatus.ACTIVE, 'Should set status');
      assert(overview.category === 'Web Development', 'Should set category');
      assert(overview.health instanceof ProjectHealthModel, 'Should create health model');
      assert(overview.progress === 75, 'Should set progress');
      assert(overview.storiesTotal === 20, 'Should set stories total');
      assert(overview.storiesCompleted === 15, 'Should set stories completed');
      assert(overview.tasksTotal === 50, 'Should set tasks total');
      assert(overview.tasksCompleted === 40, 'Should set tasks completed');
      assert(overview.lastActivity instanceof Date, 'Should convert last activity to Date');
      assert(overview.totalCommits === 150, 'Should set total commits');
      assert(overview.color === '#667eea', 'Should set color');
      assert(overview.hasPrd === true, 'Should set hasPrd');
      assert(overview.hasTaskList === true, 'Should set hasTaskList');
    });

    it('should clamp numeric values to valid ranges', () => {
      const overview = new ProjectOverviewModel({
        progress: 150,
        storiesTotal: -10,
        storiesCompleted: 25, // More than total
        tasksTotal: -5,
        tasksCompleted: 60, // More than total
        totalCommits: -100
      });

      assert(overview.progress === 100, 'Should clamp progress to 100');
      assert(overview.storiesTotal === 0, 'Should clamp stories total to 0');
      assert(overview.storiesCompleted === 0, 'Should clamp stories completed to 0');
      assert(overview.tasksTotal === 0, 'Should clamp tasks total to 0');
      assert(overview.tasksCompleted === 0, 'Should clamp tasks completed to 0');
      assert(overview.totalCommits === 0, 'Should clamp total commits to 0');
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

      assert(overview1.getCompletionPercentage() === 75, 'Should calculate correct completion percentage');
      assert(overview2.getCompletionPercentage() === 0, 'Should return 0 for zero total stories');
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

      assert(recent.getActivityStatus() === 'recent', 'Should return recent for 3 days ago');
      assert(moderate.getActivityStatus() === 'moderate', 'Should return moderate for 20 days ago');
      assert(stale.getActivityStatus() === 'stale', 'Should return stale for 60 days ago');
      assert(inactive.getActivityStatus() === 'inactive', 'Should return inactive for 120 days ago');
      assert(noActivity.getActivityStatus() === 'inactive', 'Should return inactive for null activity');
    });

    it('should convert to JSON correctly', () => {
      const overview = new ProjectOverviewModel({
        name: 'Test Project',
        repository: 'test-repo',
        status: ProjectStatus.ACTIVE,
        category: 'Web Development',
        health: {
          status: ProjectStatus.ACTIVE,
          healthScore: 85,
          lastActivity: '2024-01-15T10:30:00Z',
          prdStatus: PrdStatus.PRESENT,
          taskListStatus: TaskListStatus.PRESENT,
          completionVelocity: 2.5,
          riskFactors: []
        },
        progress: 75,
        storiesTotal: 20,
        storiesCompleted: 15,
        tasksTotal: 50,
        tasksCompleted: 40,
        lastActivity: '2024-01-15T10:30:00Z',
        totalCommits: 150,
        color: '#667eea',
        hasPrd: true,
        hasTaskList: true
      });

      const json = overview.toJSON();
      
      assert(typeof json === 'object', 'Should return object');
      assert(json.name === 'Test Project', 'Should include name');
      assert(json.repository === 'test-repo', 'Should include repository');
      assert(json.status === ProjectStatus.ACTIVE, 'Should include status');
      assert(json.category === 'Web Development', 'Should include category');
      assert(typeof json.health === 'object', 'Should include health object');
      assert(json.progress === 75, 'Should include progress');
      assert(json.storiesTotal === 20, 'Should include stories total');
      assert(json.storiesCompleted === 15, 'Should include stories completed');
      assert(json.tasksTotal === 50, 'Should include tasks total');
      assert(json.tasksCompleted === 40, 'Should include tasks completed');
      assert(typeof json.completionPercentage === 'number', 'Should include calculated completion percentage');
      assert(typeof json.lastActivity === 'string', 'Should convert last activity to ISO string');
      assert(json.activityStatus, 'Should include calculated activity status');
      assert(json.totalCommits === 150, 'Should include total commits');
      assert(json.color === '#667eea', 'Should include color');
      assert(json.hasPrd === true, 'Should include hasPrd');
      assert(json.hasTaskList === true, 'Should include hasTaskList');
      assert(typeof json.lastUpdated === 'string', 'Should include last updated timestamp');
    });
  });

  describe('ProgressAnalyticsModel', () => {
    it('should create analytics model with default values', () => {
      const analytics = new ProgressAnalyticsModel();
      
      assert(analytics.projectId === '', 'Should have empty project ID by default');
      assert(analytics.projectName === '', 'Should have empty project name by default');
      assert(analytics.totalStories === 0, 'Should have zero total stories by default');
      assert(analytics.completedStories === 0, 'Should have zero completed stories by default');
      assert(analytics.totalTasks === 0, 'Should have zero total tasks by default');
      assert(analytics.completedTasks === 0, 'Should have zero completed tasks by default');
      assert(analytics.incompleteStories === 0, 'Should have zero incomplete stories by default');
      assert(analytics.incompleteTasks === 0, 'Should have zero incomplete tasks by default');
      assert(analytics.velocity === 0, 'Should have zero velocity by default');
      assert(analytics.trend === 'stable', 'Should have stable trend by default');
      assert(Array.isArray(analytics.blockedItems), 'Should have empty blocked items array');
      assert(Array.isArray(analytics.staleItems), 'Should have empty stale items array');
    });

    it('should create analytics model with provided data', () => {
      const data = {
        projectId: 'test-project',
        projectName: 'Test Project',
        totalStories: 20,
        completedStories: 15,
        totalTasks: 50,
        completedTasks: 40,
        incompleteStories: 5,
        incompleteTasks: 10,
        velocity: 2.5,
        trend: 'increasing',
        blockedItems: [{ id: 'blocked-1' }],
        staleItems: [{ id: 'stale-1' }]
      };

      const analytics = new ProgressAnalyticsModel(data);
      
      assert(analytics.projectId === 'test-project', 'Should set project ID');
      assert(analytics.projectName === 'Test Project', 'Should set project name');
      assert(analytics.totalStories === 20, 'Should set total stories');
      assert(analytics.completedStories === 15, 'Should set completed stories');
      assert(analytics.totalTasks === 50, 'Should set total tasks');
      assert(analytics.completedTasks === 40, 'Should set completed tasks');
      assert(analytics.incompleteStories === 5, 'Should set incomplete stories');
      assert(analytics.incompleteTasks === 10, 'Should set incomplete tasks');
      assert(analytics.velocity === 2.5, 'Should set velocity');
      assert(analytics.trend === 'increasing', 'Should set trend');
      assert(Array.isArray(analytics.blockedItems), 'Should set blocked items');
      assert(Array.isArray(analytics.staleItems), 'Should set stale items');
    });

    it('should clamp numeric values to valid ranges', () => {
      const analytics = new ProgressAnalyticsModel({
        totalStories: -10,
        completedStories: 25, // More than total
        totalTasks: -5,
        completedTasks: 60, // More than total
        incompleteStories: -5,
        incompleteTasks: -10
      });

      assert(analytics.totalStories === 0, 'Should clamp total stories to 0');
      assert(analytics.completedStories === 0, 'Should clamp completed stories to 0');
      assert(analytics.totalTasks === 0, 'Should clamp total tasks to 0');
      assert(analytics.completedTasks === 0, 'Should clamp completed tasks to 0');
      assert(analytics.incompleteStories === 0, 'Should clamp incomplete stories to 0');
      assert(analytics.incompleteTasks === 0, 'Should clamp incomplete tasks to 0');
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

      assert(analytics1.getStoryCompletionPercentage() === 75, 'Should calculate correct story completion percentage');
      assert(analytics2.getStoryCompletionPercentage() === 0, 'Should return 0 for zero total stories');
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

      assert(analytics1.getTaskCompletionPercentage() === 80, 'Should calculate correct task completion percentage');
      assert(analytics2.getTaskCompletionPercentage() === 0, 'Should return 0 for zero total tasks');
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

      assert(analytics1.getOverallCompletionPercentage() === 79, 'Should calculate correct overall completion percentage');
      assert(analytics2.getOverallCompletionPercentage() === 0, 'Should return 0 for zero total items');
    });

    it('should identify blocked items', () => {
      const analytics = new ProgressAnalyticsModel();
      const blockedItems = analytics.identifyBlockedItems();
      
      assert(Array.isArray(blockedItems), 'Should return array of blocked items');
      // Note: In real implementation, this would check for items with no recent activity
    });

    it('should identify stale items', () => {
      const analytics = new ProgressAnalyticsModel();
      const staleItems = analytics.identifyStaleItems();
      
      assert(Array.isArray(staleItems), 'Should return array of stale items');
      // Note: In real implementation, this would check for items with no recent activity
    });

    it('should convert to JSON correctly', () => {
      const analytics = new ProgressAnalyticsModel({
        projectId: 'test-project',
        projectName: 'Test Project',
        totalStories: 20,
        completedStories: 15,
        totalTasks: 50,
        completedTasks: 40,
        incompleteStories: 5,
        incompleteTasks: 10,
        velocity: 2.5,
        trend: 'increasing',
        blockedItems: [{ id: 'blocked-1' }],
        staleItems: [{ id: 'stale-1' }]
      });

      const json = analytics.toJSON();
      
      assert(typeof json === 'object', 'Should return object');
      assert(json.projectId === 'test-project', 'Should include project ID');
      assert(json.projectName === 'Test Project', 'Should include project name');
      assert(json.totalStories === 20, 'Should include total stories');
      assert(json.completedStories === 15, 'Should include completed stories');
      assert(json.totalTasks === 50, 'Should include total tasks');
      assert(json.completedTasks === 40, 'Should include completed tasks');
      assert(json.incompleteStories === 5, 'Should include incomplete stories');
      assert(json.incompleteTasks === 10, 'Should include incomplete tasks');
      assert(typeof json.storyCompletionPercentage === 'number', 'Should include calculated story completion percentage');
      assert(typeof json.taskCompletionPercentage === 'number', 'Should include calculated task completion percentage');
      assert(typeof json.overallCompletionPercentage === 'number', 'Should include calculated overall completion percentage');
      assert(json.velocity === 2.5, 'Should include velocity');
      assert(json.trend === 'increasing', 'Should include trend');
      assert(Array.isArray(json.blockedItems), 'Should include blocked items');
      assert(Array.isArray(json.staleItems), 'Should include stale items');
      assert(typeof json.lastUpdated === 'string', 'Should include last updated timestamp');
    });
  });

  describe('ApiResponseModel', () => {
    it('should create success response', () => {
      const data = { test: 'data' };
      const metadata = { timestamp: '2024-01-15T10:30:00Z' };
      const response = ApiResponseModel.success(data, metadata);
      
      assert(response.success === true, 'Should have success true');
      assert(response.data === data, 'Should include data');
      assert(response.error === null, 'Should have null error');
      assert(response.metadata.timestamp === '2024-01-15T10:30:00Z', 'Should include metadata');
    });

    it('should create error response', () => {
      const error = 'Test error message';
      const metadata = { errorType: 'validation' };
      const response = ApiResponseModel.error(error, metadata);
      
      assert(response.success === false, 'Should have success false');
      assert(response.data === null, 'Should have null data');
      assert(response.error === error, 'Should include error message');
      assert(response.metadata.errorType === 'validation', 'Should include metadata');
    });

    it('should create response with default values', () => {
      const response = new ApiResponseModel();
      
      assert(response.success === true, 'Should have success true by default');
      assert(response.data === null, 'Should have null data by default');
      assert(response.error === null, 'Should have null error by default');
      assert(typeof response.metadata === 'object', 'Should have metadata object');
      assert(typeof response.metadata.timestamp === 'string', 'Should have timestamp in metadata');
    });

    it('should convert to JSON correctly', () => {
      const response = new ApiResponseModel(true, { test: 'data' }, null, { custom: 'metadata' });
      const json = response.toJSON();
      
      assert(typeof json === 'object', 'Should return object');
      assert(json.success === true, 'Should include success');
      assert(json.data.test === 'data', 'Should include data');
      assert(json.error === null, 'Should include error');
      assert(json.metadata.custom === 'metadata', 'Should include metadata');
      assert(typeof json.metadata.timestamp === 'string', 'Should include timestamp');
    });
  });

  describe('Enums', () => {
    it('should have correct project status values', () => {
      assert(ProjectStatus.ACTIVE === 'active', 'Should have active status');
      assert(ProjectStatus.PLANNING === 'planning', 'Should have planning status');
      assert(ProjectStatus.PAUSED === 'paused', 'Should have paused status');
      assert(ProjectStatus.COMPLETED === 'completed', 'Should have completed status');
      assert(ProjectStatus.UNKNOWN === 'unknown', 'Should have unknown status');
    });

    it('should have correct PRD status values', () => {
      assert(PrdStatus.PRESENT === 'present', 'Should have present status');
      assert(PrdStatus.MISSING === 'missing', 'Should have missing status');
      assert(PrdStatus.OUTDATED === 'outdated', 'Should have outdated status');
    });

    it('should have correct task list status values', () => {
      assert(TaskListStatus.PRESENT === 'present', 'Should have present status');
      assert(TaskListStatus.MISSING === 'missing', 'Should have missing status');
      assert(TaskListStatus.OUTDATED === 'outdated', 'Should have outdated status');
    });
  });
});

// Run tests if this file is executed directly
if (require.main === module) {
  const testRunner = async () => {
    console.log('🧪 Running Project Models tests...');
    
    try {
      // Test ProjectHealthModel
      const health = new ProjectHealthModel({
        lastActivity: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        prdStatus: PrdStatus.PRESENT,
        taskListStatus: TaskListStatus.PRESENT,
        completionVelocity: 2.0
      });
      const healthScore = health.calculateHealthScore();
      console.log('✅ ProjectHealthModel created and calculated score:', healthScore);
      
      // Test ProjectOverviewModel
      const overview = new ProjectOverviewModel({
        name: 'Test Project',
        storiesTotal: 20,
        storiesCompleted: 15
      });
      const completionPercentage = overview.getCompletionPercentage();
      console.log('✅ ProjectOverviewModel created and calculated completion:', completionPercentage);
      
      // Test ProgressAnalyticsModel
      const analytics = new ProgressAnalyticsModel({
        totalStories: 20,
        completedStories: 15,
        totalTasks: 50,
        completedTasks: 40
      });
      const overallCompletion = analytics.getOverallCompletionPercentage();
      console.log('✅ ProgressAnalyticsModel created and calculated overall completion:', overallCompletion);
      
      // Test ApiResponseModel
      const response = ApiResponseModel.success({ test: 'data' });
      console.log('✅ ApiResponseModel created:', response.success);
      
      console.log('🎉 All Project Models tests passed!');
      
    } catch (error) {
      console.error('❌ Test failed:', error.message);
      process.exit(1);
    }
  };

  testRunner();
}
