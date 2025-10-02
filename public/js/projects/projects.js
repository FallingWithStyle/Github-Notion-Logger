let projects = [];
let filteredProjects = [];
let currentPage = 1;
let pageSize = 12;
let totalPages = 1;
let categories = [];
let currentView = 'card'; // Default to card view

// Load projects on page load
document.addEventListener('DOMContentLoaded', () => {
    loadProjects();
    loadCategories();
    setupEventListeners();
});

function setupEventListeners() {
    document.getElementById('refresh-btn').addEventListener('click', loadProjects);
    document.getElementById('clear-cache-btn').addEventListener('click', clearCache);
    document.getElementById('search-input').addEventListener('input', debounce(filterProjects, 300));
    document.getElementById('category-filter').addEventListener('change', filterProjects);
    document.getElementById('status-filter').addEventListener('change', filterProjects);
    document.getElementById('health-filter').addEventListener('change', filterProjects);
    document.getElementById('activity-filter').addEventListener('change', filterProjects);
    document.getElementById('sort-filter').addEventListener('change', filterProjects);
    document.getElementById('card-view-btn').addEventListener('click', () => switchView('card'));
    document.getElementById('bar-view-btn').addEventListener('click', () => switchView('bar'));
}

async function loadProjects() {
    try {
        showLoading(true);
        updateStatus('Loading projects...', '');
        
        // Load both API data and weekly planning data in parallel
        const [apiResponse, weeklyResponse] = await Promise.allSettled([
            fetch('/api/v2/projects/overview'),
            fetch('/api/weekly-plans')
        ]);
        
        let apiData = null;
        let weeklyData = null;
        
        // Process API response
        if (apiResponse.status === 'fulfilled') {
            const apiResult = await apiResponse.value.json();
            if (apiResult.success) {
                apiData = apiResult.data;
            }
        }
        
        // Process weekly planning response
        if (weeklyResponse.status === 'fulfilled') {
            const weeklyResult = await weeklyResponse.value.json();
            if (weeklyResult.success && weeklyResult.plans && weeklyResult.plans.length > 0) {
                // Get the most recent weekly plan
                const latestPlan = weeklyResult.plans[weeklyResult.plans.length - 1];
                weeklyData = {
                    projects: latestPlan.planData?.projects || [],
                    categories: latestPlan.planData?.userAnswers?.categories || []
                };
            }
        }
        
        if (!apiData) {
            throw new Error('Failed to load project data from API');
        }
        
        // Merge API data with weekly planning data
        projects = mergeProjectData(apiData, weeklyData);
        filteredProjects = [...projects];
        
        // Update category filter with project counts
        updateCategoryFilter();
        
        displayProjects();
        updateStatus(`Loaded ${projects.length} projects (merged with weekly planning data)`, 'success');
        showLoading(false);
    } catch (error) {
        showLoading(false);
        showError(`Error loading projects: ${error.message}`);
        updateStatus('Failed to load projects', 'error');
    }
}

function mergeProjectData(apiData, weeklyData) {
    // Create a map of weekly planning data by project name for quick lookup
    const weeklyMap = new Map();
    if (weeklyData && weeklyData.projects) {
        weeklyData.projects.forEach(project => {
            if (project.name) {
                weeklyMap.set(project.name, project);
            }
        });
    }
    
    // Merge API data with weekly planning data
    return apiData.map(apiProject => {
        const weeklyProject = weeklyMap.get(apiProject.name) || weeklyMap.get(apiProject.repository);
        
        if (weeklyProject) {
            // Merge the data, prioritizing weekly planning for status and category
            return {
                ...apiProject, // Start with API data (health scores, progress, etc.)
                status: weeklyProject.status || apiProject.status, // Weekly planning status takes priority
                category: weeklyProject.category || apiProject.category, // Weekly planning category takes priority
                // Keep any additional weekly planning data
                head: weeklyProject.head,
                heart: weeklyProject.heart,
                // Update lastActivity if weekly planning has more recent data
                lastActivity: weeklyProject.lastActivity || apiProject.lastActivity
            };
        }
        
        // If no weekly planning data found, return API data as-is
        return apiProject;
    });
}

