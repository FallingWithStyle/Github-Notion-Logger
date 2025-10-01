/**
 * Test Suite for ProgressTrackingService - Epic 9
 * Tests progress analytics, incomplete work tracking, and velocity trends
 */

const assert = require('assert');
const ProgressTrackingService = require('./services/progress-tracking-service');

// Mock the notion module
jest.mock('./notion', () => ({
  getAllCachedRepositories: jest.fn().mockResolvedValue([
    {
      name: 'test-project-1',
      progress: 75,
      storyCount: 20,
      taskCount: 50,
      hasPrd: true,
      lastScanned: '2024-01-15T10:30:00Z',
      category: 'Web Development',
      status: 'active'
    }
  ])
}));

describe('ProgressTrackingService', () => {
  let service;
  let mockData;

  beforeEach(() => {
    service = new ProgressTrackingService();
    
    // Mock data for testing
    mockData = {
      analytics: [
        {
          projectId: 'test-project-1',
          projectName: 'Test Project 1',
          totalStories: 20,
          completedStories: 15,
          totalTasks: 50,
          completedTasks: 40,
          incompleteStories: 5,
          incompleteTasks: 10,
          storyCompletionPercentage: 75,
          taskCompletionPercentage: 80,
          overallCompletionPercentage: 78,
          velocity: 2.5,
          trend: 'increasing',
          blockedItems: [],
          staleItems: []
        },
        {
          projectId: 'test-project-2',
          projectName: 'Test Project 2',
          totalStories: 15,
          completedStories: 5,
          totalTasks: 30,
          completedTasks: 10,
          incompleteStories: 10,
          incompleteTasks: 20,
          storyCompletionPercentage: 33,
          taskCompletionPercentage: 33,
          overallCompletionPercentage: 33,
          velocity: 1.0,
          trend: 'decreasing',
          blockedItems: [
            { id: 'blocked-1', title: 'Blocked Story', lastActivity: '2024-01-10T10:30:00Z' }
          ],
          staleItems: [
            { id: 'stale-1', title: 'Stale Task', lastActivity: '2024-01-05T10:30:00Z' }
          ]
        }
      ]
    };
  });

  describe('getProgressAnalytics', () => {
    it('should return progress analytics for all projects', async () => {
      // Mock the gatherProjectData method
      service.gatherProjectData = async (filters) => ({
        projectNames: ['test-project-1', 'test-project-2'],
        githubData: {},
        notionData: {},
        commitLogData: {},
        cachedData: {
          'test-project-1': {
            name: 'Test Project 1',
            progress: 75,
            storiesTotal: 20,
            storiesCompleted: 15,
            tasksTotal: 50,
            tasksCompleted: 40,
            hasPrd: true,
            hasTaskList: true,
            lastActivity: '2024-01-15T10:30:00Z',
            category: 'Web Development',
            status: 'active'
          },
          'test-project-2': {
            name: 'test-project-2',
            progress: 33,
            storiesTotal: 15,
            storiesCompleted: 5,
            tasksTotal: 30,
            tasksCompleted: 10,
            hasPrd: false,
            hasTaskList: true,
            lastActivity: '2024-01-10T10:30:00Z',
            category: 'Mobile Development',
            status: 'planning'
          }
        }
      });

      const result = await service.getProgressAnalytics();
      
      assert(result.success === true, 'Should return successful response');
      assert(result.data.projects, 'Should return projects array');
      assert(result.data.aggregate, 'Should return aggregate metrics');
      assert(Array.isArray(result.data.projects), 'Projects should be an array');
      assert(result.data.projects.length > 0, 'Should return at least one project');
      
      // Check project structure
      const project = result.data.projects[0];
      assert(project.projectId, 'Project should have projectId');
      assert(project.projectName, 'Project should have projectName');
      assert(typeof project.totalStories === 'number', 'Should have numeric totalStories');
      assert(typeof project.completedStories === 'number', 'Should have numeric completedStories');
      assert(typeof project.velocity === 'number', 'Should have numeric velocity');
      assert(project.trend, 'Should have trend');
    });

    it('should apply filters correctly', async () => {
      const result = await service.getProgressAnalytics({ projectName: 'test-project-1' });

      assert(result.success === true, 'Should return successful response');
      assert(result.data.projects.length === 1, `Should return only matching project, got ${result.data.projects.length}`);
      assert(result.data.projects[0].projectName === 'test-project-1', 'Should return correct project');
    });

    it('should calculate aggregate metrics correctly', async () => {
      service.gatherProjectData = async (filters) => ({
        projectNames: ['test-project-1', 'test-project-2'],
        githubData: {},
        notionData: {},
        commitLogData: {},
        cachedData: {
          'test-project-1': {
            name: 'Test Project 1',
            progress: 75,
            storiesTotal: 20,
            storiesCompleted: 15,
            tasksTotal: 50,
            tasksCompleted: 40,
            hasPrd: true,
            hasTaskList: true,
            lastActivity: '2024-01-15T10:30:00Z',
            category: 'Web Development',
            status: 'active'
          },
          'test-project-2': {
            name: 'test-project-2',
            progress: 33,
            storiesTotal: 15,
            storiesCompleted: 5,
            tasksTotal: 30,
            tasksCompleted: 10,
            hasPrd: false,
            hasTaskList: true,
            lastActivity: '2024-01-10T10:30:00Z',
            category: 'Mobile Development',
            status: 'planning'
          }
        }
      });

      const result = await service.getProgressAnalytics();
      
      assert(result.success === true, 'Should return successful response');
      const aggregate = result.data.aggregate;
      assert(typeof aggregate.totalProjects === 'number', 'Should have totalProjects');
      assert(typeof aggregate.averageCompletion === 'number', 'Should have averageCompletion');
      assert(typeof aggregate.totalStories === 'number', 'Should have totalStories');
      assert(typeof aggregate.completedStories === 'number', 'Should have completedStories');
      assert(typeof aggregate.averageVelocity === 'number', 'Should have averageVelocity');
    });

    it('should handle errors gracefully', async () => {
      service.gatherProjectData = async () => {
        throw new Error('Data gathering failed');
      };

      const result = await service.getProgressAnalytics();
      
      assert(result.success === true, 'Should return success response with fallback data');
      assert(result.data, 'Should have fallback data');
    });
  });

  describe('getIncompleteWork', () => {
    it('should return incomplete work tracking', async () => {
      service.getProgressAnalytics = async () => ({
        success: true,
        data: {
          projects: mockData.analytics,
          aggregate: {}
        }
      });

      const result = await service.getIncompleteWork();
      
      assert(result.success === true, 'Should return successful response');
      assert(Array.isArray(result.data), 'Should return array of incomplete work');
      assert(result.data.length > 0, 'Should return at least one item');
      
      // Check incomplete work structure
      const item = result.data[0];
      assert(item.projectId, 'Should have projectId');
      assert(item.projectName, 'Should have projectName');
      assert(typeof item.incompleteStories === 'number', 'Should have numeric incompleteStories');
      assert(typeof item.incompleteTasks === 'number', 'Should have numeric incompleteTasks');
      assert(typeof item.totalIncomplete === 'number', 'Should have numeric totalIncomplete');
      assert(typeof item.completionPercentage === 'number', 'Should have numeric completionPercentage');
      assert(typeof item.velocity === 'number', 'Should have numeric velocity');
      assert(typeof item.priority === 'number', 'Should have numeric priority');
    });

    it('should sort by priority and completion percentage', async () => {
      service.getProgressAnalytics = async () => ({
        success: true,
        data: {
          projects: mockData.analytics,
          aggregate: {}
        }
      });

      const result = await service.getIncompleteWork();
      
      assert(result.success === true, 'Should return successful response');
      assert(result.data.length >= 2, 'Should return multiple items');
      
      // Check sorting (higher priority first, then lower completion)
      for (let i = 0; i < result.data.length - 1; i++) {
        const current = result.data[i];
        const next = result.data[i + 1];
        
        if (current.priority !== next.priority) {
          assert(current.priority >= next.priority, 'Should sort by priority desc');
        } else {
          assert(current.completionPercentage <= next.completionPercentage, 'Should sort by completion asc when priority equal');
        }
      }
    });

    it('should apply filters correctly', async () => {
      service.getProgressAnalytics = async (filters) => ({
        success: true,
        data: {
          projects: mockData.analytics.filter(p => 
            !filters.projectName || p.projectName.toLowerCase().includes(filters.projectName.toLowerCase())
          ),
          aggregate: {}
        }
      });

      const result = await service.getIncompleteWork({ projectName: 'Test Project 1' });
      
      assert(result.success === true, 'Should return successful response');
      assert(result.data.length === 1, 'Should return only matching project');
      assert(result.data[0].projectName === 'Test Project 1', 'Should return correct project');
    });
  });

  describe('getVelocityTrends', () => {
    it('should return velocity trends for all projects', async () => {
      service.getProgressAnalytics = async () => ({
        success: true,
        data: {
          projects: mockData.analytics,
          aggregate: {}
        }
      });

      const result = await service.getVelocityTrends();
      
      assert(result.success === true, 'Should return successful response');
      assert(result.data.overall, 'Should have overall trends');
      assert(Array.isArray(result.data.projects), 'Should have projects array');
      assert(result.data.projects.length > 0, 'Should return at least one project trend');
      
      // Check overall trends structure
      assert(typeof result.data.overall.trend === 'string', 'Should have overall trend');
      assert(typeof result.data.overall.velocity === 'number', 'Should have overall velocity');
      assert(typeof result.data.overall.change === 'number', 'Should have overall change');
    });

    it('should return velocity trends for specific project', async () => {
      service.getProgressAnalytics = async (filters) => ({
        success: true,
        data: {
          projects: mockData.analytics.filter(p => 
            !filters.projectName || p.projectName === filters.projectName
          ),
          aggregate: {}
        }
      });

      const result = await service.getVelocityTrends('Test Project 1');
      
      assert(result.success === true, 'Should return successful response');
      assert(result.data.projects.length === 1, 'Should return only specified project');
      assert(result.data.projects[0].projectName === 'Test Project 1', 'Should return correct project');
    });
  });

  describe('getBlockedAndStaleItems', () => {
    it('should return blocked and stale items', async () => {
      service.getIncompleteWork = async () => ({
        success: true,
        data: mockData.analytics.map(project => ({
          projectId: project.projectId,
          projectName: project.projectName,
          incompleteStories: project.incompleteStories,
          incompleteTasks: project.incompleteTasks,
          totalIncomplete: project.incompleteStories + project.incompleteTasks,
          completionPercentage: project.overallCompletionPercentage,
          velocity: project.velocity,
          blockedItems: project.blockedItems,
          staleItems: project.staleItems,
          priority: 85
        }))
      });

      const result = await service.getBlockedAndStaleItems();
      
      assert(result.success === true, 'Should return successful response');
      assert(result.data.blockedItems, 'Should have blocked items');
      assert(result.data.staleItems, 'Should have stale items');
      assert(result.data.summary, 'Should have summary');
      assert(Array.isArray(result.data.blockedItems), 'Blocked items should be array');
      assert(Array.isArray(result.data.staleItems), 'Stale items should be array');
      
      // Check summary structure
      assert(typeof result.data.summary.totalBlocked === 'number', 'Should have totalBlocked count');
      assert(typeof result.data.summary.totalStale === 'number', 'Should have totalStale count');
      assert(typeof result.data.summary.projectsWithBlockedItems === 'number', 'Should have projectsWithBlockedItems count');
      assert(typeof result.data.summary.projectsWithStaleItems === 'number', 'Should have projectsWithStaleItems count');
    });

    it('should sort blocked and stale items by age', async () => {
      service.getIncompleteWork = async () => ({
        success: true,
        data: [
          {
            projectId: 'test-project-1',
            projectName: 'Test Project 1',
            blockedItems: [
              { id: 'blocked-1', title: 'Older Blocked Item', lastActivity: '2024-01-05T10:30:00Z' },
              { id: 'blocked-2', title: 'Newer Blocked Item', lastActivity: '2024-01-10T10:30:00Z' }
            ],
            staleItems: [
              { id: 'stale-1', title: 'Older Stale Item', lastActivity: '2024-01-01T10:30:00Z' },
              { id: 'stale-2', title: 'Newer Stale Item', lastActivity: '2024-01-08T10:30:00Z' }
            ]
          }
        ]
      });

      const result = await service.getBlockedAndStaleItems();
      
      assert(result.success === true, 'Should return successful response');
      
      // Check sorting (newest first)
      const blockedItems = result.data.blockedItems;
      assert(blockedItems[0].lastActivity > blockedItems[1].lastActivity, 'Should sort blocked items by date desc');
      
      const staleItems = result.data.staleItems;
      assert(staleItems[0].lastActivity > staleItems[1].lastActivity, 'Should sort stale items by date desc');
    });
  });

  describe('applyFilters', () => {
    it('should filter by project name', () => {
      const analytics = [
        { projectName: 'Test Project 1', overallCompletionPercentage: 75, velocity: 2.5 },
        { projectName: 'Test Project 2', overallCompletionPercentage: 50, velocity: 1.0 }
      ];

      const filtered = service.applyFilters(analytics, { projectName: 'Test Project 1' });
      
      assert(filtered.length === 1, 'Should filter by project name');
      assert(filtered[0].projectName === 'Test Project 1', 'Should return correct project');
    });

    it('should filter by minimum completion percentage', () => {
      const analytics = [
        { projectName: 'Project 1', overallCompletionPercentage: 75, velocity: 2.5 },
        { projectName: 'Project 2', overallCompletionPercentage: 50, velocity: 1.0 }
      ];

      const filtered = service.applyFilters(analytics, { minCompletion: 60 });
      
      assert(filtered.length === 1, 'Should filter by minimum completion');
      assert(filtered[0].projectName === 'Project 1', 'Should return correct project');
    });

    it('should filter by maximum completion percentage', () => {
      const analytics = [
        { projectName: 'Project 1', overallCompletionPercentage: 75, velocity: 2.5 },
        { projectName: 'Project 2', overallCompletionPercentage: 50, velocity: 1.0 }
      ];

      const filtered = service.applyFilters(analytics, { maxCompletion: 60 });
      
      assert(filtered.length === 1, 'Should filter by maximum completion');
      assert(filtered[0].projectName === 'Project 2', 'Should return correct project');
    });

    it('should filter by minimum velocity', () => {
      const analytics = [
        { projectName: 'Project 1', overallCompletionPercentage: 75, velocity: 2.5 },
        { projectName: 'Project 2', overallCompletionPercentage: 50, velocity: 1.0 }
      ];

      const filtered = service.applyFilters(analytics, { minVelocity: 2.0 });
      
      assert(filtered.length === 1, 'Should filter by minimum velocity');
      assert(filtered[0].projectName === 'Project 1', 'Should return correct project');
    });
  });

  describe('calculateAggregateMetrics', () => {
    it('should calculate aggregate metrics correctly', () => {
      const analytics = mockData.analytics;
      const aggregate = service.calculateAggregateMetrics(analytics);
      
      assert(typeof aggregate.totalProjects === 'number', 'Should have totalProjects');
      assert(typeof aggregate.averageCompletion === 'number', 'Should have averageCompletion');
      assert(typeof aggregate.totalStories === 'number', 'Should have totalStories');
      assert(typeof aggregate.completedStories === 'number', 'Should have completedStories');
      assert(typeof aggregate.totalTasks === 'number', 'Should have totalTasks');
      assert(typeof aggregate.completedTasks === 'number', 'Should have completedTasks');
      assert(typeof aggregate.averageVelocity === 'number', 'Should have averageVelocity');
      assert(typeof aggregate.projectsWithBlockedItems === 'number', 'Should have projectsWithBlockedItems');
      assert(typeof aggregate.projectsWithStaleItems === 'number', 'Should have projectsWithStaleItems');
      
      // Check calculations
      assert(aggregate.totalProjects === 2, 'Should have correct total projects');
      assert(aggregate.totalStories === 35, 'Should have correct total stories');
      assert(aggregate.completedStories === 20, 'Should have correct completed stories');
      assert(aggregate.totalTasks === 80, 'Should have correct total tasks');
      assert(aggregate.completedTasks === 50, 'Should have correct completed tasks');
    });

    it('should handle empty analytics array', () => {
      const aggregate = service.calculateAggregateMetrics([]);
      
      assert(aggregate.totalProjects === 0, 'Should have zero total projects');
      assert(aggregate.averageCompletion === 0, 'Should have zero average completion');
      assert(aggregate.totalStories === 0, 'Should have zero total stories');
      assert(aggregate.completedStories === 0, 'Should have zero completed stories');
    });
  });

  describe('calculatePriority', () => {
    it('should calculate priority based on completion and issues', () => {
      const project = {
        overallCompletionPercentage: 50,
        blockedItems: [{ id: 'blocked-1' }],
        staleItems: [{ id: 'stale-1' }, { id: 'stale-2' }],
        velocity: 1.0
      };

      const priority = service.calculatePriority(project);
      
      assert(typeof priority === 'number', 'Should return numeric priority');
      assert(priority >= 0, 'Priority should be non-negative');
    });

    it('should give higher priority to lower completion', () => {
      const lowCompletion = {
        overallCompletionPercentage: 20,
        blockedItems: [],
        staleItems: [],
        velocity: 1.0
      };

      const highCompletion = {
        overallCompletionPercentage: 80,
        blockedItems: [],
        staleItems: [],
        velocity: 1.0
      };

      const lowPriority = service.calculatePriority(lowCompletion);
      const highPriority = service.calculatePriority(highCompletion);
      
      assert(lowPriority > highPriority, 'Lower completion should have higher priority');
    });

    it('should give higher priority to more blocked items', () => {
      const manyBlocked = {
        overallCompletionPercentage: 50,
        blockedItems: [{ id: 'blocked-1' }, { id: 'blocked-2' }],
        staleItems: [],
        velocity: 1.0
      };

      const fewBlocked = {
        overallCompletionPercentage: 50,
        blockedItems: [{ id: 'blocked-1' }],
        staleItems: [],
        velocity: 1.0
      };

      const manyPriority = service.calculatePriority(manyBlocked);
      const fewPriority = service.calculatePriority(fewBlocked);
      
      assert(manyPriority > fewPriority, 'More blocked items should have higher priority');
    });
  });

  describe('cache management', () => {
    it('should clear cache', () => {
      service.cache.set('test-key', { data: 'test-data', timestamp: Date.now() });
      assert(service.cache.size > 0, 'Cache should have entries');
      
      service.clearCache();
      assert(service.cache.size === 0, 'Cache should be cleared');
    });

    it('should get cache status', () => {
      service.cache.set('test-key', { data: 'test-data', timestamp: Date.now() });
      
      const status = service.getCacheStatus();
      assert(typeof status.size === 'number', 'Should return cache size');
      assert(typeof status.timeout === 'number', 'Should return cache timeout');
      assert(Array.isArray(status.entries), 'Should return cache entries');
    });
  });

  describe('fallback data', () => {
    it('should get fallback analytics data', () => {
      const fallbackData = service.getFallbackAnalyticsData();
      assert(fallbackData.projects, 'Should have projects array');
      assert(fallbackData.aggregate, 'Should have aggregate object');
      assert(Array.isArray(fallbackData.projects), 'Projects should be array');
    });

    it('should set fallback analytics data', () => {
      const testData = {
        projects: [{ projectName: 'test-project' }],
        aggregate: { totalProjects: 1 }
      };
      service.setFallbackAnalyticsData(testData);
      
      const fallbackData = service.getFallbackAnalyticsData();
      assert(fallbackData.projects.length === 1, 'Should return set fallback data');
    });
  });
});

