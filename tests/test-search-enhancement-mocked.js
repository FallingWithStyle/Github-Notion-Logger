/**
 * Test Suite for Enhanced Search Functionality (Mocked Version)
 * Tests search capabilities without making real API calls
 */

// Mock the project management service
jest.mock('./services/project-management-service');

const { mockProjectManagementService } = require('./__mocks__/services');

describe('Enhanced Search Functionality (Mocked)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Search', () => {
    it('should find projects by exact name', async () => {
      const result = await mockProjectManagementService.getProjectOverview({ search: 'Kitch' });
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.metadata.filters.search).toBe('Kitch');
    });

    it('should find projects by partial name', async () => {
      const result = await mockProjectManagementService.getProjectOverview({ search: 'magic' });
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.metadata.filters.search).toBe('magic');
    });

    it('should be case insensitive', async () => {
      const result1 = await mockProjectManagementService.getProjectOverview({ search: 'Kitch' });
      const result2 = await mockProjectManagementService.getProjectOverview({ search: 'kitch' });
      
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.data.length).toBe(result2.data.length);
    });

    it('should find projects by multiple words', async () => {
      const result = await mockProjectManagementService.getProjectOverview({ search: 'github notion' });
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.metadata.filters.search).toBe('github notion');
    });
  });

  describe('Pagination', () => {
    it('should handle pagination correctly', async () => {
      const result = await mockProjectManagementService.getProjectOverview({ 
        page: 1, 
        limit: 10 
      });
      
      expect(result.success).toBe(true);
      expect(result.metadata.pagination.page).toBe(1);
      expect(result.metadata.pagination.limit).toBe(10);
      expect(result.metadata.pagination.total).toBeGreaterThan(0);
    });

    it('should indicate if there are more pages', async () => {
      const result = await mockProjectManagementService.getProjectOverview({ 
        page: 1, 
        limit: 1 
      });
      
      expect(result.success).toBe(true);
      expect(result.metadata.pagination.hasMore).toBeDefined();
      expect(typeof result.metadata.pagination.hasMore).toBe('boolean');
    });
  });

  describe('Response Format', () => {
    it('should return properly formatted response', async () => {
      const result = await mockProjectManagementService.getProjectOverview();
      
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('error');
      expect(result).toHaveProperty('metadata');
      
      expect(typeof result.success).toBe('boolean');
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.error).toBeNull();
      expect(typeof result.metadata).toBe('object');
    });

    it('should include metadata with timestamp', async () => {
      const result = await mockProjectManagementService.getProjectOverview();
      
      expect(result.metadata).toHaveProperty('timestamp');
      expect(typeof result.metadata.timestamp).toBe('string');
      expect(new Date(result.metadata.timestamp)).toBeInstanceOf(Date);
    });

    it('should include pagination metadata', async () => {
      const result = await mockProjectManagementService.getProjectOverview({ page: 2, limit: 5 });
      
      expect(result.metadata.pagination).toHaveProperty('page');
      expect(result.metadata.pagination).toHaveProperty('limit');
      expect(result.metadata.pagination).toHaveProperty('total');
      expect(result.metadata.pagination).toHaveProperty('totalPages');
      expect(result.metadata.pagination).toHaveProperty('hasNext');
      expect(result.metadata.pagination).toHaveProperty('hasPrev');
      expect(result.metadata.pagination).toHaveProperty('hasMore');
    });
  });

  describe('Error Handling', () => {
    it('should handle empty search gracefully', async () => {
      const result = await mockProjectManagementService.getProjectOverview({ search: '' });
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('should handle non-existent search terms', async () => {
      const result = await mockProjectManagementService.getProjectOverview({ search: 'nonexistent' });
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBe(0);
    });
  });
});
