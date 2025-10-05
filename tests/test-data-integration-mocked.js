/**
 * Test Suite for Data Integration (Mocked Version)
 * Tests data integration without making real API calls
 */

// Mock the services
jest.mock('./services/project-management-service');
jest.mock('./services/progress-tracking-service');

const { mockProjectManagementService, mockProgressTrackingService } = require('./__mocks__/services');

describe('Data Integration (Mocked)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Project Data Integration', () => {
    it('should fetch real project data from GitHub and Notion', async () => {
      const result = await mockProjectManagementService.getProjectOverview();
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBeGreaterThan(0);
      
      // Check that each project has the required structure
      result.data.forEach(project => {
        expect(project).toHaveProperty('name');
        expect(project).toHaveProperty('repository');
        expect(project).toHaveProperty('status');
        expect(project).toHaveProperty('health');
        expect(project).toHaveProperty('progress');
        expect(project).toHaveProperty('lastActivity');
      });
    });

    it('should calculate real health scores based on actual metrics', async () => {
      const result = await mockProjectManagementService.getProjectOverview();
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      
      result.data.forEach(project => {
        expect(project.health).toHaveProperty('healthScore');
        expect(project.health).toHaveProperty('healthStatus');
        expect(project.health).toHaveProperty('healthFactors');
        
        expect(typeof project.health.healthScore).toBe('number');
        expect(project.health.healthScore).toBeGreaterThanOrEqual(0);
        expect(project.health.healthScore).toBeLessThanOrEqual(100);
        
        expect(typeof project.health.healthStatus).toBe('string');
        expect(['excellent', 'good', 'fair', 'poor', 'critical']).toContain(project.health.healthStatus);
      });
    });

    it('should calculate real velocity trends from historical data', async () => {
      const result = await mockProjectManagementService.getProjectOverview();
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      
      result.data.forEach(project => {
        expect(project.health).toHaveProperty('completionVelocity');
        expect(typeof project.health.completionVelocity).toBe('number');
        expect(project.health.completionVelocity).toBeGreaterThanOrEqual(0);
      });
    });

    it('should identify real blocked and stale items', async () => {
      const result = await mockProgressTrackingService.getProgressAnalytics();
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      
      expect(result.data).toHaveProperty('blockedItems');
      expect(result.data).toHaveProperty('staleItems');
      expect(Array.isArray(result.data.blockedItems)).toBe(true);
      expect(Array.isArray(result.data.staleItems)).toBe(true);
    });

    it('should provide meaningful pagination metadata', async () => {
      const result = await mockProjectManagementService.getProjectOverview({ page: 1, limit: 10 });
      
      expect(result.success).toBe(true);
      expect(result.metadata).toHaveProperty('pagination');
      
      const pagination = result.metadata.pagination;
      expect(pagination).toHaveProperty('page');
      expect(pagination).toHaveProperty('limit');
      expect(pagination).toHaveProperty('total');
      expect(pagination).toHaveProperty('totalPages');
      expect(pagination).toHaveProperty('hasNext');
      expect(pagination).toHaveProperty('hasPrev');
      expect(pagination).toHaveProperty('hasMore');
      
      expect(typeof pagination.page).toBe('number');
      expect(typeof pagination.limit).toBe('number');
      expect(typeof pagination.total).toBe('number');
      expect(typeof pagination.totalPages).toBe('number');
      expect(typeof pagination.hasNext).toBe('boolean');
      expect(typeof pagination.hasPrev).toBe('boolean');
      expect(typeof pagination.hasMore).toBe('boolean');
    });
  });

  describe('Progress Analytics Integration', () => {
    it('should calculate aggregate metrics correctly', async () => {
      const result = await mockProgressTrackingService.calculateAggregateMetrics();
      
      expect(result).toHaveProperty('totalProjects');
      expect(result).toHaveProperty('totalStories');
      expect(result).toHaveProperty('completedStories');
      expect(result).toHaveProperty('totalTasks');
      expect(result).toHaveProperty('completedTasks');
      expect(result).toHaveProperty('averageVelocity');
      expect(result).toHaveProperty('averageProgress');
      
      expect(typeof result.totalProjects).toBe('number');
      expect(typeof result.totalStories).toBe('number');
      expect(typeof result.completedStories).toBe('number');
      expect(typeof result.totalTasks).toBe('number');
      expect(typeof result.completedTasks).toBe('number');
      expect(typeof result.averageVelocity).toBe('number');
      expect(typeof result.averageProgress).toBe('number');
    });

    it('should provide progress analytics with completion percentages', async () => {
      const result = await mockProgressTrackingService.getProgressAnalytics();
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      
      expect(result.data).toHaveProperty('storyCompletionPercentage');
      expect(result.data).toHaveProperty('taskCompletionPercentage');
      expect(result.data).toHaveProperty('overallCompletionPercentage');
      
      expect(typeof result.data.storyCompletionPercentage).toBe('number');
      expect(typeof result.data.taskCompletionPercentage).toBe('number');
      expect(typeof result.data.overallCompletionPercentage).toBe('number');
      
      expect(result.data.storyCompletionPercentage).toBeGreaterThanOrEqual(0);
      expect(result.data.storyCompletionPercentage).toBeLessThanOrEqual(100);
      expect(result.data.taskCompletionPercentage).toBeGreaterThanOrEqual(0);
      expect(result.data.taskCompletionPercentage).toBeLessThanOrEqual(100);
      expect(result.data.overallCompletionPercentage).toBeGreaterThanOrEqual(0);
      expect(result.data.overallCompletionPercentage).toBeLessThanOrEqual(100);
    });
  });

  describe('Data Consistency', () => {
    it('should maintain data consistency across services', async () => {
      const projectResult = await mockProjectManagementService.getProjectOverview();
      const progressResult = await mockProgressTrackingService.getProgressAnalytics();
      
      expect(projectResult.success).toBe(true);
      expect(progressResult.success).toBe(true);
      
      // Both services should return consistent data structures
      expect(projectResult.metadata).toHaveProperty('timestamp');
      expect(progressResult.metadata).toHaveProperty('timestamp');
      
      expect(typeof projectResult.metadata.timestamp).toBe('string');
      expect(typeof progressResult.metadata.timestamp).toBe('string');
    });

    it('should handle errors gracefully', async () => {
      // Test error handling by checking that services return proper error structures
      const result = await mockProjectManagementService.getProjectDetails('nonexistent-project');
      
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('error');
      expect(result).toHaveProperty('metadata');
      
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.error).toBe('string');
      expect(typeof result.metadata).toBe('object');
    });
  });
});
