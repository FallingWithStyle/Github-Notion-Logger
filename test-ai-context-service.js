/**
 * Unit Tests for AIContextService - Epic 10 TDD Implementation
 * Tests cover all methods and edge cases for AI context aggregation
 */

const AIContextService = require('./services/ai-context-service');
const ProjectManagementService = require('./services/project-management-service');
const ProgressTrackingService = require('./services/progress-tracking-service');
const DataConsistencyService = require('./services/data-consistency-service');
const PerformanceOptimizationService = require('./services/performance-optimization-service');
const ErrorHandlingService = require('./services/error-handling-service');

// Mock dependencies
jest.mock('./services/project-management-service');
jest.mock('./services/progress-tracking-service');
jest.mock('./services/data-consistency-service');
jest.mock('./services/performance-optimization-service');
jest.mock('./services/error-handling-service');

describe('AIContextService', () => {
  let aiContextService;
  let mockProjectService;
  let mockProgressService;
  let mockConsistencyService;
  let mockPerformanceOptimizer;
  let mockErrorHandler;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Create mock instances
    mockProjectService = {
      getProjectOverview: jest.fn(),
      getProjectHealth: jest.fn()
    };
    
    mockProgressService = {
      getProgressAnalytics: jest.fn()
    };
    
    mockConsistencyService = {};
    mockPerformanceOptimizer = {};
    mockErrorHandler = {};

    // Mock constructors
    ProjectManagementService.mockImplementation(() => mockProjectService);
    ProgressTrackingService.mockImplementation(() => mockProgressService);
    DataConsistencyService.mockImplementation(() => mockConsistencyService);
    PerformanceOptimizationService.mockImplementation(() => mockPerformanceOptimizer);
    ErrorHandlingService.mockImplementation(() => mockErrorHandler);

    // Create service instance
    aiContextService = new AIContextService();
  });

  describe('getProjectContext', () => {
    it('should return cached context when available', async () => {
      // Arrange
      const projectName = 'test-project';
      const contextType = 'general';
      const cachedContext = {
        type: 'project',
        contextType: 'general',
        project: { name: projectName }
      };
      
      // Mock cache hit
      aiContextService.setCachedContext(`project:${projectName}:${contextType}`, cachedContext);

      // Act
      const result = await aiContextService.getProjectContext(projectName, contextType);

      // Assert
      expect(result).toEqual(cachedContext);
      expect(mockProjectService.getProjectOverview).not.toHaveBeenCalled();
    });

    it('should fetch and format project context when not cached', async () => {
      // Arrange
      const projectName = 'test-project';
      const contextType = 'general';
      const mockProjectData = {
        name: projectName,
        repository: 'test/repo',
        status: 'active',
        category: 'development',
        health: { healthScore: 85 },
        lastActivity: '2024-01-15T10:30:00Z',
        completionPercentage: 75,
        totalCommits: 100,
        activityStatus: 'active',
        storiesCompleted: 15,
        storiesTotal: 20,
        tasksCompleted: 40,
        tasksTotal: 50,
        hasPrd: true,
        hasTaskList: true
      };
      
      const mockProgressData = {
        projects: [{
          projectName: projectName,
          velocity: 2.5,
          trend: 'increasing'
        }]
      };
      
      const mockHealthData = {
        data: {
          status: 'healthy',
          healthScore: 85,
          riskFactors: [],
          lastUpdated: '2024-01-15T10:30:00Z'
        }
      };

      mockProjectService.getProjectOverview.mockResolvedValue({
        data: [mockProjectData]
      });
      mockProgressService.getProgressAnalytics.mockResolvedValue({
        data: mockProgressData
      });
      mockProjectService.getProjectHealth.mockResolvedValue(mockHealthData);

      // Act
      const result = await aiContextService.getProjectContext(projectName, contextType);

      // Assert
      expect(result.type).toBe('project');
      expect(result.contextType).toBe('general');
      expect(result.project.name).toBe(projectName);
      expect(result.project.healthScore).toBe(85);
      expect(result.progress.completionPercentage).toBe(75);
      expect(mockProjectService.getProjectOverview).toHaveBeenCalledWith({ search: projectName, limit: 1 });
    });

    it('should handle missing project data gracefully', async () => {
      // Arrange
      const projectName = 'nonexistent-project';
      const contextType = 'general';

      mockProjectService.getProjectOverview.mockResolvedValue({
        data: []
      });

      // Act
      const result = await aiContextService.getProjectContext(projectName, contextType);

      // Assert
      expect(result.error).toBeDefined();
      expect(result.error.fallback).toBe(true);
      expect(result.recommendations).toContain('Check project data availability');
    });

    it('should format planning context correctly', async () => {
      // Arrange
      const projectName = 'test-project';
      const contextType = 'planning';
      const mockProjectData = {
        name: projectName,
        hasPrd: true,
        hasTaskList: true,
        health: { riskFactors: ['No recent activity'] }
      };

      mockProjectService.getProjectOverview.mockResolvedValue({
        data: [mockProjectData]
      });
      mockProgressService.getProgressAnalytics.mockResolvedValue({
        data: { projects: [] }
      });
      mockProjectService.getProjectHealth.mockResolvedValue({
        data: { status: 'healthy' }
      });

      // Act
      const result = await aiContextService.getProjectContext(projectName, contextType);

      // Assert
      expect(result.planning).toBeDefined();
      expect(result.planning.prdStatus).toBe('present');
      expect(result.planning.taskListStatus).toBe('present');
      expect(result.planning.blockers).toEqual(['No recent activity']);
    });

    it('should format productivity context correctly', async () => {
      // Arrange
      const projectName = 'test-project';
      const contextType = 'productivity';
      const mockProjectData = {
        name: projectName,
        lastActivity: '2024-01-15T10:30:00Z',
        totalCommits: 50
      };
      
      const mockProgressData = {
        projects: [{
          projectName: projectName,
          velocity: 3.0,
          trend: 'increasing'
        }]
      };

      mockProjectService.getProjectOverview.mockResolvedValue({
        data: [mockProjectData]
      });
      mockProgressService.getProgressAnalytics.mockResolvedValue({
        data: mockProgressData
      });
      mockProjectService.getProjectHealth.mockResolvedValue({
        data: { status: 'healthy' }
      });

      // Act
      const result = await aiContextService.getProjectContext(projectName, contextType);

      // Assert
      expect(result.productivity).toBeDefined();
      expect(result.productivity.velocity).toBe(3.0);
      expect(result.productivity.trend).toBe('increasing');
      expect(result.productivity.recentActivity).toBeDefined();
    });

    it('should format quality context correctly', async () => {
      // Arrange
      const projectName = 'test-project';
      const contextType = 'quality';
      const mockProjectData = {
        name: projectName,
        hasPrd: true,
        hasTaskList: false,
        activityStatus: 'active',
        totalCommits: 100
      };

      mockProjectService.getProjectOverview.mockResolvedValue({
        data: [mockProjectData]
      });
      mockProgressService.getProgressAnalytics.mockResolvedValue({
        data: { projects: [] }
      });
      mockProjectService.getProjectHealth.mockResolvedValue({
        data: { status: 'healthy' }
      });

      // Act
      const result = await aiContextService.getProjectContext(projectName, contextType);

      // Assert
      expect(result.quality).toBeDefined();
      expect(result.quality.documentation.prdPresent).toBe(true);
      expect(result.quality.documentation.taskListPresent).toBe(false);
      expect(result.quality.codeQuality).toBeDefined();
    });

    it('should handle service failures gracefully', async () => {
      // Arrange
      const projectName = 'test-project';
      const contextType = 'general';

      mockProjectService.getProjectOverview.mockRejectedValue(new Error('Service unavailable'));

      // Act
      const result = await aiContextService.getProjectContext(projectName, contextType);

      // Assert
      expect(result.error).toBeDefined();
      expect(result.error.message).toBe('Cannot read properties of undefined (reading \'data\')');
      expect(result.recommendations).toContain('Check project data availability');
    });
  });

  describe('getPortfolioContext', () => {
    it('should return cached portfolio context when available', async () => {
      // Arrange
      const filters = { status: 'active' };
      const cachedContext = {
        type: 'portfolio',
        summary: { totalProjects: 5 }
      };
      
      aiContextService.setCachedContext(`portfolio:${JSON.stringify(filters)}`, cachedContext);

      // Act
      const result = await aiContextService.getPortfolioContext(filters);

      // Assert
      expect(result).toEqual(cachedContext);
      expect(mockProjectService.getProjectOverview).not.toHaveBeenCalled();
    });

    it('should fetch and format portfolio context when not cached', async () => {
      // Arrange
      const filters = { status: 'active' };
      const mockProjects = [
        {
          name: 'project1',
          status: 'active',
          health: { healthScore: 80 },
          completionPercentage: 60,
          lastActivity: '2024-01-15T10:30:00Z',
          category: 'development'
        },
        {
          name: 'project2',
          status: 'active',
          health: { healthScore: 90 },
          completionPercentage: 80,
          lastActivity: '2024-01-14T09:15:00Z',
          category: 'research'
        }
      ];
      
      const mockProgressData = {
        projects: [],
        aggregate: {
          totalStories: 50,
          completedStories: 30
        }
      };

      mockProjectService.getProjectOverview.mockResolvedValue({
        data: mockProjects
      });
      mockProgressService.getProgressAnalytics.mockResolvedValue({
        data: mockProgressData
      });

      // Act
      const result = await aiContextService.getPortfolioContext(filters);

      // Assert
      expect(result.type).toBe('portfolio');
      expect(result.summary.totalProjects).toBe(2);
      expect(result.summary.activeProjects).toBe(2);
      expect(result.summary.averageHealthScore).toBe(85);
      expect(result.projects).toHaveLength(2);
      expect(result.aggregate).toEqual(mockProgressData.aggregate);
    });

    it('should handle empty portfolio data', async () => {
      // Arrange
      const filters = { status: 'inactive' };

      mockProjectService.getProjectOverview.mockResolvedValue({
        data: []
      });
      mockProgressService.getProgressAnalytics.mockResolvedValue({
        data: { projects: [], aggregate: {} }
      });

      // Act
      const result = await aiContextService.getPortfolioContext(filters);

      // Assert
      expect(result.type).toBe('portfolio');
      expect(result.summary.totalProjects).toBe(0);
      expect(result.summary.activeProjects).toBe(0);
      expect(result.summary.averageHealthScore).toBe(0);
    });
  });

  describe('getQuickWinsContext', () => {
    it('should return cached quick wins context when available', async () => {
      // Arrange
      const filters = { status: 'active' };
      const cachedContext = {
        type: 'quickWins',
        analysis: { quickWins: [] }
      };
      
      aiContextService.setCachedContext(`quickwins:${JSON.stringify(filters)}`, cachedContext);

      // Act
      const result = await aiContextService.getQuickWinsContext(filters);

      // Assert
      expect(result).toEqual(cachedContext);
      expect(mockProgressService.getProgressAnalytics).not.toHaveBeenCalled();
    });

    it('should analyze quick wins from progress data', async () => {
      // Arrange
      const filters = { status: 'active' };
      const mockProgressData = {
        success: true,
        data: {
          projects: [
            {
              projectName: 'project1',
              incompleteStories: 2,
              incompleteTasks: 3,
              overallCompletionPercentage: 80,
              velocity: 2.0,
              healthScore: 85
            },
            {
              projectName: 'project2',
              incompleteStories: 1,
              incompleteTasks: 1,
              overallCompletionPercentage: 90,
              velocity: 3.0,
              healthScore: 90
            }
          ],
          aggregate: {
            incompleteStories: 3,
            incompleteTasks: 4
          }
        }
      };

      mockProgressService.getProgressAnalytics.mockResolvedValue(mockProgressData);

      // Act
      const result = await aiContextService.getQuickWinsContext(filters);

      // Assert
      expect(result.type).toBe('quickWins');
      expect(result.analysis.quickWins).toHaveLength(2);
      expect(result.analysis.totalProjects).toBe(2);
      expect(result.analysis.totalIncompleteStories).toBe(3);
      expect(result.analysis.totalIncompleteTasks).toBe(4);
      
      // Check quick wins are sorted by score
      const quickWins = result.analysis.quickWins;
      expect(quickWins[0].quickWinScore).toBeGreaterThanOrEqual(quickWins[1].quickWinScore);
    });

    it('should handle missing progress data', async () => {
      // Arrange
      const filters = { status: 'active' };

      mockProgressService.getProgressAnalytics.mockResolvedValue({
        success: false,
        data: null
      });

      // Act
      const result = await aiContextService.getQuickWinsContext(filters);

      // Assert
      expect(result.error).toBeDefined();
      expect(result.error.fallback).toBe(true);
      expect(result.recommendations).toContain('Check progress data availability');
    });
  });

  describe('getFocusAreasContext', () => {
    it('should analyze focus areas from project data', async () => {
      // Arrange
      const filters = { status: 'active' };
      const mockProjects = [
        {
          name: 'low-health-project',
          status: 'active',
          health: { healthScore: 30 },
          completionPercentage: 20
        },
        {
          name: 'stale-project',
          status: 'active',
          activityStatus: 'stale',
          completionPercentage: 50
        },
        {
          name: 'near-completion-project',
          status: 'active',
          health: { healthScore: 85 },
          completionPercentage: 85
        }
      ];
      
      const mockProgressData = {
        data: {
          projects: [
            { projectName: 'low-health-project' },
            { projectName: 'stale-project' },
            { projectName: 'near-completion-project' }
          ]
        }
      };

      mockProjectService.getProjectOverview.mockResolvedValue({
        data: mockProjects
      });
      mockProgressService.getProgressAnalytics.mockResolvedValue(mockProgressData);

      // Act
      const result = await aiContextService.getFocusAreasContext(filters);

      // Assert
      expect(result.type).toBe('focusAreas');
      expect(result.analysis.focusAreas).toHaveLength(3);
      expect(result.analysis.totalProjects).toBe(3);
      expect(result.analysis.healthDistribution).toBeDefined();
      
      // Check focus areas are prioritized correctly
      const focusAreas = result.analysis.focusAreas;
      const priorities = focusAreas.map(fa => fa.priority);
      expect(priorities).toContain('high');
      expect(priorities).toContain('medium');
    });
  });

  describe('analyzeQuickWins', () => {
    it('should calculate quick win scores correctly', () => {
      // Arrange
      const projects = [
        {
          projectName: 'high-score-project',
          incompleteStories: 1,
          incompleteTasks: 1,
          overallCompletionPercentage: 85,
          velocity: 3.0,
          healthScore: 90
        },
        {
          projectName: 'low-score-project',
          incompleteStories: 10,
          incompleteTasks: 15,
          overallCompletionPercentage: 20,
          velocity: 0.5,
          healthScore: 40
        }
      ];

      // Act
      const result = aiContextService.analyzeQuickWins(projects);

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].project).toBe('high-score-project');
      expect(result[0].quickWinScore).toBeGreaterThan(result[1].quickWinScore);
      expect(result[0].estimatedEffort).toBeDefined();
      expect(result[0].impact).toBeDefined();
    });

    it('should filter out projects with no incomplete work', () => {
      // Arrange
      const projects = [
        {
          projectName: 'completed-project',
          incompleteStories: 0,
          incompleteTasks: 0,
          overallCompletionPercentage: 100
        },
        {
          projectName: 'incomplete-project',
          incompleteStories: 2,
          incompleteTasks: 1,
          overallCompletionPercentage: 70
        }
      ];

      // Act
      const result = aiContextService.analyzeQuickWins(projects);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].project).toBe('incomplete-project');
    });
  });

  describe('analyzeFocusAreas', () => {
    it('should identify low health projects', () => {
      // Arrange
      const projects = [
        { name: 'healthy-project', health: { healthScore: 80 } },
        { name: 'low-health-project', health: { healthScore: 30 } },
        { name: 'another-low-health', health: { healthScore: 40 } }
      ];
      const progressData = [];

      // Act
      const result = aiContextService.analyzeFocusAreas(projects, progressData);

      // Assert
      const lowHealthArea = result.find(fa => fa.type === 'health');
      expect(lowHealthArea).toBeDefined();
      expect(lowHealthArea.priority).toBe('high');
      expect(lowHealthArea.projects).toContain('low-health-project');
      expect(lowHealthArea.projects).toContain('another-low-health');
    });

    it('should identify inactive projects', () => {
      // Arrange
      const projects = [
        { name: 'active-project', activityStatus: 'active' },
        { name: 'stale-project', activityStatus: 'stale' },
        { name: 'inactive-project', activityStatus: 'inactive' }
      ];
      const progressData = [];

      // Act
      const result = aiContextService.analyzeFocusAreas(projects, progressData);

      // Assert
      const activityArea = result.find(fa => fa.type === 'activity');
      expect(activityArea).toBeDefined();
      expect(activityArea.priority).toBe('medium');
      expect(activityArea.projects).toContain('stale-project');
      expect(activityArea.projects).toContain('inactive-project');
    });

    it('should identify near completion projects', () => {
      // Arrange
      const projects = [
        { name: 'early-project', completionPercentage: 20 },
        { name: 'near-complete-project', completionPercentage: 85 },
        { name: 'almost-done-project', completionPercentage: 95 }
      ];
      const progressData = [];

      // Act
      const result = aiContextService.analyzeFocusAreas(projects, progressData);

      // Assert
      const completionArea = result.find(fa => fa.type === 'completion');
      expect(completionArea).toBeDefined();
      expect(completionArea.priority).toBe('high');
      expect(completionArea.projects).toContain('near-complete-project');
      expect(completionArea.projects).toContain('almost-done-project');
    });
  });

  describe('calculateQuickWinScore', () => {
    it('should calculate score based on completion, work, and velocity', () => {
      // Act & Assert
      const highScore = aiContextService.calculateQuickWinScore(85, 2, 3.0);
      const lowScore = aiContextService.calculateQuickWinScore(20, 15, 0.5);
      
      expect(highScore).toBeGreaterThan(lowScore);
      expect(highScore).toBeGreaterThan(0);
      expect(highScore).toBeLessThanOrEqual(100);
    });

    it('should cap completion rate at 90% for scoring', () => {
      // Act
      const score95 = aiContextService.calculateQuickWinScore(95, 5, 2.0);
      const score90 = aiContextService.calculateQuickWinScore(90, 5, 2.0);
      
      // Assert
      expect(score95).toBeLessThanOrEqual(score90);
    });
  });

  describe('calculateAverageHealthScore', () => {
    it('should calculate average health score correctly', () => {
      // Arrange
      const projects = [
        { health: { healthScore: 80 } },
        { health: { healthScore: 60 } },
        { health: { healthScore: 100 } }
      ];

      // Act
      const result = aiContextService.calculateAverageHealthScore(projects);

      // Assert
      expect(result).toBe(80); // (80 + 60 + 100) / 3 = 80
    });

    it('should return 0 for empty projects array', () => {
      // Act
      const result = aiContextService.calculateAverageHealthScore([]);

      // Assert
      expect(result).toBe(0);
    });

    it('should handle projects with missing health scores', () => {
      // Arrange
      const projects = [
        { health: { healthScore: 80 } },
        { health: null },
        { health: { healthScore: 60 } }
      ];

      // Act
      const result = aiContextService.calculateAverageHealthScore(projects);

      // Assert
      expect(result).toBe(47); // (80 + 0 + 60) / 3 = 46.67, rounded to 47
    });
  });

  describe('calculateHealthDistribution', () => {
    it('should categorize projects by health score ranges', () => {
      // Arrange
      const projects = [
        { health: { healthScore: 90 } }, // excellent
        { health: { healthScore: 70 } }, // good
        { health: { healthScore: 50 } }, // fair
        { health: { healthScore: 30 } }, // poor
        { health: { healthScore: 10 } }  // critical
      ];

      // Act
      const result = aiContextService.calculateHealthDistribution(projects);

      // Assert
      expect(result.excellent).toBe(1);
      expect(result.good).toBe(1);
      expect(result.fair).toBe(1);
      expect(result.poor).toBe(1);
      expect(result.critical).toBe(1);
    });

    it('should handle projects with missing health scores', () => {
      // Arrange
      const projects = [
        { health: { healthScore: 80 } },
        { health: null },
        { health: { healthScore: 40 } }
      ];

      // Act
      const result = aiContextService.calculateHealthDistribution(projects);

      // Assert
      expect(result.excellent).toBe(1);
      expect(result.good).toBe(0);
      expect(result.fair).toBe(1);
      expect(result.poor).toBe(0);
      expect(result.critical).toBe(1); // null health score treated as 0
    });
  });

  describe('cache management', () => {
    it('should cache context with proper key format', () => {
      // Arrange
      const key = 'test-key';
      const data = { test: 'data' };

      // Act
      aiContextService.setCachedContext(key, data);
      const result = aiContextService.getCachedContext(key);

      // Assert
      expect(result).toEqual(data);
    });

    it('should return null for expired cache entries', () => {
      // Arrange
      const key = 'expired-key';
      const data = { test: 'data' };
      
      // Mock Date.now to simulate time passage
      const originalNow = Date.now;
      let currentTime = 1000000;
      Date.now = jest.fn(() => currentTime);

      aiContextService.setCachedContext(key, data);
      
      // Simulate time passage beyond timeout
      currentTime += 3 * 60 * 1000; // 3 minutes, beyond 2-minute timeout

      // Act
      const result = aiContextService.getCachedContext(key);

      // Assert
      expect(result).toBeNull();

      // Restore original Date.now
      Date.now = originalNow;
    });

    it('should validate context size and warn if too large', () => {
      // Arrange
      const largeContext = {
        data: 'x'.repeat(11 * 1024 * 1024) // 11MB, exceeds 10MB limit
      };

      // Spy on console.warn
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Act
      aiContextService.validateContextSize(largeContext);

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Context size')
      );

      // Cleanup
      consoleSpy.mockRestore();
    });
  });

  describe('fallback context creation', () => {
    it('should create fallback project context', () => {
      // Arrange
      const projectName = 'test-project';
      const contextType = 'general';
      const error = 'Test error';

      // Act
      const result = aiContextService.createFallbackContext(projectName, contextType, error);

      // Assert
      expect(result.type).toBe('project');
      expect(result.contextType).toBe('general');
      expect(result.project.name).toBe(projectName);
      expect(result.error.message).toBe(error);
      expect(result.error.fallback).toBe(true);
      expect(result.recommendations).toContain('Check project data availability');
    });

    it('should create fallback portfolio context', () => {
      // Arrange
      const filters = { status: 'active' };
      const error = 'Test error';

      // Act
      const result = aiContextService.createFallbackPortfolioContext(filters, error);

      // Assert
      expect(result.type).toBe('portfolio');
      expect(result.summary.totalProjects).toBe(0);
      expect(result.error.message).toBe(error);
      expect(result.error.fallback).toBe(true);
      expect(result.recommendations).toContain('Check data service availability');
    });

    it('should create fallback quick wins context', () => {
      // Arrange
      const filters = { status: 'active' };
      const error = 'Test error';

      // Act
      const result = aiContextService.createFallbackQuickWinsContext(filters, error);

      // Assert
      expect(result.type).toBe('quickWins');
      expect(result.analysis.quickWins).toHaveLength(0);
      expect(result.error.message).toBe(error);
      expect(result.error.fallback).toBe(true);
      expect(result.recommendations).toContain('Check progress data availability');
    });

    it('should create fallback focus areas context', () => {
      // Arrange
      const filters = { status: 'active' };
      const error = 'Test error';

      // Act
      const result = aiContextService.createFallbackFocusAreasContext(filters, error);

      // Assert
      expect(result.type).toBe('focusAreas');
      expect(result.analysis.focusAreas).toHaveLength(0);
      expect(result.error.message).toBe(error);
      expect(result.error.fallback).toBe(true);
      expect(result.recommendations).toContain('Check project data availability');
    });
  });

  describe('utility methods', () => {
    it('should calculate recent activity correctly', () => {
      // Arrange
      const projectData = {
        lastActivity: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
        totalCommits: 50
      };

      // Act
      const result = aiContextService.calculateRecentActivity(projectData);

      // Assert
      expect(result.daysSinceActivity).toBe(2);
      expect(result.activityLevel).toBe('medium');
      expect(result.totalCommits).toBe(50);
    });

    it('should calculate efficiency metrics', () => {
      // Arrange
      const projectData = { completionPercentage: 60 };
      const progressData = { velocity: 2.0 };

      // Act
      const result = aiContextService.calculateEfficiency(projectData, progressData);

      // Assert
      expect(result.completionRate).toBe(60);
      expect(result.velocity).toBe(2.0);
      expect(result.estimatedTimeToComplete).toBe(20); // (100 - 60) / 2
      expect(result.efficiency).toBeDefined();
    });

    it('should assess code quality indicators', () => {
      // Arrange
      const projectData = {
        totalCommits: 100,
        lastActivity: new Date().toISOString(),
        hasPrd: true,
        hasTaskList: false,
        activityStatus: 'active'
      };

      // Act
      const result = aiContextService.assessCodeQuality(projectData);

      // Assert
      expect(result.commitFrequency).toBe('daily');
      expect(result.documentation.prdPresent).toBe(true);
      expect(result.documentation.taskListPresent).toBe(false);
      expect(result.activity).toBe('active');
    });

    it('should estimate effort correctly', () => {
      // Act & Assert
      expect(aiContextService.estimateEffort(1, 2)).toBe('1 day');
      expect(aiContextService.estimateEffort(3, 2)).toBe('2-3 days');
      expect(aiContextService.estimateEffort(7, 1)).toBe('1 week');
      expect(aiContextService.estimateEffort(15, 1)).toBe('2+ weeks');
      expect(aiContextService.estimateEffort(30, 1)).toBe('2+ weeks');
      expect(aiContextService.estimateEffort(5, 0)).toBe('unknown');
    });

    it('should assess impact correctly', () => {
      // Act & Assert
      expect(aiContextService.assessImpact(95, 80)).toBe('high - near completion');
      expect(aiContextService.assessImpact(75, 60)).toBe('medium - significant progress');
      expect(aiContextService.assessImpact(50, 80)).toBe('medium - healthy project');
      expect(aiContextService.assessImpact(30, 40)).toBe('low - early stage or struggling');
    });
  });
});
