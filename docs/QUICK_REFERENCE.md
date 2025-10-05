# Epic 9 Quick Reference Card

## 🚀 **Essential API Endpoints**

### Project Management
```bash
# Get project overview with pagination
GET /api/v2/projects/overview?page=1&limit=20&category=Web%20Development

# Get project health status
GET /api/v2/projects/{projectName}/health

# Search projects
GET /api/v2/projects/search?q=search%20term&status=active

# Get project categories
GET /api/v2/projects/categories
```

### Progress Tracking
```bash
# Get progress analytics
GET /api/v2/progress/analytics?page=1&limit=20&minCompletion=50

# Get incomplete work
GET /api/v2/progress/incomplete?projectName=my-project

# Get velocity trends
GET /api/v2/progress/velocity?projectName=my-project

# Get blocked items
GET /api/v2/progress/blocked?page=1&limit=20
```

## 📊 **Key Data Models**

### Project Overview (for Projects View)
```javascript
{
  name: "Project Name",
  status: "active|planning|paused|completed",
  category: "Web Development",
  health: {
    healthScore: 85,
    healthStatus: "excellent|good|fair|poor|critical",
    riskFactors: ["No recent activity"]
  },
  progress: 75,
  storiesTotal: 20,
  storiesCompleted: 15,
  lastActivity: "2024-01-15T10:30:00Z",
  activityStatus: "recent|moderate|stale|inactive"
}
```

### Progress Analytics (for Progress View)
```javascript
{
  projectName: "Project Name",
  totalStories: 20,
  completedStories: 15,
  incompleteStories: 5,
  storyCompletionPercentage: 75,
  velocity: 2.5,
  trend: "increasing|decreasing|stable",
  blockedItems: [],
  staleItems: []
}
```

## 🎨 **Component Architecture**

### Projects View Components
- **ProjectCard**: High-level project information with health indicators
- **ProjectFilters**: Category, status, health, activity filters
- **ProjectSearch**: Search functionality
- **ProjectHealthIndicator**: Visual health status
- **ProjectActions**: Quick actions (scan, view details, link PRD)

### Progress View Components
- **ProgressAnalytics**: Detailed completion metrics
- **IncompleteWorkList**: Work items needing attention
- **VelocityChart**: Progress trends over time
- **BlockedItemsList**: Blocked and stale items
- **ProgressFilters**: Completion, velocity, project filters

## 🔧 **Implementation Patterns**

### Data Fetching
```javascript
// Use service layer for data fetching
const projectService = new ProjectManagementService();
const result = await projectService.getProjectOverview(filters);

// Handle errors with fallback
if (!result.success) {
  // Use fallback data or show error state
  const fallbackData = projectService.getFallbackProjectData();
}
```

### Caching Strategy
```javascript
// Data is automatically cached for 5 minutes
// Check cache status
GET /api/v2/cache/status

// Clear cache if needed
POST /api/v2/cache/projects/clear
```

### Error Handling
```javascript
// Standardized error response
{
  success: false,
  error: "Error message",
  metadata: {
    errorType: "network|validation|server_error",
    severity: "low|medium|high",
    context: "operation_context"
  }
}
```

## 📋 **Implementation Checklist**

### Phase 1: Foundation
- [ ] Read `API_V2_DOCS.md`
- [ ] Understand data models in `models/project-models.js`
- [ ] Set up error handling patterns
- [ ] Create base components

### Phase 2: Projects View
- [ ] Implement ProjectCard component
- [ ] Add filtering and search
- [ ] Implement health indicators
- [ ] Add pagination

### Phase 3: Progress View
- [ ] Implement ProgressAnalytics component
- [ ] Add incomplete work tracking
- [ ] Implement velocity trends
- [ ] Add blocked items display

### Phase 4: Enhancement
- [ ] Add performance optimizations
- [ ] Implement caching strategies
- [ ] Add error boundaries
- [ ] Performance monitoring

## 🚨 **Critical Files to Reference**

1. **`API_V2_DOCS.md`** - Complete API reference
2. **`models/project-models.js`** - Data structures
3. **`services/project-management-service.js`** - Project logic
4. **`services/progress-tracking-service.js`** - Progress logic
5. **`task-list.md`** - Implementation checklist

## 🔍 **Debugging Tools**

```bash
# Check performance
GET /api/v2/performance/stats

# Check cache status
GET /api/v2/cache/status

# Clear caches
POST /api/v2/cache/projects/clear
POST /api/v2/cache/progress/clear
```

## 📞 **Common Issues**

- **Data inconsistencies**: Check data consistency service logs
- **Performance issues**: Review performance statistics
- **Cache problems**: Use cache management endpoints
- **API errors**: Check error handling service patterns

---

*Keep this reference handy during Epic 9 implementation!*
