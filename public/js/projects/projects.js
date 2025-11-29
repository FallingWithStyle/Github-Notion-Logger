/**
 * Projects Application (Legacy)
 * 
 * This file uses the shared utilities and components for project management.
 * Refactored to eliminate code duplication and use modular architecture.
 */

import { Utils } from '../shared/utils.js';
import { ProjectCard, FilterControls, Pagination } from '../shared/components.js';

class ProjectsApp {
  constructor() {
    this.projects = [];
    this.filteredProjects = [];
    this.currentPage = 1;
    this.pageSize = 12;
    this.totalPages = 1;
    this.categories = [];
    this.currentView = 'card';
    this.filterControls = null;
    this.pagination = null;
  }

  /**
   * Initialize the application
   */
  init() {
    this.loadProjects();
    this.loadCategories();
    this.setupEventListeners();
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    document.getElementById('refresh-btn').addEventListener('click', () => this.loadProjects());
    document.getElementById('clear-cache-btn').addEventListener('click', () => this.clearCache());
    document.getElementById('search-input').addEventListener('input', Utils.debounce(() => this.filterProjects(), 300));
    document.getElementById('category-filter').addEventListener('change', () => this.filterProjects());
    document.getElementById('status-filter').addEventListener('change', () => this.filterProjects());
    document.getElementById('health-filter').addEventListener('change', () => this.filterProjects());
    document.getElementById('activity-filter').addEventListener('change', () => this.filterProjects());
    document.getElementById('sort-filter').addEventListener('change', () => this.filterProjects());
    document.getElementById('card-view-btn').addEventListener('click', () => this.switchView('card'));
    document.getElementById('bar-view-btn').addEventListener('click', () => this.switchView('bar'));
  }

  /**
   * Load projects from API
   */
  async loadProjects() {
    try {
      Utils.showLoading(true);
      Utils.updateStatus('Loading projects...', '');
      
      // Load both API data and weekly planning data in parallel
      const [apiResponse, weeklyResponse] = await Promise.allSettled([
        Utils.api.get('/api/projects'),
        Utils.api.get('/api/weekly-plans')
      ]);
      
      let apiData = null;
      let weeklyData = null;
      
      // Process API response
      if (apiResponse.status === 'fulfilled') {
        apiData = apiResponse.value;
        if (apiData.success) {
          this.projects = apiData.data;
        }
      }
      
      // Process weekly planning data
      if (weeklyResponse.status === 'fulfilled') {
        weeklyData = weeklyResponse.value;
        if (weeklyData.success) {
          this.mergeWeeklyData(weeklyData.data);
        }
      }
      
      this.filteredProjects = [...this.projects];
      this.displayProjects();
      this.updateStatus(`Loaded ${this.projects.length} projects`, 'success');
      Utils.showLoading(false);
      
    } catch (error) {
      Utils.showLoading(false);
      Utils.showError(`Error loading projects: ${error.message}`);
      Utils.updateStatus('Failed to load projects', 'error');
    }
  }

  /**
   * Merge weekly planning data with projects
   */
  mergeWeeklyData(weeklyData) {
    if (!weeklyData || !Array.isArray(weeklyData)) return;
    
    weeklyData.forEach(weeklyProject => {
      const existingProject = this.projects.find(p => p.name === weeklyProject.projectName);
      if (existingProject) {
        // Merge weekly planning data
        existingProject.weeklyFocus = weeklyProject.weeklyFocus;
        existingProject.headRating = weeklyProject.headRating;
        existingProject.heartRating = weeklyProject.heartRating;
        existingProject.notes = weeklyProject.notes;
        existingProject.category = weeklyProject.category;
      } else {
        // Add new project from weekly planning
        this.projects.push({
          name: weeklyProject.projectName,
          progress: 0,
          healthScore: 0,
          lastActivity: new Date().toISOString(),
          storyCount: 0,
          taskCount: 0,
          category: weeklyProject.category,
          status: 'planning',
          weeklyFocus: weeklyProject.weeklyFocus,
          headRating: weeklyProject.headRating,
          heartRating: weeklyProject.heartRating,
          notes: weeklyProject.notes
        });
      }
    });
  }

