/**
 * Progress V2 Application
 * 
 * This file uses the shared utilities and components for progress tracking.
 * Refactored to eliminate code duplication and use modular architecture.
 */

import { Utils } from '../shared/utils.js';
import { ProjectCard, ProgressBar, FilterControls, Pagination } from '../shared/components.js';

class ProgressV2App {
  constructor() {
    this.analyticsData = null;
    this.incompleteData = [];
    this.blockedData = null;
    this.currentTab = 'analytics';
    this.filterControls = null;
    this.pagination = null;
  }

  /**
   * Initialize the application
   */
  init() {
    this.setupEventListeners();
    this.loadProgressData();
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    document.getElementById('refresh-btn').addEventListener('click', () => this.loadProgressData());
    document.getElementById('clear-cache-btn').addEventListener('click', () => this.clearCache());
    
    // Tab switching
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
    });
  }

  /**
   * Load progress data from API
   */
  async loadProgressData() {
    try {
      Utils.showLoading(true);
      Utils.updateStatus('Loading progress data...', '');
      
      // Load analytics data
      const analyticsResponse = await Utils.api.get('/api/v2/progress/analytics');
      
      if (analyticsResponse.success) {
        this.analyticsData = analyticsResponse.data;
        this.updateProjectFilter();
        this.displayOverviewStats();
        this.displayAnalytics();
      } else {
        throw new Error(analyticsResponse.error || 'Failed to load analytics data');
      }
      
      // Load incomplete work data
      const incompleteResponse = await Utils.api.get('/api/v2/progress/incomplete');
      
      if (incompleteResponse.success) {
        this.incompleteData = incompleteResponse.data;
        this.displayIncompleteWork();
      }
      
      // Load blocked items data
      const blockedResponse = await Utils.api.get('/api/v2/progress/blocked');
      
      if (blockedResponse.success) {
        this.blockedData = blockedResponse.data;
        this.displayBlockedItems();
      }
      
      Utils.updateStatus('Progress data loaded successfully', 'success');
      Utils.showLoading(false);
      
    } catch (error) {
      Utils.showLoading(false);
      Utils.showError(`Error loading progress data: ${error.message}`);
      Utils.updateStatus('Failed to load progress data', 'error');
    }
  }

  /**
   * Update project filter dropdown
   */
  updateProjectFilter() {
    if (!this.analyticsData || !this.analyticsData.projects) return;
    
    const filter = document.getElementById('project-filter');
    const currentValue = filter.value;
    
    filter.innerHTML = '<option value="">All Projects</option>';
    this.analyticsData.projects.forEach(project => {
      const option = document.createElement('option');
      option.value = project.projectName;
      option.textContent = project.projectName;
      if (project.projectName === currentValue) {
        option.selected = true;
      }
      filter.appendChild(option);
    });
  }

  /**
   * Display overview statistics
   */
  displayOverviewStats() {
    if (!this.analyticsData || !this.analyticsData.aggregate) return;
    
    const container = document.getElementById('overview-stats');
    const aggregate = this.analyticsData.aggregate;
    
    container.innerHTML = `
      <div class="stat-card">
        <div class="stat-number">${aggregate.totalProjects}</div>
        <div class="stat-label">Total Projects</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${Utils.formatPercentage(aggregate.averageCompletion)}</div>
        <div class="stat-label">Avg Completion</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${Utils.formatNumber(aggregate.totalStories)}</div>
        <div class="stat-label">Total Stories</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${Utils.formatNumber(aggregate.completedStories)}</div>
        <div class="stat-label">Completed Stories</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${Utils.formatNumber(aggregate.totalTasks)}</div>
        <div class="stat-label">Total Tasks</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${Utils.formatNumber(aggregate.completedTasks)}</div>
        <div class="stat-label">Completed Tasks</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${aggregate.averageVelocity}</div>
        <div class="stat-label">Avg Velocity</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${Utils.formatNumber(aggregate.projectsWithBlockedItems)}</div>
        <div class="stat-label">Blocked Projects</div>
      </div>
    `;
  }

  /**
   * Display analytics data
   */
  displayAnalytics() {
    if (!this.analyticsData || !this.analyticsData.projects) return;
    
    const container = document.getElementById('analytics-list');
    const filteredProjects = this.getFilteredProjects(this.analyticsData.projects);
    
    if (filteredProjects.length === 0) {
      container.innerHTML = '<div class="empty-state"><h3>No Projects Found</h3><p>No projects match your current filters.</p></div>';
      return;
    }
    
    container.innerHTML = '';
    filteredProjects.forEach(project => {
      const projectData = {
        name: project.projectName,
        progress: project.overallCompletionPercentage,
        healthScore: project.overallCompletionPercentage,
        lastActivity: project.lastActivity,
        storyCount: project.totalStories,
        taskCount: project.totalTasks,
        category: project.category,
        status: project.status
      };
      
      const card = new ProjectCard(projectData, container);
      card.render();
    });
  }

  /**
   * Display incomplete work data
   */
  displayIncompleteWork() {
    const container = document.getElementById('incomplete-list');
    const filteredIncomplete = this.getFilteredIncompleteWork();
    
    if (filteredIncomplete.length === 0) {
      container.innerHTML = '<div class="empty-state"><h3>No Incomplete Work</h3><p>All work items are completed!</p></div>';
      return;
    }
    
    container.innerHTML = '';
    filteredIncomplete.forEach(project => {
      const projectData = {
        name: project.projectName,
        progress: project.completionPercentage,
        healthScore: project.completionPercentage,
        lastActivity: project.lastActivity,
        storyCount: project.incompleteStories,
        taskCount: project.incompleteTasks,
        category: project.category,
        status: project.status
      };
      
      const card = new ProjectCard(projectData, container);
      card.render();
    });
  }

  /**
   * Display blocked items data
   */
  displayBlockedItems() {
    if (!this.blockedData) return;
    
    const container = document.getElementById('blocked-list');
    const { blockedItems, staleItems } = this.blockedData;
    
    let html = '';
    
    if (blockedItems.length > 0) {
      html += `
        <div class="progress-section">
          <div class="section-header">
            <h3 class="section-title">🚫 Blocked Items (${blockedItems.length})</h3>
          </div>
          <div class="section-content">
            <div class="projects-list">
              ${blockedItems.map(item => this.createBlockedItemCard(item)).join('')}
            </div>
          </div>
        </div>
      `;
    }
    
    if (staleItems.length > 0) {
      html += `
        <div class="progress-section">
          <div class="section-header">
            <h3 class="section-title">⏰ Stale Items (${staleItems.length})</h3>
          </div>
          <div class="section-content">
            <div class="projects-list">
              ${staleItems.map(item => this.createStaleItemCard(item)).join('')}
            </div>
          </div>
        </div>
      `;
    }
    
    if (blockedItems.length === 0 && staleItems.length === 0) {
      html = '<div class="empty-state"><h3>No Blocked or Stale Items</h3><p>All items are up to date!</p></div>';
    }
    
    container.innerHTML = html;
  }

  /**
   * Create blocked item card
   */
  createBlockedItemCard(item) {
    return `
      <div class="project-item high-priority">
        <div class="project-header">
          <div class="project-name">${item.title}</div>
          <div class="project-priority priority-high">Blocked</div>
        </div>
        <div class="blocked-items">
          <h4>Project: ${item.projectName}</h4>
          <p><strong>Reason:</strong> ${item.reason || 'Unknown'}</p>
          <p><strong>Last Activity:</strong> ${Utils.formatDate(item.lastActivity)}</p>
        </div>
      </div>
    `;
  }

  /**
   * Create stale item card
   */
  createStaleItemCard(item) {
    return `
      <div class="project-item medium-priority">
        <div class="project-header">
          <div class="project-name">${item.title}</div>
          <div class="project-priority priority-medium">Stale</div>
        </div>
        <div class="stale-items">
          <h4>Project: ${item.projectName}</h4>
          <p><strong>Days Since Activity:</strong> ${item.daysSinceActivity || 'Unknown'}</p>
          <p><strong>Last Activity:</strong> ${Utils.formatDate(item.lastActivity)}</p>
        </div>
      </div>
    `;
  }

  /**
   * Get filtered projects based on current filters
   */
  getFilteredProjects(projects) {
    const searchTerm = document.getElementById('search-input')?.value.toLowerCase() || '';
    const projectFilter = document.getElementById('project-filter')?.value || '';
    const minCompletion = document.getElementById('min-completion')?.value || '';
    const maxCompletion = document.getElementById('max-completion')?.value || '';
    const minVelocity = document.getElementById('min-velocity')?.value || '';
    
    return projects.filter(project => {
      if (searchTerm && !project.projectName.toLowerCase().includes(searchTerm)) {
        return false;
      }
      if (projectFilter && project.projectName !== projectFilter) {
        return false;
      }
      if (minCompletion && project.overallCompletionPercentage < parseInt(minCompletion)) {
        return false;
      }
      if (maxCompletion && project.overallCompletionPercentage > parseInt(maxCompletion)) {
        return false;
      }
      if (minVelocity && project.velocity < parseFloat(minVelocity)) {
        return false;
      }
      return true;
    });
  }

  /**
   * Get filtered incomplete work
   */
  getFilteredIncompleteWork() {
    const searchTerm = document.getElementById('search-input')?.value.toLowerCase() || '';
    const projectFilter = document.getElementById('project-filter')?.value || '';
    
    return this.incompleteData.filter(project => {
      if (searchTerm && !project.projectName.toLowerCase().includes(searchTerm)) {
        return false;
      }
      if (projectFilter && project.projectName !== projectFilter) {
        return false;
      }
      return true;
    });
  }

  /**
   * Filter data based on current tab
   */
  filterData() {
    switch (this.currentTab) {
      case 'analytics':
        this.displayAnalytics();
        break;
      case 'incomplete':
        this.displayIncompleteWork();
        break;
      case 'blocked':
        this.displayBlockedItems();
        break;
    }
  }

  /**
   * Switch between tabs
   */
  switchTab(tabName) {
    // Update tab appearance
    document.querySelectorAll('.tab').forEach(tab => {
      tab.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('active');
    });
    document.getElementById(`${tabName}-tab`).classList.add('active');
    
    this.currentTab = tabName;
  }

  /**
   * Clear cache
   */
  async clearCache() {
    try {
      if (!confirm('Are you sure you want to clear the cache? This will refresh all progress data.')) {
        return;
      }
      
      Utils.updateStatus('Clearing cache...', '');
      
      const response = await Utils.api.post('/api/v2/cache/progress/clear');
      
      if (response.success) {
        Utils.updateStatus('Cache cleared successfully', 'success');
        this.loadProgressData();
      } else {
        throw new Error(response.error || 'Failed to clear cache');
      }
    } catch (error) {
      Utils.updateStatus(`Failed to clear cache: ${error.message}`, 'error');
    }
  }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new ProgressV2App().init();
});