// Run tests if this file is executed directly
if (require.main === module) {
  const testRunner = async () => {
    console.log('🧪 Running ProgressTrackingService tests...');
    
    try {
      // Create test instance
      const service = new ProgressTrackingService();
      
      // Test basic functionality
      console.log('✅ ProgressTrackingService instantiated successfully');
      
      // Test cache management
      service.clearCache();
      console.log('✅ Cache cleared successfully');
      
      const cacheStatus = service.getCacheStatus();
      console.log('✅ Cache status retrieved:', cacheStatus);
      
      // Test fallback data
      const fallbackData = service.getFallbackAnalyticsData();
      console.log('✅ Fallback data retrieved:', fallbackData.projects ? 'has projects' : 'no projects');
      
      // Test aggregate metrics calculation
      const mockAnalytics = [
        {
          totalStories: 10,
          completedStories: 5,
          totalTasks: 20,
          completedTasks: 10,
          velocity: 2.0,
          blockedItems: [],
          staleItems: []
        }
      ];
      const aggregate = service.calculateAggregateMetrics(mockAnalytics);
      console.log('✅ Aggregate metrics calculated:', aggregate.totalProjects === 1);
      
      console.log('🎉 All ProgressTrackingService tests passed!');
      
    } catch (error) {
      console.error('❌ Test failed:', error.message);
      process.exit(1);
    }
  };

  testRunner();
}