async function loadCategories() {
    try {
        // Load categories from weekly planning data
        const response = await fetch('/api/weekly-plans');
        const result = await response.json();
        
        if (result.success && result.plans && result.plans.length > 0) {
            // Get the most recent weekly plan
            const latestPlan = result.plans[result.plans.length - 1];
            const categories = latestPlan.planData?.userAnswers?.categories || [];
            
            // Extract unique categories from weekly planning data
            const categorySet = new Set();
            categories.forEach(category => {
                if (category) categorySet.add(category);
            });
            
            // Also add categories from loaded projects if available
            if (projects && projects.length > 0) {
                projects.forEach(project => {
                    if (project.category) {
                        categorySet.add(project.category);
                    }
                });
            }
            
            categories = Array.from(categorySet).map(category => ({
                name: category,
                count: 0 // Will be calculated when projects are loaded
            }));
            
            updateCategoryFilter();
        } else {
            // Fallback to default categories if weekly planning data is not available
            categories = [
                { name: 'Writing & Story Tools', count: 0 },
                { name: 'Infrastructure & Utilities', count: 0 },
                { name: 'Avoros (Shared Fantasy/Game World)', count: 0 },
                { name: 'Miscellaneous / Standalone', count: 0 }
            ];
            updateCategoryFilter();
        }
    } catch (error) {
        console.warn('Failed to load categories from weekly planning, using defaults:', error.message);
        // Fallback to default categories
        categories = [
            { name: 'Writing & Story Tools', count: 0 },
            { name: 'Infrastructure & Utilities', count: 0 },
            { name: 'Avoros (Shared Fantasy/Game World)', count: 0 },
            { name: 'Miscellaneous / Standalone', count: 0 }
        ];
        updateCategoryFilter();
    }
}

function updateCategoryFilter() {
    const filter = document.getElementById('category-filter');
    const currentValue = filter.value;
    
    // Calculate counts based on loaded projects
    const categoryCounts = {};
    projects.forEach(project => {
        if (project.category) {
            categoryCounts[project.category] = (categoryCounts[project.category] || 0) + 1;
        }
    });
    
    filter.innerHTML = '<option value="">All Categories</option>';
    categories.forEach(category => {
        const count = categoryCounts[category.name] || 0;
        const option = document.createElement('option');
        option.value = category.name;
        option.textContent = `${category.name} (${count})`;
        if (category.name === currentValue) {
            option.selected = true;
        }
        filter.appendChild(option);
    });
}

function filterProjects() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    const category = document.getElementById('category-filter').value;
    const status = document.getElementById('status-filter').value;
    const health = document.getElementById('health-filter').value;
    const activity = document.getElementById('activity-filter').value;
    const sortBy = document.getElementById('sort-filter').value;
    
    filteredProjects = projects.filter(project => {
        // Search filter
        if (searchTerm && !project.name.toLowerCase().includes(searchTerm) &&
            !project.category.toLowerCase().includes(searchTerm) &&
            !project.repository.toLowerCase().includes(searchTerm)) {
            return false;
        }
        
        // Category filter
        if (category && project.category !== category) {
            return false;
        }
        
        // Status filter
        if (status && project.status !== status) {
            return false;
        }
        
        // Health filter
        if (health && project.health.healthStatus !== health) {
            return false;
        }
        
        // Activity filter
        if (activity && project.activityStatus !== activity) {
            return false;
        }
        
        return true;
    });
    
    // Sort projects
    filteredProjects.sort((a, b) => {
        switch (sortBy) {
            case 'name':
                return a.name.localeCompare(b.name);
            case 'healthScore':
                return b.health.healthScore - a.health.healthScore;
            case 'progress':
                return b.progress - a.progress;
            case 'priorityScoreDesc':
                return (b.priorityScore || 0) - (a.priorityScore || 0);
            case 'priorityScoreAsc':
                return (a.priorityScore || 0) - (b.priorityScore || 0);
            case 'lastActivity':
            default:
                if (!a.lastActivity && !b.lastActivity) return 0;
                if (!a.lastActivity) return 1;
                if (!b.lastActivity) return -1;
                return new Date(b.lastActivity) - new Date(a.lastActivity);
        }
    });
    
    currentPage = 1;
    displayProjects();
}

