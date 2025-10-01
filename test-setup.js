// Global test setup and mocks

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
};

// Mock environment variables
process.env.NOTION_API_KEY = 'test-notion-key';
process.env.NOTION_COMMIT_FROM_GITHUB_LOG_ID = 'test-database-id';
process.env.NOTION_WANDERLOG_DATABASE_ID = 'test-wanderlog-id';
process.env.GITHUB_TOKEN = 'test-github-token';

// Mock GitHub API responses
const mockGitHubData = {
  commits: [
    {
      sha: 'abc123',
      commit: {
        message: 'Test commit message',
        author: {
          name: 'Test Author',
          email: 'test@example.com',
          date: '2025-10-01T10:00:00Z'
        }
      },
      html_url: 'https://github.com/test/repo/commit/abc123'
    }
  ],
  pulls: [],
  issues: [],
  repository: {
    name: 'test-repo',
    full_name: 'test/test-repo',
    language: 'JavaScript',
    stargazers_count: 5,
    forks_count: 2,
    size: 1000,
    updated_at: '2025-10-01T10:00:00Z'
  }
};

// Mock Notion API responses
const mockNotionData = {
  results: [
    {
      id: 'test-page-id',
      properties: {
        'Project Name': { title: [{ plain_text: 'Test Project' }] },
        'SHA': { rich_text: [{ plain_text: 'abc123' }] },
        'Commits': { rich_text: [{ plain_text: 'Test commit message' }] },
        'Date': { date: { start: '2025-10-01' } }
      }
    }
  ],
  next_cursor: null,
  has_more: false
};

// Mock the GitHub client
jest.mock('@octokit/rest', () => {
  return {
    Octokit: jest.fn().mockImplementation(() => ({
      rest: {
        repos: {
          listCommits: jest.fn().mockResolvedValue({ data: mockGitHubData.commits }),
          get: jest.fn().mockResolvedValue({ data: mockGitHubData.repository }),
          listPullRequests: jest.fn().mockResolvedValue({ data: mockGitHubData.pulls }),
          listIssues: jest.fn().mockResolvedValue({ data: mockGitHubData.issues })
        }
      }
    }))
  };
});

// Mock the Notion client
jest.mock('@notionhq/client', () => {
  return {
    Client: jest.fn().mockImplementation(() => ({
      databases: {
        query: jest.fn().mockResolvedValue(mockNotionData),
        retrieve: jest.fn().mockResolvedValue({
          id: 'test-database-id',
          title: [{ plain_text: 'Test Database' }],
          properties: {
            'Project Name': { type: 'title' },
            'SHA': { type: 'rich_text' },
            'Commits': { type: 'rich_text' },
            'Date': { type: 'date' }
          }
        })
      },
      pages: {
        create: jest.fn().mockResolvedValue({ id: 'test-page-id' })
      }
    }))
  };
});

// Mock OpenAI
jest.mock('openai', () => {
  return {
    OpenAI: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [{
              message: {
                content: 'Mocked AI response'
              }
            }]
          })
        }
      }
    }))
  };
});

// Mock inquirer
jest.mock('inquirer', () => ({
  prompt: jest.fn().mockResolvedValue({ selectedRepos: ['test-repo'] })
}));

// Mock services
jest.mock('./services/project-management-service', () => require('./__mocks__/services').mockProjectManagementService);
jest.mock('./services/progress-tracking-service', () => require('./__mocks__/services').mockProgressTrackingService);
jest.mock('./services/data-consistency-service', () => require('./__mocks__/services').mockDataConsistencyService);
jest.mock('./services/error-handling-service', () => require('./__mocks__/services').mockErrorHandlingService);
jest.mock('./services/performance-optimization-service', () => require('./__mocks__/services').mockPerformanceOptimizationService);

// Mock wanderlog processor
jest.mock('./wanderlog-processor', () => require('./__mocks__/wanderlog-processor').mockWanderlogProcessor);

// Global test utilities
global.mockGitHubData = mockGitHubData;
global.mockNotionData = mockNotionData;
