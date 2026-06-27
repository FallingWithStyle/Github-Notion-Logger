# Architecture Documentation Reference Guide

## Overview
This document provides a comprehensive list of architecture documentation that development agents should reference during Epic 9 implementation. Documents are organized by priority and category for easy navigation.

---

## 🚨 **CRITICAL - Must Read First**

### 1. **API Documentation**
- **File**: `API_V2_DOCS.md`
- **Purpose**: Complete API reference for all v2 endpoints
- **Key Sections**:
  - Data models and schemas
  - Endpoint specifications with examples
  - Error handling patterns
  - Pagination and filtering
- **When to Use**: Before implementing any API calls, data validation, or error handling

### 2. **Data Models Reference**
- **File**: `models/project-models.js`
- **Purpose**: Defines all data structures and validation rules
- **Key Classes**:
  - `ProjectHealthModel` - Health scoring and risk assessment
  - `ProjectOverviewModel` - High-level project data
  - `ProgressAnalyticsModel` - Detailed progress tracking
  - `ApiResponseModel` - Standardized API responses
- **When to Use**: When creating components, handling data, or implementing business logic

---

## 🏗️ **ARCHITECTURE FOUNDATION**

### 3. **Service Layer Architecture**
- **Files**: 
  - `services/project-management-service.js`
  - `services/progress-tracking-service.js`
- **Purpose**: Core business logic and data processing
- **Key Methods**:
  - `getProjectOverview()` - Project management data
  - `getProgressAnalytics()` - Progress tracking data
  - `getIncompleteWork()` - Work item tracking
- **When to Use**: Understanding data flow, business rules, and service boundaries

### 4. **Data Consistency Framework**
- **File**: `services/data-consistency-service.js`
- **Purpose**: Multi-source data reconciliation and validation
- **Key Features**:
  - Data source reconciliation (GitHub, Notion, commit logs)
  - Inconsistency detection and logging
  - Health score calculation algorithms
- **When to Use**: When dealing with data conflicts, health calculations, or data validation

### 5. **Error Handling System**
- **File**: `services/error-handling-service.js`
- **Purpose**: Comprehensive error management and recovery
- **Key Features**:
  - Error categorization and severity levels
  - Fallback data mechanisms
  - Retry logic with exponential backoff
- **When to Use**: Implementing error boundaries, fallback UI, or error recovery

---

## ⚡ **PERFORMANCE & OPTIMIZATION**

### 6. **Performance Optimization Service**
- **File**: `services/performance-optimization-service.js`
- **Purpose**: Caching, pagination, and performance monitoring
- **Key Features**:
  - LRU cache management
  - Pagination utilities
  - Performance metrics tracking
  - Batch processing optimization
- **When to Use**: Implementing caching, pagination, or performance monitoring

### 7. **Caching Strategy**
- **Reference**: Performance service + API docs
- **Key Concepts**:
  - 5-minute cache timeouts
  - LRU eviction policy
  - Cache warming strategies
  - Hit rate monitoring
- **When to Use**: When implementing data fetching, caching, or performance optimization

---

## 📊 **DATA FLOW & INTEGRATION**

### 8. **Existing API Integration**
- **File**: `server.js` (lines 1-3950)
- **Purpose**: Integration with existing v1 APIs and data sources
- **Key Endpoints**:
  - `/api/projects` - External project data
  - `/api/project-progress` - Progress data processing
  - `/api/prd-stories/repositories` - Repository management
- **When to Use**: Understanding data sources, existing integrations, or migration strategies

### 9. **Data Source Mapping**
- **Files**: 
  - `notion.js` - Notion API integration
  - `prd-task-processor.js` - PRD and task processing
- **Purpose**: Understanding how data flows from sources to services
- **Key Concepts**:
  - GitHub API data extraction
  - Notion database synchronization
  - Commit log processing
- **When to Use**: When debugging data issues or implementing new data sources

---

## 🎨 **FRONTEND IMPLEMENTATION GUIDES**

### 10. **Component Architecture Patterns**
- **Reference**: Based on Epic 9 requirements
- **Key Patterns**:
  - **Projects View**: High-level project cards, health indicators, filtering
  - **Progress View**: Detailed analytics, completion tracking, work items
  - **Shared Components**: Pagination, filtering, search, error boundaries
- **When to Use**: When designing component structure or user interfaces