function displayProjects() {
    const container = document.getElementById('projects-grid');
    const emptyState = document.getElementById('empty-state');
    const pagination = document.getElementById('pagination');
    
    if (filteredProjects.length === 0) {
        container.style.display = 'none';
        emptyState.style.display = 'block';
        pagination.style.display = 'none';
        return;
    }
    
    // Calculate pagination
    totalPages = Math.ceil(filteredProjects.length / pageSize);
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const pageProjects = filteredProjects.slice(startIndex, endIndex);
    
    // Generate projects based on current view
    if (currentView === 'bar') {
        container.innerHTML = `
            <div class="projects-bar">
                ${pageProjects.map(project => createProjectBar(project)).join('')}
            </div>
        `;
        container.style.display = 'block';
    } else {
        container.innerHTML = pageProjects.map(project => createProjectCard(project)).join('');
        container.style.display = 'grid';
    }
    
    emptyState.style.display = 'none';
    
    // Show pagination if needed
    if (totalPages > 1) {
        displayPagination();
        pagination.style.display = 'flex';
    } else {
        pagination.style.display = 'none';
    }
}

function createProjectCard(project) {
    const healthClass = project.health.healthStatus || 'unknown';
    const activityClass = project.activityStatus || 'inactive';
    
    return `
        <div class="project-card ${healthClass}">
            <div class="project-header">
                <div class="project-title">
                    <span>${project.name}</span>
                    <span class="project-category">${project.category}</span>
                </div>
                <div class="project-meta">
                    <div class="meta-item">
                        <span>📁</span>
                        <span>${project.repository}</span>
                    </div>
                    <div class="meta-item">
                        <span class="status-badge status-${project.status || 'unknown'}">${project.status || 'unknown'}</span>
                    </div>
                    <div class="meta-item">
                        <span class="activity-status activity-${activityClass}">${activityClass}</span>
                    </div>
                </div>
                <div class="health-indicator health-${healthClass}">
                    <span>🏥</span>
                    <span>${project.health.healthScore}/100 - ${project.health.healthStatus}</span>
                </div>
            </div>
            
            <div class="project-body">
                <div class="progress-section">
                    <div class="progress-header">
                        <span class="progress-label">Progress</span>
                        <span class="progress-percentage">${project.progress}%</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${project.progress}%"></div>
                    </div>
                    <div class="progress-stats">
                        <span>${project.storiesCompleted}/${project.storiesTotal} stories</span>
                        <span>${project.tasksCompleted}/${project.tasksTotal} tasks</span>
                    </div>
                </div>
                
                <div class="stats-grid">
                    <div class="stat-item">
                        <div class="stat-number">${project.totalCommits}</div>
                        <div class="stat-label">Commits</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-number">${project.health.completionVelocity}</div>
                        <div class="stat-label">Velocity</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-number">${project.priorityScore || 0}</div>
                        <div class="stat-label">Priority</div>
                    </div>
                    ${project.head && project.heart ? `
                        <div class="stat-item">
                            <div class="stat-number">${project.head}/${project.heart}</div>
                            <div class="stat-label">Head/Heart</div>
                        </div>
                    ` : ''}
                </div>
                
                ${project.health.riskFactors && project.health.riskFactors.length > 0 ? `
                    <div class="risk-factors">
                        <h4>⚠️ Risk Factors</h4>
                        <ul class="risk-list">
                            ${project.health.riskFactors.map(risk => `<li class="risk-item">${risk}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
                
                <div class="project-actions">
                    <button class="btn btn-small" onclick="viewProjectDetails('${project.name}')">
                        📋 Details
                    </button>
                    <button class="btn btn-small secondary" onclick="scanProject('${project.name}')">
                        🔍 Scan
                    </button>
                    ${project.hasPrd ? '' : `
                        <button class="btn btn-small danger" onclick="linkPrd('${project.name}')">
                            📄 Link PRD
                        </button>
                    `}
                </div>
            </div>
        </div>
    `;
}

function createProjectBar(project) {
    const healthClass = project.health.healthStatus || 'unknown';
    const activityClass = project.activityStatus || 'inactive';
    
    return `
        <div class="project-bar ${healthClass}">
            <div class="project-bar-info">
                <div class="project-bar-name">${project.name}</div>
                <div class="project-bar-category">${project.category}</div>
                <div class="project-bar-meta">
                    <span>📁 ${project.repository}</span>
                    <span class="status-badge status-${project.status || 'unknown'}">${project.status || 'unknown'}</span>
                    <span class="activity-status activity-${activityClass}">${activityClass}</span>
                </div>
            </div>
            <div class="project-bar-progress">
                <div class="project-bar-progress-bar">
                    <div class="project-bar-progress-fill" style="width: ${project.progress}%"></div>
                </div>
                <div class="project-bar-progress-text">${project.progress}% Complete</div>
            </div>
            <div class="project-bar-stats">
                <div class="project-bar-stat-value">${project.storiesCompleted}/${project.storiesTotal}</div>
                <div class="project-bar-stat-label">Stories</div>
            </div>
            <div class="project-bar-stats">
                <div class="project-bar-stat-value">${project.tasksCompleted}/${project.tasksTotal}</div>
                <div class="project-bar-stat-label">Tasks</div>
            </div>
            <div class="project-bar-stats">
                <div class="project-bar-stat-value">${project.priorityScore || 0}</div>
                <div class="project-bar-stat-label">Priority</div>
            </div>
            ${project.head && project.heart ? `
                <div class="project-bar-stats">
                    <div class="project-bar-stat-value">${project.head}/${project.heart}</div>
                    <div class="project-bar-stat-label">Head/Heart</div>
                </div>
            ` : ''}
            <div class="project-bar-actions">
                <button class="btn btn-sm" onclick="viewProjectDetails('${project.name}')">
                    📋 Details
                </button>
                <button class="btn btn-sm secondary" onclick="scanProject('${project.name}')">
                    🔍 Scan
                </button>
                ${project.hasPrd ? '' : `
                    <button class="btn btn-sm danger" onclick="linkPrd('${project.name}')">
                        📄 Link PRD
                    </button>
                `}
            </div>
        </div>
    `;
}

function displayPagination() {
    const pagination = document.getElementById('pagination');
    let html = '';
    
    // Previous button
    html += `<button onclick="changePage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>← Previous</button>`;
    
    // Page numbers
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);
    
    if (startPage > 1) {
        html += `<button onclick="changePage(1)">1</button>`;
        if (startPage > 2) {
            html += `<span>...</span>`;
        }
    }
    
    for (let i = startPage; i <= endPage; i++) {
        html += `<button onclick="changePage(${i})" ${i === currentPage ? 'class="current-page"' : ''}>${i}</button>`;
    }
    
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            html += `<span>...</span>`;
        }
        html += `<button onclick="changePage(${totalPages})">${totalPages}</button>`;
    }
    
    // Next button
    html += `<button onclick="changePage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>Next →</button>`;
    
    pagination.innerHTML = html;
}

