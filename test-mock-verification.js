/**
 * Test to verify that our mocking setup works correctly
 */

const { mockProjectManagementService } = require('./__mocks__/services');
const { mockWanderlogProcessor } = require('./__mocks__/wanderlog-processor');

describe('Mock Verification Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Project Management Service Mock', () => {
    it('should return mock project data', async () => {
      const result = await mockProjectManagementService.getProjectOverview();
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.metadata).toBeDefined();
      expect(result.metadata.total).toBeGreaterThan(0);
    });

    it('should filter projects by search term', async () => {
      const result = await mockProjectManagementService.getProjectOverview({ search: 'test' });
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.metadata.filters.search).toBe('test');
    });

    it('should handle pagination', async () => {
      const result = await mockProjectManagementService.getProjectOverview({ page: 1, limit: 10 });
      
      expect(result.success).toBe(true);
      expect(result.metadata.pagination.page).toBe(1);
      expect(result.metadata.pagination.limit).toBe(10);
    });
  });

  describe('Wanderlog Processor Mock', () => {
    it('should return mock wanderlog entries', async () => {
      const result = await mockWanderlogProcessor.fetchWanderlogEntries();
      
      expect(result.success).toBe(true);
      expect(result.entries).toBeDefined();
      expect(Array.isArray(result.entries)).toBe(true);
      expect(result.count).toBeGreaterThan(0);
    });

    it('should create wanderlog entries', async () => {
      const entryData = {
        title: 'Test Entry',
        summary: 'Test summary',
        insights: 'Test insights',
        focusAreas: 'Testing'
      };
      
      const result = await mockWanderlogProcessor.createWanderlogEntry(entryData);
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.title).toBe('Test Entry');
    });

    it('should filter significant commits', () => {
      const commits = [
        { message: 'Add new feature' },
        { message: 'fix typo' },
        { message: 'console.log debug' },
        { message: 'Merge branch feature' },
        { message: 'Implement database migration' }
      ];
      
      const filtered = mockWanderlogProcessor.filterSignificantCommits(commits);
      
      expect(filtered).toHaveLength(2);
      expect(filtered[0].message).toBe('Add new feature');
      expect(filtered[1].message).toBe('Implement database migration');
    });
  });

  describe('External API Mocks', () => {
    it('should mock GitHub API calls', async () => {
      const { Octokit } = require('@octokit/rest');
      const octokit = new Octokit();
      
      const commits = await octokit.rest.repos.listCommits({
        owner: 'test',
        repo: 'test-repo'
      });
      
      expect(commits.data).toBeDefined();
      expect(Array.isArray(commits.data)).toBe(true);
    });

    it('should mock Notion API calls', async () => {
      const { Client } = require('@notionhq/client');
      const notion = new Client({ auth: 'test-key' });
      
      const database = await notion.databases.retrieve({
        database_id: 'test-database-id'
      });
      
      expect(database.id).toBe('test-database-id');
      expect(database.title).toBeDefined();
    });
  });
});
