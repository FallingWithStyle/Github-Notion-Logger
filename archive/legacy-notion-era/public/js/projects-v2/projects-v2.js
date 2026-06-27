/**
 * Projects V2 Application
 * 
 * This file uses the shared utilities and components for project management.
 * Refactored to eliminate code duplication and use modular architecture.
 */

import { Utils } from '../shared/utils.js';
import { ProjectCard, FilterControls, Pagination } from '../shared/components.js';

class ProjectsV2App {
  constructor() {
    this.projects = [];
    this.filteredProjects = [];
    this.currentPage = 1;
    this.pageSize = 12;
    this.totalPages = 1;
    this.categories = [];
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
  }

  /**
   * Load projects from API
   */
  async loadProjects() {
    try {
      Utils.showLoading(true);
      Utils.updateStatus('Loading projects...', '');
      
      const response = await Utils.api.get('/api/projects');
      
      if (response.success) {
        this.projects = response.data;
        this.filteredProjects = [...this.projects];
        
        this.displayProjects();
        this.setupFilterControls();
        this.setupPagination();
        
        Utils.updateStatus(`Loaded ${this.projects.length} projects`, 'success');
        Utils.showLoading(false);
      } else {
        throw new Error(response.error || 'Failed to load projects');
      }
    } catch (error) {
      Utils.showLoading(false);
      Utils.showError(`Error loading projects: ${error.message}`);
      Utils.updateStatus('Failed to load projects', 'error');
    }
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
   * Display projects in the grid
   */
  displayProjects() {
    const container = document.getElementById('projects-grid');
    if (!container) return;
    
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
   * Setup filter controls
   */
  setupFilterControls() {
    const filterContainer = document.getElementById('filter-controls');
    if (!filterContainer) return;
    
    this.filterControls = new FilterControls(
      filterContainer,
      (filters) => this.handleFilter(filters)
    );
    this.filterControls.render();
  }

  /**
   * Setup pagination
   */
  setupPagination() {
    const paginationContainer = document.getElementById('pagination');
    if (!paginationContainer) return;
    
    this.totalPages = Math.ceil(this.filteredProjects.length / this.pageSize);
    
    this.pagination = new Pagination(paginationContainer, {
      currentPage: this.currentPage,
      totalPages: this.totalPages,
      pageSize: this.pageSize,
      totalItems: this.filteredProjects.length,
      onPageChange: (page) => this.goToPage(page)
    });
    this.pagination.render();
  }

  /**
   * Handle filter changes
   */
  handleFilter(filters) {
    this.filteredProjects = this.projects.filter(project => {
      const matchesSearch = !filters.search || 
        project.name.toLowerCase().includes(filters.search.toLowerCase());
      const matchesCategory = !filters.category || 
        project.category === filters.category;
      const matchesStatus = !filters.status || 
        project.status === filters.status;
      const matchesHealth = !filters.health || 
        Utils.getHealthLabel(project.healthScore || 0).toLowerCase() === filters.health;
      const matchesActivity = !filters.activity || 
        this.getActivityLevel(project.lastActivity) === filters.activity;
      
      return matchesSearch && matchesCategory && matchesStatus && matchesHealth && matchesActivity;
    });
    
    this.currentPage = 1;
    this.displayProjects();
    this.setupPagination();
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
   * Go to specific page
   */
  goToPage(page) {
    this.currentPage = page;
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
  new ProjectsV2App().init();
});