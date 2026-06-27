// Mock for notion.js module
const mockCachedRepositories = [
  {
    repository: 'test-project-1',
    name: 'Test Project 1',
    progress: 75,
    storyCount: 20,
    taskCount: 50,
    hasPrd: true,
    hasTaskList: true,
    lastActivity: '2024-01-15T10:30:00Z',
    category: 'Web Development',
    status: 'active'
  },
  {
    repository: 'test-project-2',
    name: 'Test Project 2',
    progress: 50,
    storyCount: 15,
    taskCount: 30,
    hasPrd: false,
    hasTaskList: true,
    lastActivity: '2024-01-10T14:20:00Z',
    category: 'Mobile Development',
    status: 'active'
  }
];

const getAllCachedRepositories = jest.fn().mockResolvedValue(mockCachedRepositories);

module.exports = {
  getAllCachedRepositories
};
