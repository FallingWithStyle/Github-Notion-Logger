let analyticsData = null;
let incompleteData = [];
let blockedData = null;
let currentTab = 'analytics';

// Load data on page load
document.addEventListener('DOMContentLoaded', () => {
    loadProgressData();
    setupEventListeners();
});

function setupEventListeners() {
    document.getElementById('refresh-btn').addEventListener('click', loadProgressData);
    document.getElementById('clear-cache-btn').addEventListener('click', clearCache);
    document.getElementById('search-input').addEventListener('input', debounce(filterData, 300));
    document.getElementById('project-filter').addEventListener('change', filterData);
    document.getElementById('min-completion').addEventListener('change', filterData);
    document.getElementById('max-completion').addEventListener('change', filterData);
    document.getElementById('min-velocity').addEventListener('change', filterData);
    
    // Tab switching
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });
}

async function loadProgressData() {
    try {
        showLoading(true);
        updateStatus('Loading progress data...', '');
        
        // Load analytics data
        const analyticsResponse = await fetch('/api/v2/progress/analytics');
        const analyticsResult = await analyticsResponse.json();
        
        if (analyticsResult.success) {
            analyticsData = analyticsResult.data;
            updateProjectFilter();
            displayOverviewStats();
            displayAnalytics();
        } else {
            throw new Error(analyticsResult.error || 'Failed to load analytics data');
        }
        
        // Load incomplete work data
        const incompleteResponse = await fetch('/api/v2/progress/incomplete');
        const incompleteResult = await incompleteResponse.json();
        
        if (incompleteResult.success) {
            incompleteData = incompleteResult.data;
            displayIncompleteWork();
        }
        
        // Load blocked items data
        const blockedResponse = await fetch('/api/v2/progress/blocked');
        const blockedResult = await blockedResponse.json();
        
        if (blockedResult.success) {
            blockedData = blockedResult.data;
            displayBlockedItems();
        }
        
        updateStatus('Progress data loaded successfully', 'success');
        showLoading(false);
        
    } catch (error) {
        showLoading(false);
        showError(`Error loading progress data: ${error.message}`);
        updateStatus('Failed to load progress data', 'error');
    }
}

function updateProjectFilter() {
    if (!analyticsData || !analyticsData.projects) return;
    
    const filter = document.getElementById('project-filter');
    const currentValue = filter.value;
    
    filter.innerHTML = '<option value="">All Projects</option>';
    analyticsData.projects.forEach(project => {
        const option = document.createElement('option');
        option.value = project.projectName;
        option.textContent = project.projectName;
        if (project.projectName === currentValue) {
            option.selected = true;
        }
        filter.appendChild(option);
    });
}

function displayOverviewStats() {
    if (!analyticsData || !analyticsData.aggregate) return;
    
    const container = document.getElementById('overview-stats');
    const aggregate = analyticsData.aggregate;
    
    container.innerHTML = `
        <div class="stat-card">
            <div class="stat-number">${aggregate.totalProjects}</div>
            <div class="stat-label">Total Projects</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${aggregate.averageCompletion}%</div>
            <div class="stat-label">Avg Completion</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${aggregate.totalStories}</div>
            <div class="stat-label">Total Stories</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${aggregate.completedStories}</div>
            <div class="stat-label">Completed Stories</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${aggregate.totalTasks}</div>
            <div class="stat-label">Total Tasks</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${aggregate.completedTasks}</div>
            <div class="stat-label">Completed Tasks</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${aggregate.averageVelocity}</div>
            <div class="stat-label">Avg Velocity</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${aggregate.projectsWithBlockedItems}</div>
            <div class="stat-label">Blocked Projects</div>
        </div>
    `;
}

function displayAnalytics() {
    if (!analyticsData || !analyticsData.projects) return;
    
    const container = document.getElementById('analytics-list');
    const filteredProjects = getFilteredProjects(analyticsData.projects);
    
    if (filteredProjects.length === 0) {
        container.innerHTML = '<div class="empty-state"><h3>No Projects Found</h3><p>No projects match your current filters.</p></div>';
        return;
    }
    
    container.innerHTML = filteredProjects.map(project => createAnalyticsCard(project)).join('');
}

function displayIncompleteWork() {
    const container = document.getElementById('incomplete-list');
    const filteredIncomplete = getFilteredIncompleteWork();
    
    if (filteredIncomplete.length === 0) {
        container.innerHTML = '<div class="empty-state"><h3>No Incomplete Work</h3><p>All work items are completed!</p></div>';
        return;
    }
    
    container.innerHTML = filteredIncomplete.map(project => createIncompleteCard(project)).join('');
}

