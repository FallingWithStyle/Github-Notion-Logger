// Mock implementations for services

const mockProjectData = {
  'test-repo': {
    name: 'Test Project',
    repository: 'test-repo',
    status: 'active',
    category: 'Web Development',
    health: {
      status: 'active',
      healthScore: 85,
      lastActivity: '2025-10-01T10:00:00Z',
      prdStatus: 'present',
      taskListStatus: 'present',
      completionVelocity: 2.5,
      riskFactors: [],
      healthStatus: 'good',
      healthFactors: {
        activity: 80,
        commits: 90,
        prs: 70,
        issues: 60,
        documentation: 100,
        prd: 100
      },
      lastUpdated: '2025-10-01T21:35:00Z'
    },
    progress: 75,
    storiesTotal: 20,
    storiesCompleted: 15,
    tasksTotal: 50,
    tasksCompleted: 40,
    completionPercentage: 75,
    lastActivity: '2025-10-01T10:00:00Z',
    activityStatus: 'recent',
    totalCommits: 150,
    color: '#667eea',
    hasPrd: true,
    hasTaskList: true,
    lastUpdated: '2025-10-01T21:35:00Z'
  }
};

const mockGitHubData = {
  'test-repo': {
    commits: 150,
    prs: 5,
    issues: 3,
    lastActivity: '2025-10-01T10:00:00Z',
    stars: 10,
    forks: 2,
    language: 'JavaScript',
    size: 5000,
    _githubData: {
      name: 'test-repo',
      full_name: 'test/test-repo',
      language: 'JavaScript',
      stargazers_count: 10,
      forks_count: 2,
      size: 5000,
      updated_at: '2025-10-01T10:00:00Z'
    }
  }
};

const mockNotionData = {
  'test-repo': {
    stories: 20,
    tasks: 50,
    lastUpdated: '2025-10-01T10:00:00Z',
    pages: 1,
    databases: 1,
    hasPrd: true,
    hasTaskList: true,
    progress: 75,
    category: 'Web Development',
    status: 'cached',
    _notionData: {
      results: [
        {
          properties: {
            'Project Name': { title: [{ plain_text: 'Test Project' }] },
            'Stories': { number: 20 },
            'Tasks': { number: 50 },
            'Progress': { number: 75 }
          }
        }
      ]
    }
  }
};

// Mock ProjectManagementService
const mockProjectManagementService = {
  getProjectOverview: jest.fn().mockImplementation(async (options = {}) => {
    const { search, limit = 50, page = 1 } = options;
    
    let projects = Object.values(mockProjectData);
    
    if (search) {
      projects = projects.filter(project => 
        project.name.toLowerCase().includes(search.toLowerCase()) ||
        project.repository.toLowerCase().includes(search.toLowerCase())
      );
    }
    
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedProjects = projects.slice(startIndex, endIndex);
    
    return {
      success: true,
      data: paginatedProjects,
      error: null,
      metadata: {
        timestamp: new Date().toISOString(),
        total: projects.length,
        filters: { search, limit },
        pagination: {
          page,
          limit,
          offset: startIndex,
          total: projects.length,
          totalPages: Math.ceil(projects.length / limit),
          hasNext: endIndex < projects.length,
          hasPrev: page > 1,
          hasMore: endIndex < projects.length
        },
        cached: false
      }
    };
  }),
  
  getProjectDetails: jest.fn().mockImplementation(async (projectName) => {
    const project = mockProjectData[projectName];
    if (!project) {
      return {
        success: false,
        data: null,
        error: 'Project not found',
        metadata: { timestamp: new Date().toISOString() }
      };
    }
    
    return {
      success: true,
      data: project,
      error: null,
      metadata: { timestamp: new Date().toISOString() }
    };
  }),
  
  clearCache: jest.fn().mockResolvedValue(true),
  
  fetchGitHubData: jest.fn().mockImplementation(async (projectName) => {
    return mockGitHubData[projectName] || {
      commits: 0,
      prs: 0,
      issues: 0,
      lastActivity: new Date().toISOString(),
      stars: 0,
      forks: 0,
      language: 'Unknown',
      size: 0
    };
  }),
  
  fetchNotionData: jest.fn().mockImplementation(async (projectName) => {
    return mockNotionData[projectName] || {
      stories: 0,
      tasks: 0,
      lastUpdated: new Date().toISOString(),
      pages: 0,
      databases: 0,
      hasPrd: false,
      hasTaskList: false,
      progress: 0,
      category: 'uncategorized',
      status: 'cached'
    };
  })
};

// Mock ProgressTrackingService
const mockProgressTrackingService = {
  getProgressAnalytics: jest.fn().mockImplementation(async (options = {}) => {
    const { projectId, limit = 50, page = 1 } = options;
    
    const mockAnalytics = {
      projectId: projectId || 'test-project',
      projectName: 'Test Project',
      totalStories: 20,
      completedStories: 15,
      totalTasks: 50,
      completedTasks: 40,
      incompleteStories: 5,
      incompleteTasks: 10,
      velocity: 2.5,
      trend: 'increasing',
      blockedItems: [],
      staleItems: [],
      storyCompletionPercentage: 75,
      taskCompletionPercentage: 80,
      overallCompletionPercentage: 78,
      lastUpdated: new Date().toISOString()
    };
    
    return {
      success: true,
      data: mockAnalytics,
      error: null,
      metadata: {
        timestamp: new Date().toISOString(),
        total: 1,
        filters: { projectId, limit },
        pagination: {
          page,
          limit,
          offset: 0,
          total: 1,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
          hasMore: false
        },
        cached: false
      }
    };
  }),
  
  clearCache: jest.fn().mockResolvedValue(true),
  
  calculateAggregateMetrics: jest.fn().mockResolvedValue({
    totalProjects: 1,
    totalStories: 20,
    completedStories: 15,
    totalTasks: 50,
    completedTasks: 40,
    averageVelocity: 2.5,
    averageProgress: 75
  })
};

// Mock DataConsistencyService
const mockDataConsistencyService = {
  reconcileProjectData: jest.fn().mockImplementation(async (projectName) => {
    return {
      success: true,
      data: {
        name: projectName,
        status: 'reconciled',
        lastUpdated: new Date().toISOString()
      },
      error: null
    };
  }),
  
  validateDataIntegrity: jest.fn().mockResolvedValue({
    isValid: true,
    issues: [],
    lastChecked: new Date().toISOString()
  })
};

// Mock ErrorHandlingService
const mockErrorHandlingService = {
  handleError: jest.fn().mockImplementation((error, context) => {
    return {
      success: false,
      error: error.message || 'Unknown error',
      context,
      timestamp: new Date().toISOString(),
      handled: true
    };
  }),
  
  logError: jest.fn().mockResolvedValue(true)
};

// Mock PerformanceOptimizationService
const mockPerformanceOptimizationService = {
  optimizeCache: jest.fn().mockResolvedValue({
    success: true,
    optimized: true,
    cacheSize: 1024,
    lastOptimized: new Date().toISOString()
  }),
  
  getPerformanceMetrics: jest.fn().mockResolvedValue({
    responseTime: 150,
    cacheHitRate: 0.85,
    memoryUsage: 50,
    lastMeasured: new Date().toISOString()
  })
};

module.exports = {
  mockProjectManagementService,
  mockProgressTrackingService,
  mockDataConsistencyService,
  mockErrorHandlingService,
  mockPerformanceOptimizationService,
  mockProjectData,
  mockGitHubData,
  mockNotionData
};