### 11. **State Management Guidelines**
- **Reference**: Service layer + API patterns
- **Key Concepts**:
  - Service-based state management
  - Cache-first data fetching
  - Error state handling
  - Loading state management
- **When to Use**: When implementing state management or data flow

---

## 🔧 **DEVELOPMENT WORKFLOW**

### 12. **API Testing Patterns**
- **Reference**: API documentation + existing test files
- **Key Patterns**:
  - Standardized response validation
  - Error scenario testing
  - Performance testing
  - Cache behavior testing
- **When to Use**: When writing tests or debugging API issues

### 13. **Error Handling Patterns**
- **File**: `services/error-handling-service.js`
- **Key Patterns**:
  - Graceful degradation
  - Fallback data display
  - User-friendly error messages
  - Retry mechanisms
- **When to Use**: When implementing error boundaries or user feedback

---

## 📋 **IMPLEMENTATION CHECKLIST**

### 14. **Epic 9 Task List**
- **File**: `task-list.md` (Epic 9 section)
- **Purpose**: Complete implementation checklist
- **Key Stories**:
  - Story 9.1: Projects View Redesign
  - Story 9.2: Progress View Redesign  
  - Story 9.3: API and Backend Updates
  - Story 9.4: UI/UX Improvements
- **When to Use**: Tracking progress, understanding requirements, planning implementation

### 15. **PRD Requirements**
- **File**: `prd.md` (Epic 9 section)
- **Purpose**: Business requirements and acceptance criteria
- **Key Sections**:
  - User stories and acceptance criteria
  - Technical specifications
  - Success criteria
- **When to Use**: Understanding requirements, validating implementation, user testing

---

## 🚀 **DEPLOYMENT & OPERATIONS**

### 16. **Server Configuration**
- **File**: `server.js` (server startup section)
- **Purpose**: Server setup and configuration
- **Key Elements**:
  - Port configuration
  - Environment variables
  - Middleware setup
  - Error handling
- **When to Use**: When deploying, debugging server issues, or configuring environment

### 17. **Performance Monitoring**
- **Reference**: Performance service + API endpoints
- **Key Metrics**:
  - Response times
  - Cache hit rates
  - Error rates
  - Throughput
- **When to Use**: When monitoring performance or optimizing bottlenecks

---

## 📚 **QUICK REFERENCE**

### **Most Frequently Referenced Files**
1. `API_V2_DOCS.md` - API reference
2. `models/project-models.js` - Data structures
3. `services/project-management-service.js` - Project logic
4. `services/progress-tracking-service.js` - Progress logic
5. `task-list.md` - Implementation checklist

### **Key API Endpoints**
- `GET /api/v2/projects/overview` - Project management data
- `GET /api/v2/progress/analytics` - Progress analytics
- `GET /api/v2/progress/incomplete` - Incomplete work tracking
- `GET /api/v2/projects/{name}/health` - Project health status

### **Critical Data Models**
- `ProjectOverviewModel` - For Projects view
- `ProgressAnalyticsModel` - For Progress view
- `ProjectHealthModel` - For health indicators
- `ApiResponseModel` - For API responses

---

## 🎯 **IMPLEMENTATION PRIORITY**

### **Phase 1: Foundation**
1. Read API documentation
2. Understand data models
3. Review service architecture
4. Set up error handling

### **Phase 2: Core Features**
1. Implement Projects view components
2. Implement Progress view components
3. Add filtering and search
4. Implement pagination

### **Phase 3: Enhancement**
1. Add performance optimizations
2. Implement caching strategies
3. Add error boundaries
4. Performance monitoring

### **Phase 4: Polish**
1. UI/UX improvements
2. Accessibility features
3. Testing and validation
4. Documentation updates

---

## 📞 **SUPPORT & DEBUGGING**

### **Common Issues & Solutions**
- **Data inconsistencies**: Check data consistency service logs
- **Performance issues**: Review performance statistics endpoint
- **Cache problems**: Use cache management endpoints
- **API errors**: Check error handling service patterns

### **Debugging Tools**
- Performance statistics: `GET /api/v2/performance/stats`
- Cache status: `GET /api/v2/cache/status`
- Error logs: Check service error handling logs
- Data reconciliation: Check consistency service logs

---

*This documentation should be referenced throughout the Epic 9 implementation process to ensure consistency, performance, and maintainability.*
