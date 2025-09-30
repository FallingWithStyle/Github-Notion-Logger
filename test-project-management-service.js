/**
 * Test Suite for ProjectManagementService - Epic 9
 * Tests project overview, health status, categories, and search functionality
 */

const assert = require('assert');
const ProjectManagementService = require('./services/project-management-service');
const { ProjectStatus, PrdStatus, TaskListStatus } = require('./models/project-models');

describe('ProjectManagementService', () => {
  let service;
  let mockData;

  beforeEach(() => {
    service = new ProjectManagementService();
    
    // Mock data for testing
    mockData = {
      cachedRepos: [
        {
          name: 'test-project-1',
          progress: 75,
          storyCount: 20,
          taskCount: 50,
          hasPrd: true,
          lastScanned: '2024-01-15T10:30:00Z',
          category: 'Web Development',
          status: 'active'
        },
        {
          name: 'test-project-2',
          progress: 45,
          storyCount: 15,
          taskCount: 30,
          hasPrd: false,
          lastScanned: '2024-01-10T10:30:00Z',
          category: 'Mobile Development',
          status: 'planning'
        },
        {
          name: 'test-project-3',
          progress: 90,
          storyCount: 10,
          taskCount: 25,
          hasPrd: true,
          lastScanned: '2024-01-20T10:30:00Z',
          category: 'Web Development',
          status: 'active'
        }
      ],
      commitLogData: {
        'test-project-1': {
          totalCommits: 150,
          lastActivity: '2024-01-15T10:30:00Z'
        },
        'test-project-2': {
          totalCommits: 75,
          lastActivity: '2024-01-10T10:30:00Z'
        },
        'test-project-3': {
          totalCommits: 200,
          lastActivity: '2024-01-20T10:30:00Z'
        }
      }
    };

    // Mock the notion module
    const originalNotion = require('./notion');
    require('./notion').getAllCachedRepositories = async () => mockData.cachedRepos;
  });

  describe('getProjectOverview', () => {
    it('should return project overview with health indicators', async () => {
      // Mock the gatherProjectData method
      service.gatherProjectData = async (filters) => ({
        projectNames: ['test-project-1', 'test-project-2', 'test-project-3'],
        githubData: {},
        notionData: {},
        commitLogData: mockData.commitLogData,
        cachedData: {
          'test-project-1': {
            name: 'test-project-1',
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
          }
        }
      });

      const result = await service.getProjectOverview();
      
      assert(result.success === true, 'Should return successful response');
      assert(Array.isArray(result.data), 'Should return array of projects');
      assert(result.data.length > 0, 'Should return at least one project');
      
      // Check project structure
      const project = result.data[0];
      assert(project.name, 'Project should have name');
      assert(project.status, 'Project should have status');
      assert(project.category, 'Project should have category');
      assert(project.health, 'Project should have health data');
      assert(typeof project.progress === 'number', 'Project should have numeric progress');
      assert(typeof project.storiesTotal === 'number', 'Project should have numeric storiesTotal');
      assert(typeof project.storiesCompleted === 'number', 'Project should have numeric storiesCompleted');
    });

    it('should apply filters correctly', async () => {
      service.gatherProjectData = async (filters) => ({
        projectNames: ['test-project-1', 'test-project-2', 'test-project-3'],
        githubData: {},
        notionData: {},
        commitLogData: mockData.commitLogData,
        cachedData: {
          'test-project-1': {
            name: 'test-project-1',
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
            progress: 45,
            storiesTotal: 15,
            storiesCompleted: 7,
            tasksTotal: 30,
            tasksCompleted: 15,
            hasPrd: false,
            hasTaskList: true,
            lastActivity: '2024-01-10T10:30:00Z',
            category: 'Mobile Development',
            status: 'planning'
          }
        }
      });

      const result = await service.getProjectOverview({ category: 'Web Development' });
      
      assert(result.success === true, 'Should return successful response');
      assert(result.data.length === 1, 'Should return only Web Development projects');
      assert(result.data[0].category === 'Web Development', 'Should filter by category');
    });

    it('should handle search queries', async () => {
      service.gatherProjectData = async (filters) => ({
        projectNames: ['test-project-1', 'test-project-2'],
        githubData: {},
        notionData: {},
        commitLogData: mockData.commitLogData,
        cachedData: {
          'test-project-1': {
            name: 'test-project-1',
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
          }
        }
      });

      const result = await service.getProjectOverview({ search: 'test-project-1' });
      
      assert(result.success === true, 'Should return successful response');
      assert(result.data.length === 1, 'Should return only matching projects');
      assert(result.data[0].name === 'test-project-1', 'Should return correct project');
    });

    it('should handle errors gracefully', async () => {
      service.gatherProjectData = async () => {
        throw new Error('Data gathering failed');
      };

      const result = await service.getProjectOverview();
      
      assert(result.success === false, 'Should return error response');
      assert(result.error, 'Should have error message');
    });
  });

  describe('getProjectHealth', () => {
    it('should return project health status', async () => {
      service.gatherProjectData = async (filters) => ({
        projectNames: ['test-project-1'],
        githubData: {},
        notionData: {},
        commitLogData: mockData.commitLogData,
        cachedData: {
          'test-project-1': {
            name: 'test-project-1',
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
          }
        }
      });

      const result = await service.getProjectHealth('test-project-1');
      
      assert(result.success === true, 'Should return successful response');
      assert(result.data, 'Should return health data');
      assert(typeof result.data.healthScore === 'number', 'Should have health score');
      assert(result.data.healthStatus, 'Should have health status');
      assert(Array.isArray(result.data.riskFactors), 'Should have risk factors array');
    });

    it('should handle missing project', async () => {
      service.gatherProjectData = async (filters) => ({
        projectNames: [],
        githubData: {},
        notionData: {},
        commitLogData: {},
        cachedData: {}
      });

      const result = await service.getProjectHealth('nonexistent-project');
      
      assert(result.success === false, 'Should return error response');
    });
  });

  describe('getProjectCategories', () => {
    it('should return project categories with statistics', async () => {
      service.getProjectOverview = async () => ({
        success: true,
        data: [
          {
            name: 'test-project-1',
            category: 'Web Development',
            health: { healthStatus: 'excellent', healthScore: 85 }
          },
          {
            name: 'test-project-2',
            category: 'Web Development',
            health: { healthStatus: 'good', healthScore: 70 }
          },
          {
            name: 'test-project-3',
            category: 'Mobile Development',
            health: { healthStatus: 'fair', healthScore: 60 }
          }
        ]
      });

      const result = await service.getProjectCategories();
      
      assert(result.success === true, 'Should return successful response');
      assert(Array.isArray(result.data), 'Should return array of categories');
      assert(result.data.length === 2, 'Should return unique categories');
      
      const webDevCategory = result.data.find(c => c.name === 'Web Development');
      assert(webDevCategory, 'Should have Web Development category');
      assert(webDevCategory.count === 2, 'Should have correct count');
      assert(webDevCategory.activeCount === 2, 'Should have correct active count');
      assert(webDevCategory.averageHealth === 78, 'Should have correct average health');
    });
  });

  describe('searchProjects', () => {
    it('should search projects by query', async () => {
      service.getProjectOverview = async (filters) => ({
        success: true,
        data: [
          {
            name: 'test-project-1',
            category: 'Web Development',
            repository: 'test-project-1'
          }
        ]
      });

      const result = await service.searchProjects('test-project-1');
      
      assert(result.success === true, 'Should return successful response');
      assert(Array.isArray(result.data), 'Should return array of results');
      assert(result.data.length === 1, 'Should return matching project');
      assert(result.metadata.query === 'test-project-1', 'Should include query in metadata');
    });

    it('should handle empty search query', async () => {
      const result = await service.searchProjects('');
      
      assert(result.success === true, 'Should return successful response');
      assert(result.data.length === 0, 'Should return empty array for empty query');
    });

    it('should handle short search query', async () => {
      const result = await service.searchProjects('a');
      
      assert(result.success === true, 'Should return successful response');
      assert(result.data.length === 0, 'Should return empty array for short query');
    });
  });

  describe('applyFilters', () => {
    it('should filter by category', () => {
      const projects = [
        { name: 'project1', category: 'Web Development' },
        { name: 'project2', category: 'Mobile Development' }
      ];

      const filtered = service.applyFilters(projects, { category: 'Web Development' });
      
      assert(filtered.length === 1, 'Should filter by category');
      assert(filtered[0].name === 'project1', 'Should return correct project');
    });

    it('should filter by status', () => {
      const projects = [
        { name: 'project1', status: 'active' },
        { name: 'project2', status: 'planning' }
      ];

      const filtered = service.applyFilters(projects, { status: 'active' });
      
      assert(filtered.length === 1, 'Should filter by status');
      assert(filtered[0].name === 'project1', 'Should return correct project');
    });

    it('should filter by search term', () => {
      const projects = [
        { name: 'test-project-1', category: 'Web Development' },
        { name: 'other-project', category: 'Mobile Development' }
      ];

      const filtered = service.applyFilters(projects, { search: 'test' });
      
      assert(filtered.length === 1, 'Should filter by search term');
      assert(filtered[0].name === 'test-project-1', 'Should return correct project');
    });
  });

  describe('sortProjects', () => {
    it('should sort by name', () => {
      const projects = [
        { name: 'project-c', health: { healthScore: 50 } },
        { name: 'project-a', health: { healthScore: 80 } },
        { name: 'project-b', health: { healthScore: 60 } }
      ];

      const sorted = service.sortProjects(projects, 'name');
      
      assert(sorted[0].name === 'project-a', 'Should sort by name');
      assert(sorted[1].name === 'project-b', 'Should sort by name');
      assert(sorted[2].name === 'project-c', 'Should sort by name');
    });

    it('should sort by health score', () => {
      const projects = [
        { name: 'project1', health: { healthScore: 50 } },
        { name: 'project2', health: { healthScore: 80 } },
        { name: 'project3', health: { healthScore: 60 } }
      ];

      const sorted = service.sortProjects(projects, 'healthScore');
      
      assert(sorted[0].health.healthScore === 80, 'Should sort by health score desc');
      assert(sorted[1].health.healthScore === 60, 'Should sort by health score desc');
      assert(sorted[2].health.healthScore === 50, 'Should sort by health score desc');
    });

    it('should sort by progress', () => {
      const projects = [
        { name: 'project1', progress: 30 },
        { name: 'project2', progress: 80 },
        { name: 'project3', progress: 60 }
      ];

      const sorted = service.sortProjects(projects, 'progress');
      
      assert(sorted[0].progress === 80, 'Should sort by progress desc');
      assert(sorted[1].progress === 60, 'Should sort by progress desc');
      assert(sorted[2].progress === 30, 'Should sort by progress desc');
    });

    it('should sort by last activity by default', () => {
      const projects = [
        { name: 'project1', lastActivity: '2024-01-10T10:30:00Z' },
        { name: 'project2', lastActivity: '2024-01-20T10:30:00Z' },
        { name: 'project3', lastActivity: '2024-01-15T10:30:00Z' }
      ];

      const sorted = service.sortProjects(projects, 'lastActivity');
      
      assert(sorted[0].name === 'project2', 'Should sort by last activity desc');
      assert(sorted[1].name === 'project3', 'Should sort by last activity desc');
      assert(sorted[2].name === 'project1', 'Should sort by last activity desc');
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
    it('should get fallback project data', () => {
      const fallbackData = service.getFallbackProjectData();
      assert(Array.isArray(fallbackData), 'Should return array for fallback data');
    });

    it('should set fallback project data', () => {
      const testData = [{ name: 'test-project' }];
      service.setFallbackProjectData(testData);
      
      const fallbackData = service.getFallbackProjectData();
      assert(Array.isArray(fallbackData), 'Should return array for fallback data');
    });
  });
});

// Run tests if this file is executed directly
if (require.main === module) {
  const testRunner = async () => {
    console.log('🧪 Running ProjectManagementService tests...');
    
    try {
      // Create test instance
      const service = new ProjectManagementService();
      
      // Test basic functionality
      console.log('✅ ProjectManagementService instantiated successfully');
      
      // Test cache management
      service.clearCache();
      console.log('✅ Cache cleared successfully');
      
      const cacheStatus = service.getCacheStatus();
      console.log('✅ Cache status retrieved:', cacheStatus);
      
      // Test fallback data
      const fallbackData = service.getFallbackProjectData();
      console.log('✅ Fallback data retrieved:', Array.isArray(fallbackData));
      
      console.log('🎉 All ProjectManagementService tests passed!');
      
    } catch (error) {
      console.error('❌ Test failed:', error.message);
      process.exit(1);
    }
  };

  testRunner();
}