function displayBlockedItems() {
    if (!blockedData) return;
    
    const container = document.getElementById('blocked-list');
    const { blockedItems, staleItems } = blockedData;
    
    let html = '';
    
    if (blockedItems.length > 0) {
        html += `
            <div class="progress-section">
                <div class="section-header">
                    <h3 class="section-title">🚫 Blocked Items (${blockedItems.length})</h3>
                </div>
                <div class="section-content">
                    <div class="projects-list">
                        ${blockedItems.map(item => createBlockedItemCard(item)).join('')}
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
                        ${staleItems.map(item => createStaleItemCard(item)).join('')}
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

function createAnalyticsCard(project) {
    return `
        <div class="project-item">
            <div class="project-header">
                <div class="project-name">${project.projectName}</div>
                <div class="project-priority priority-${getPriorityClass(project.overallCompletionPercentage)}">
                    ${getPriorityText(project.overallCompletionPercentage)}
                </div>
            </div>
            
            <div class="project-metrics">
                <div class="metric">
                    <div class="metric-value">${project.overallCompletionPercentage}%</div>
                    <div class="metric-label">Completion</div>
                </div>
                <div class="metric">
                    <div class="metric-value">${project.velocity}</div>
                    <div class="metric-label">Velocity</div>
                </div>
                <div class="metric">
                    <div class="metric-value">${project.incompleteStories + project.incompleteTasks}</div>
                    <div class="metric-label">Incomplete</div>
                </div>
                <div class="metric">
                    <div class="metric-value">${project.blockedItems.length}</div>
                    <div class="metric-label">Blocked</div>
                </div>
            </div>
            
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${project.overallCompletionPercentage}%"></div>
            </div>
            <div class="progress-text">
                <span>${project.completedStories}/${project.totalStories} stories • ${project.completedTasks}/${project.totalTasks} tasks</span>
                <span>${project.trend}</span>
            </div>
        </div>
    `;
}

function createIncompleteCard(project) {
    const priorityClass = getPriorityClass(project.priority);
    
    return `
        <div class="project-item ${priorityClass}">
            <div class="project-header">
                <div class="project-name">${project.projectName}</div>
                <div class="project-priority priority-${priorityClass}">
                    Priority: ${project.priority}
                </div>
            </div>
            
            <div class="project-metrics">
                <div class="metric">
                    <div class="metric-value">${project.totalIncomplete}</div>
                    <div class="metric-label">Total Incomplete</div>
                </div>
                <div class="metric">
                    <div class="metric-value">${project.incompleteStories}</div>
                    <div class="metric-label">Stories</div>
                </div>
                <div class="metric">
                    <div class="metric-value">${project.incompleteTasks}</div>
                    <div class="metric-label">Tasks</div>
                </div>
                <div class="metric">
                    <div class="metric-value">${project.velocity}</div>
                    <div class="metric-label">Velocity</div>
                </div>
            </div>
            
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${project.completionPercentage}%"></div>
            </div>
            <div class="progress-text">
                <span>${project.completionPercentage}% complete</span>
                <span>${project.velocity} velocity</span>
            </div>
        </div>
    `;
}

function createBlockedItemCard(item) {
    return `
        <div class="project-item high-priority">
            <div class="project-header">
                <div class="project-name">${item.title}</div>
                <div class="project-priority priority-high">Blocked</div>
            </div>
            <div class="blocked-items">
                <h4>Project: ${item.projectName}</h4>
                <p><strong>Reason:</strong> ${item.reason || 'Unknown'}</p>
                <p><strong>Last Activity:</strong> ${formatDate(item.lastActivity)}</p>
            </div>
        </div>
    `;
}

function createStaleItemCard(item) {
    return `
        <div class="project-item medium-priority">
            <div class="project-header">
                <div class="project-name">${item.title}</div>
                <div class="project-priority priority-medium">Stale</div>
            </div>
            <div class="stale-items">
                <h4>Project: ${item.projectName}</h4>
                <p><strong>Days Since Activity:</strong> ${item.daysSinceActivity || 'Unknown'}</p>
                <p><strong>Last Activity:</strong> ${formatDate(item.lastActivity)}</p>
            </div>
        </div>
    `;
}

function getFilteredProjects(projects) {
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    const projectFilter = document.getElementById('project-filter').value;
    const minCompletion = document.getElementById('min-completion').value;
    const maxCompletion = document.getElementById('max-completion').value;
    const minVelocity = document.getElementById('min-velocity').value;
    
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

function getFilteredIncompleteWork() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    const projectFilter = document.getElementById('project-filter').value;
    
    return incompleteData.filter(project => {
        if (searchTerm && !project.projectName.toLowerCase().includes(searchTerm)) {
            return false;
        }
        if (projectFilter && project.projectName !== projectFilter) {
            return false;
        }
        return true;
    });
}

function filterData() {
    switch (currentTab) {
        case 'analytics':
            displayAnalytics();
            break;
        case 'incomplete':
            displayIncompleteWork();
            break;
        case 'blocked':
            displayBlockedItems();
            break;
    }
}

function switchTab(tabName) {
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
    
    currentTab = tabName;
}

function getPriorityClass(priority) {
    if (priority >= 80) return 'low-priority';
    if (priority >= 50) return 'medium-priority';
    return 'high-priority';
}

function getPriorityText(priority) {
    if (priority >= 80) return 'Low Priority';
    if (priority >= 50) return 'Medium Priority';
    return 'High Priority';
}

async function clearCache() {
    try {
        if (!confirm('Are you sure you want to clear the cache? This will refresh all progress data.')) {
            return;
        }
        
        updateStatus('Clearing cache...', '');
        
        const response = await fetch('/api/v2/cache/progress/clear', {
            method: 'POST'
        });
        const result = await response.json();
        
        if (result.success) {
            updateStatus('Cache cleared successfully', 'success');
            loadProgressData();
        } else {
            throw new Error(result.error || 'Failed to clear cache');
        }
    } catch (error) {
        updateStatus(`Failed to clear cache: ${error.message}`, 'error');
    }
}

function showLoading(show) {
    document.getElementById('loading').style.display = show ? 'block' : 'none';
    document.getElementById('progress-content').style.display = show ? 'none' : 'block';
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

function formatDate(dateString) {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
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
