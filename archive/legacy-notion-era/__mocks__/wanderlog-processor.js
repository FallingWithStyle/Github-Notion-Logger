// Mock implementation for wanderlog-processor

const mockWanderlogData = {
  entries: [
    {
      id: 'test-entry-1',
      title: 'Test Wanderlog Entry',
      created: '2025-10-01T11:00:00.000+00:00',
      firstCommitDate: '2025-09-30T17:37:00.000+00:00',
      commitCount: 5,
      projects: 'Test-Project, Another-Project',
      summary: 'Test summary of development work',
      insights: 'Test insights about the development process',
      focusAreas: 'Testing, Development, Quality Assurance'
    }
  ],
  count: 1
};

const mockWanderlogProcessor = {
  ensureWanderlogDatabase: jest.fn().mockResolvedValue({
    success: true,
    databaseId: 'test-wanderlog-database-id',
    message: 'Database ensured'
  }),
  
  fetchWanderlogEntries: jest.fn().mockImplementation(async (options = {}) => {
    const { limit = 50, offset = 0, date } = options;
    
    let entries = [...mockWanderlogData.entries];
    
    if (date) {
      // Filter by date if provided
      entries = entries.filter(entry => 
        entry.created.startsWith(date) || 
        entry.firstCommitDate.startsWith(date)
      );
    }
    
    const paginatedEntries = entries.slice(offset, offset + limit);
    
    return {
      success: true,
      count: paginatedEntries.length,
      entries: paginatedEntries,
      error: null,
      metadata: {
        timestamp: new Date().toISOString(),
        total: entries.length,
        pagination: {
          limit,
          offset,
          total: entries.length,
          hasMore: offset + limit < entries.length
        }
      }
    };
  }),
  
  createWanderlogEntry: jest.fn().mockImplementation(async (entryData) => {
    const newEntry = {
      id: `test-entry-${Date.now()}`,
      ...entryData,
      created: new Date().toISOString()
    };
    
    mockWanderlogData.entries.unshift(newEntry);
    mockWanderlogData.count++;
    
    return {
      success: true,
      data: newEntry,
      error: null,
      metadata: {
        timestamp: new Date().toISOString()
      }
    };
  }),
  
  processDailyCommits: jest.fn().mockImplementation(async (date) => {
    const mockCommits = [
      {
        sha: 'abc123',
        message: 'Test commit message',
        author: 'Test Author',
        date: date || '2025-10-01T10:00:00Z',
        repository: 'test-repo'
      }
    ];
    
    const entryData = {
      title: 'Test Daily Development',
      firstCommitDate: date || '2025-10-01T10:00:00Z',
      commitCount: mockCommits.length,
      projects: 'test-repo',
      summary: 'Test summary of daily development work',
      insights: 'Test insights about the development process',
      focusAreas: 'Testing, Development'
    };
    
    return await mockWanderlogProcessor.createWanderlogEntry(entryData);
  }),
  
  filterSignificantCommits: jest.fn().mockImplementation((commits) => {
    return commits.filter(commit => 
      !commit.message.toLowerCase().includes('typo') &&
      !commit.message.toLowerCase().includes('console.log') &&
      !commit.message.toLowerCase().includes('merge')
    );
  }),
  
  generateSummary: jest.fn().mockImplementation(async (commits, projects) => {
    return {
      title: 'Test Development Summary',
      summary: 'Test summary of development work',
      insights: 'Test insights about the development process',
      focusAreas: 'Testing, Development, Quality Assurance'
    };
  })
};

module.exports = {
  mockWanderlogProcessor,
  mockWanderlogData
};