  /**
   * Load categories for filtering
   */
  async loadCategories() {
    try {
      const response = await Utils.api.get('/api/projects/categories');
      if (response.success) {
        this.categories = response.data;
        this.updateCategoryFilter();
      }
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  }

  /**
   * Display projects in the current view
   */
  displayProjects() {
    const container = document.getElementById('projects-container');
    if (!container) return;
    
    if (this.currentView === 'card') {
      this.displayCardView();
    } else {
      this.displayBarView();
    }
  }

  /**
   * Display projects in card view
   */
  displayCardView() {
    const container = document.getElementById('projects-container');
    container.innerHTML = '';
    
    if (this.filteredProjects.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📁</div>
          <h3 class="empty-state-title">No Projects Found</h3>
          <p class="empty-state-description">No projects match your current filters.</p>
        </div>
      `;
      return;
    }
    
    this.filteredProjects.forEach(project => {
      const projectData = {
        name: project.name,
        progress: project.progress || 0,
        healthScore: project.healthScore || 0,
        lastActivity: project.lastActivity,
        storyCount: project.storyCount || 0,
        taskCount: project.taskCount || 0,
        category: project.category,
        status: project.status,
        health: Utils.getHealthLabel(project.healthScore || 0)
      };
      
      const card = new ProjectCard(projectData, container);
      card.render();
    });
  }

  /**
   * Display projects in bar view
   */
  displayBarView() {
    const container = document.getElementById('projects-container');
    container.innerHTML = '';
    
    if (this.filteredProjects.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📊</div>
          <h3 class="empty-state-title">No Projects Found</h3>
          <p class="empty-state-description">No projects match your current filters.</p>
        </div>
      `;
      return;
    }
    
    this.filteredProjects.forEach(project => {
      const projectItem = document.createElement('div');
      projectItem.className = 'project-item';
      projectItem.innerHTML = `
        <div class="project-header">
          <div class="project-name">${project.name}</div>
          <div class="project-priority priority-${this.getPriorityClass(project.progress || 0)}">
            ${this.getPriorityText(project.progress || 0)}
          </div>
        </div>
        <div class="project-metrics">
          <div class="metric">
            <div class="metric-value">${Utils.formatPercentage(project.progress || 0)}</div>
            <div class="metric-label">Completion</div>
          </div>
          <div class="metric">
            <div class="metric-value">${Utils.formatNumber(project.storyCount || 0)}</div>
            <div class="metric-label">Stories</div>
          </div>
          <div class="metric">
            <div class="metric-value">${Utils.formatNumber(project.taskCount || 0)}</div>
            <div class="metric-label">Tasks</div>
          </div>
          <div class="metric">
            <div class="metric-value">${Utils.timeAgo(project.lastActivity)}</div>
            <div class="metric-label">Last Activity</div>
          </div>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${project.progress || 0}%"></div>
        </div>
      `;
      container.appendChild(projectItem);
    });
  }

  /**
   * Filter projects based on current filters
   */
  filterProjects() {
    const searchTerm = document.getElementById('search-input')?.value.toLowerCase() || '';
    const categoryFilter = document.getElementById('category-filter')?.value || '';
    const statusFilter = document.getElementById('status-filter')?.value || '';
    const healthFilter = document.getElementById('health-filter')?.value || '';
    const activityFilter = document.getElementById('activity-filter')?.value || '';
    const sortFilter = document.getElementById('sort-filter')?.value || 'name';
    
    this.filteredProjects = this.projects.filter(project => {
      const matchesSearch = !searchTerm || 
        project.name.toLowerCase().includes(searchTerm);
      const matchesCategory = !categoryFilter || 
        project.category === categoryFilter;
      const matchesStatus = !statusFilter || 
        project.status === statusFilter;
      const matchesHealth = !healthFilter || 
        Utils.getHealthLabel(project.healthScore || 0).toLowerCase() === healthFilter;
      const matchesActivity = !activityFilter || 
        this.getActivityLevel(project.lastActivity) === activityFilter;
      
      return matchesSearch && matchesCategory && matchesStatus && matchesHealth && matchesActivity;
    });
    
    // Sort projects
    this.sortProjects(sortFilter);
    
    this.currentPage = 1;
    this.displayProjects();
  }

  /**
   * Sort projects based on sort filter
   */
  sortProjects(sortFilter) {
    switch (sortFilter) {
      case 'name':
        this.filteredProjects.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'progress':
        this.filteredProjects.sort((a, b) => (b.progress || 0) - (a.progress || 0));
        break;
      case 'health':
        this.filteredProjects.sort((a, b) => (b.healthScore || 0) - (a.healthScore || 0));
        break;
      case 'lastActivity':
        this.filteredProjects.sort((a, b) => new Date(b.lastActivity || 0) - new Date(a.lastActivity || 0));
        break;
    }
  }

  /**
   * Get activity level based on last activity date
   */
  getActivityLevel(lastActivity) {
    if (!lastActivity) return 'inactive';
    
    const daysSinceActivity = Math.floor((new Date() - new Date(lastActivity)) / (1000 * 60 * 60 * 24));
    
    if (daysSinceActivity <= 7) return 'recent';
    if (daysSinceActivity <= 30) return 'moderate';
    if (daysSinceActivity <= 90) return 'stale';
    return 'inactive';
  }

  /**
   * Get priority class based on progress
   */
  getPriorityClass(progress) {
    if (progress >= 80) return 'low-priority';
    if (progress >= 50) return 'medium-priority';
    return 'high-priority';
  }

  /**
   * Get priority text based on progress
   */
  getPriorityText(progress) {
    if (progress >= 80) return 'Low Priority';
    if (progress >= 50) return 'Medium Priority';
    return 'High Priority';
  }

  /**
   * Switch between card and bar view
   */
  switchView(view) {
    this.currentView = view;
    
    // Update view toggle buttons
    document.querySelectorAll('.view-toggle .btn').forEach(btn => {
      btn.classList.remove('active');
    });
    document.getElementById(`${view}-view-btn`).classList.add('active');
    
    this.displayProjects();
  }

  /**
   * Update category filter dropdown
   */
  updateCategoryFilter() {
    const categoryFilter = document.getElementById('category-filter');
    if (!categoryFilter) return;
    
    const currentValue = categoryFilter.value;
    categoryFilter.innerHTML = '<option value="">All Categories</option>';
    
    this.categories.forEach(category => {
      const option = document.createElement('option');
      option.value = category;
      option.textContent = category;
      if (category === currentValue) {
        option.selected = true;
      }
      categoryFilter.appendChild(option);
    });
  }

  /**
   * Clear cache
   */
  async clearCache() {
    try {
      if (!confirm('Are you sure you want to clear the cache? This will refresh all project data.')) {
        return;
      }
      
      Utils.updateStatus('Clearing cache...', '');
      
      const response = await Utils.api.post('/api/cache/projects/clear');
      
      if (response.success) {
        Utils.updateStatus('Cache cleared successfully', 'success');
        this.loadProjects();
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
  new ProjectsApp().init();
});