function changePage(page) {
    if (page >= 1 && page <= totalPages) {
        currentPage = page;
        displayProjects();
    }
}

function switchView(view) {
    currentView = view;
    
    // Update button states
    document.getElementById('card-view-btn').classList.toggle('active', view === 'card');
    document.getElementById('bar-view-btn').classList.toggle('active', view === 'bar');
    
    // Redisplay projects with new view
    displayProjects();
}

function viewProjectDetails(projectName) {
    // TODO: Implement project details modal or navigation
    alert(`View details for ${projectName}`);
}

function scanProject(projectName) {
    // TODO: Implement project scanning
    alert(`Scan project ${projectName}`);
}

function linkPrd(projectName) {
    // TODO: Implement PRD linking
    alert(`Link PRD for ${projectName}`);
}

async function clearCache() {
    try {
        if (!confirm('Are you sure you want to clear the cache? This will refresh all project data.')) {
            return;
        }
        
        updateStatus('Clearing cache...', '');
        
        const response = await fetch('/api/v2/cache/projects/clear', {
            method: 'POST'
        });
        const result = await response.json();
        
        if (result.success) {
            updateStatus('Cache cleared successfully', 'success');
            loadProjects();
        } else {
            throw new Error(result.error || 'Failed to clear cache');
        }
    } catch (error) {
        updateStatus(`Failed to clear cache: ${error.message}`, 'error');
    }
}

function showLoading(show) {
    document.getElementById('loading').style.display = show ? 'block' : 'none';
    document.getElementById('projects-grid').style.display = show ? 'none' : 'grid';
}

function showError(message) {
    const errorDiv = document.getElementById('error');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    setTimeout(() => errorDiv.style.display = 'none', 5000);
}

function updateStatus(message, type) {
    const statusDiv = document.getElementById('status');
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
