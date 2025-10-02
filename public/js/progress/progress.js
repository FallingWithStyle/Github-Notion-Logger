let allProjects = [];
let filteredProjects = [];
let currentView = 'bar'; // Default to bar view
let currentSort = 'completion-desc'; // Default sort

document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
    loadProgressData();
    loadWeeklyStatusData();
});

function setupEventListeners() {
    document.getElementById('refresh-btn').addEventListener('click', loadProgressData);
    document.getElementById('scan-all-btn').addEventListener('click', scanAllProjects);
    document.getElementById('status-filter').addEventListener('change', filterProjects);
    document.getElementById('weekly-status-filter').addEventListener('change', filterProjects);
    document.getElementById('search-filter').addEventListener('input', filterProjects);
    document.getElementById('bar-view-btn').addEventListener('click', () => switchView('bar'));
    document.getElementById('card-view-btn').addEventListener('click', () => switchView('card'));
    document.getElementById('sort-select').addEventListener('change', handleSortChange);
}

async function loadProgressData() {
    try {
        updateStatus('Loading progress data...', '');
        showLoading(true);

        // Load repositories and their progress
        const reposResponse = await fetch('/api/prd-stories/repositories');
        const reposData = await reposResponse.json();

        if (!reposData.success) {
            throw new Error(reposData.error || 'Failed to load repositories');
        }

        allProjects = reposData.repositories || [];
        filteredProjects = [...allProjects];

        updateStats();
        displayProjects();
        loadIncompleteStories();

        updateStatus('Progress data loaded successfully', 'success');
    } catch (error) {
        console.error('Error loading progress data:', error);
        updateStatus(`Failed to load progress data: ${error.message}`, 'error');
    } finally {
        showLoading(false);
    }
}

async function scanAllProjects() {
    try {
        updateStatus('Scanning all projects...', '');
        document.getElementById('scan-all-btn').disabled = true;
        document.getElementById('scan-all-btn').textContent = '⏳ Scanning...';

        const projectsToScan = allProjects.filter(p => !p.ignored);
        let completed = 0;

        for (const project of projectsToScan) {
            try {
                await scanProject(project.name);
                completed++;
                updateStatus(`Scanning projects... ${completed}/${projectsToScan.length}`, '');
            } catch (error) {
                console.warn(`Failed to scan ${project.name}:`, error);
            }
        }

        // Reload data after scanning
        await loadProgressData();
        updateStatus(`Successfully scanned ${completed} projects`, 'success');
    } catch (error) {
        console.error('Error scanning projects:', error);
        updateStatus(`Failed to scan projects: ${error.message}`, 'error');
    } finally {
        document.getElementById('scan-all-btn').disabled = false;
        document.getElementById('scan-all-btn').textContent = '🔍 Scan All Projects';
    }
}

async function scanProject(projectName) {
    const response = await fetch('/api/prd-stories/process-repo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repository: projectName })
    });

    const result = await response.json();
    if (!result.success) {
        throw new Error(result.error || 'Scan failed');
    }
}

function updateStats() {
    const totalProjects = allProjects.length;
    const completeProjects = allProjects.filter(p => p.progress === 100).length;
    const incompleteStories = allProjects.reduce((sum, p) => sum + (p.storyCount - (p.progressDetails?.completedStories || 0)), 0);
    const overallProgress = totalProjects > 0 ? Math.round(allProjects.reduce((sum, p) => sum + (p.progress || 0), 0) / totalProjects) : 0;

    document.getElementById('total-projects').textContent = totalProjects;
    document.getElementById('complete-projects').textContent = completeProjects;
    document.getElementById('incomplete-stories').textContent = incompleteStories;
    document.getElementById('overall-progress').textContent = `${overallProgress}%`;
}

function displayProjects() {
    const container = document.getElementById('projects-container');
    
    if (filteredProjects.length === 0) {
        container.innerHTML = '<div class="loading">No projects found matching your filters.</div>';
        return;
    }

    // Sort projects before displaying
    const sortedProjects = sortProjects([...filteredProjects]);

    if (currentView === 'bar') {
        container.innerHTML = `
            <div class="projects-bar">
                ${sortedProjects.map(project => createProjectBar(project)).join('')}
            </div>
        `;
    } else {
        container.innerHTML = `
            <div class="projects-grid">
                ${sortedProjects.map(project => createProjectCard(project)).join('')}
            </div>
        `;
    }
}

function switchView(view) {
    currentView = view;
    
    // Update button states
    document.getElementById('bar-view-btn').classList.toggle('active', view === 'bar');
    document.getElementById('card-view-btn').classList.toggle('active', view === 'card');
    
    // Redisplay projects with new view
    displayProjects();
}

function handleSortChange() {
    currentSort = document.getElementById('sort-select').value;
    displayProjects();
}

function sortProjects(projects) {
    return projects.sort((a, b) => {
        switch (currentSort) {
            case 'completion-desc':
                return (b.progress || 0) - (a.progress || 0);
            case 'completion-asc':
                return (a.progress || 0) - (b.progress || 0);
            case 'name-asc':
                return a.name.localeCompare(b.name);
            case 'name-desc':
                return b.name.localeCompare(a.name);
            case 'stories-desc':
                return (b.storyCount || 0) - (a.storyCount || 0);
            case 'stories-asc':
                return (a.storyCount || 0) - (b.storyCount || 0);
            default:
                return 0;
        }
    });
}

function createProjectBar(project) {
    const statusClass = getStatusClass(project.status);
    const progress = project.progress || 0;
    const storyCount = project.storyCount || 0;
    const taskCount = project.taskCount || 0;
    const completedStories = project.progressDetails?.completedStories || 0;
    const completedTasks = project.progressDetails?.completedTasks || 0;
    const weeklyStatusBadge = createWeeklyStatusBadge(project.name);

    return `
        <div class="project-bar" data-project="${project.name}">
            <div class="project-bar-info">
                <div class="project-bar-name">${project.name}${weeklyStatusBadge}</div>
                <span class="project-bar-status ${statusClass}">${project.status || 'unknown'}</span>
            </div>
            <div class="project-bar-progress">
                <div class="project-bar-progress-bar">
                    <div class="project-bar-progress-fill" style="width: ${progress}%"></div>
                </div>
                <div class="project-bar-progress-text">${progress}% Complete</div>
            </div>
            <div class="project-bar-stats">
                <div class="project-bar-stat-value">${completedStories}/${storyCount}</div>
                <div class="project-bar-stat-label">Stories</div>
            </div>
            <div class="project-bar-stats">
                <div class="project-bar-stat-value">${completedTasks}/${taskCount}</div>
                <div class="project-bar-stat-label">Tasks</div>
            </div>
            <div class="project-bar-actions">
                <button class="btn btn-sm primary" onclick="scanProject('${project.name}')">🔍 Scan</button>
                <button class="btn btn-sm secondary" onclick="toggleProjectDetails('${project.name}')">📋 Details</button>
            </div>
            <div class="project-details"></div>
        </div>
    `;
}

function createProjectCard(project) {
    const statusClass = getStatusClass(project.status);
    const progress = project.progress || 0;
    const storyCount = project.storyCount || 0;
    const taskCount = project.taskCount || 0;
    const completedStories = project.progressDetails?.completedStories || 0;
    const completedTasks = project.progressDetails?.completedTasks || 0;
    const weeklyStatusBadge = createWeeklyStatusBadge(project.name);

    return `
        <div class="project-card" data-project="${project.name}">
            <div class="project-header">
                <div class="project-name">${project.name}${weeklyStatusBadge}</div>
                <span class="project-status ${statusClass}">${project.status || 'unknown'}</span>
            </div>
            <div class="project-body">
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${progress}%"></div>
                </div>
                <div class="project-stats">
                    <div class="stat">
                        <div class="stat-value">${completedStories}/${storyCount}</div>
                        <div class="stat-label">Stories</div>
                    </div>
                    <div class="stat">
                        <div class="stat-value">${completedTasks}/${taskCount}</div>
                        <div class="stat-label">Tasks</div>
                    </div>
                </div>
                <div class="project-actions">
                    <button class="btn btn-sm primary" onclick="scanProject('${project.name}')">🔍 Scan</button>
                    <button class="btn btn-sm secondary" onclick="toggleProjectDetails('${project.name}')">📋 Details</button>
                </div>
                <div class="project-details"></div>
            </div>
        </div>
    `;
}

function getStatusClass(status) {
    switch (status) {
        case 'prd-and-tasks': return 'status-complete';
        case 'prd-only':
        case 'tasks-only': return 'status-progress';
        case 'no-files': return 'status-no-files';
        default: return 'status-no-files';
    }
}

async function loadIncompleteStories() {
    try {
        // This would need a new API endpoint to get incomplete stories across all projects
        // For now, we'll show a placeholder
        const container = document.getElementById('incomplete-stories-list');
        container.innerHTML = '<div class="loading">Incomplete stories feature coming soon...</div>';
    } catch (error) {
        console.error('Error loading incomplete stories:', error);
    }
}

function filterProjects() {
    const statusFilter = document.getElementById('status-filter').value;
    const weeklyStatusFilter = document.getElementById('weekly-status-filter').value;
    const searchFilter = document.getElementById('search-filter').value.toLowerCase();

    filteredProjects = allProjects.filter(project => {
        const matchesStatus = !statusFilter || project.status === statusFilter;
        const matchesWeeklyStatus = !weeklyStatusFilter || weeklyStatusData.get(project.name) === weeklyStatusFilter;
        const matchesSearch = !searchFilter || project.name.toLowerCase().includes(searchFilter);
        return matchesStatus && matchesWeeklyStatus && matchesSearch;
    });

    displayProjects();
}

function updateStatus(message, type) {
    const statusEl = document.getElementById('status-message');
    statusEl.textContent = message;
    statusEl.className = type ? `status-message ${type}` : 'status-message';
}

function showLoading(show) {
    const container = document.getElementById('projects-container');
    if (show) {
        container.innerHTML = '<div class="loading">Loading project data...</div>';
    }
}

// Track expanded projects and epics
const expandedProjects = new Set();
const expandedEpics = new Set();
const projectDetailsCache = new Map();
const weeklyStatusData = new Map();

async function toggleProjectDetails(projectName) {
    const projectElement = document.querySelector(`[data-project="${projectName}"]`);
    if (!projectElement) {
        console.error(`Project element not found for ${projectName}`);
        return;
    }

    const detailsElement = projectElement.querySelector('.project-details');
    if (!detailsElement) {
        console.error(`Details element not found for ${projectName}`);
        return;
    }

    if (expandedProjects.has(projectName)) {
        // Collapse
        detailsElement.classList.remove('expanded');
        expandedProjects.delete(projectName);
    } else {
        // Expand
        detailsElement.classList.add('expanded');
        expandedProjects.add(projectName);
        
        // Load details if not cached
        if (!projectDetailsCache.has(projectName)) {
            await loadProjectDetails(projectName, detailsElement);
        } else {
            displayProjectDetails(projectName, detailsElement, projectDetailsCache.get(projectName));
        }
    }
}

async function loadProjectDetails(projectName, detailsElement) {
    detailsElement.innerHTML = '<div class="loading-details">Loading project details...</div>';
    
    try {
        const response = await fetch(`/api/project-progress/${encodeURIComponent(projectName)}`);
        const result = await response.json();
        
        if (result.success) {
            projectDetailsCache.set(projectName, result.data);
            displayProjectDetails(projectName, detailsElement, result.data);
        } else {
            detailsElement.innerHTML = `<div class="error">Failed to load details: ${result.error}</div>`;
        }
    } catch (error) {
        console.error('Error loading project details:', error);
        detailsElement.innerHTML = `<div class="error">Error loading project details: ${error.message}</div>`;
    }
}

function displayProjectDetails(projectName, detailsElement, projectData) {
    const { stories = [], tasks = [] } = projectData;
    
    // Group stories by status for better organization
    const storiesByStatus = {
        'Active': [],
        'Planning': [],
        'Review': [],
        'Done': [],
        'Idea': []
    };
    
    stories.forEach(story => {
        const status = story.status || 'Idea';
        if (storiesByStatus[status]) {
            storiesByStatus[status].push(story);
        } else {
            storiesByStatus['Idea'].push(story);
        }
    });

    // Group tasks by story context
    const tasksByStory = {};
    tasks.forEach(task => {
        const storyContext = task.storyContext || 'General Tasks';
        if (!tasksByStory[storyContext]) {
            tasksByStory[storyContext] = [];
        }
        tasksByStory[storyContext].push(task);
    });

    let html = `
        <div class="project-details-header">
            <div class="project-details-title">${projectName} - Project Details</div>
            <button class="project-details-close" onclick="toggleProjectDetails('${projectName}')">×</button>
        </div>
    `;

    // Display stories grouped by status
    Object.keys(storiesByStatus).forEach(status => {
        const statusStories = storiesByStatus[status];
        if (statusStories.length === 0) return;
        
        const statusKey = `${projectName}-${status}`;
        const isExpanded = expandedEpics.has(statusKey);
        const statusEmoji = getStatusEmoji(status);
        
        html += `
            <div class="epic-section" data-epic="${statusKey}">
                <div class="epic-header" onclick="toggleEpic('${projectName}', '${status}')">
                    <div class="epic-title">${statusEmoji} ${status} Stories (${statusStories.length})</div>
                    <button class="epic-toggle ${isExpanded ? 'expanded' : ''}">▶</button>
                </div>
                <div class="epic-content ${isExpanded ? 'expanded' : 'collapsed'}">
                    ${statusStories.map(story => createStoryHTML(story, tasksByStory)).join('')}
                </div>
            </div>
        `;
    });

    // Display orphaned tasks (tasks without story context)
    const orphanedTasks = tasksByStory['General Tasks'] || [];
    if (orphanedTasks.length > 0) {
        const tasksKey = `${projectName}-General Tasks`;
        const isTasksExpanded = expandedEpics.has(tasksKey);
        html += `
            <div class="epic-section" data-epic="${tasksKey}">
                <div class="epic-header" onclick="toggleEpic('${projectName}', 'General Tasks')">
                    <div class="epic-title">General Tasks</div>
                    <button class="epic-toggle ${isTasksExpanded ? 'expanded' : ''}">▶</button>
                </div>
                <div class="epic-content ${isTasksExpanded ? 'expanded' : 'collapsed'}">
                    <div class="task-list">
                        ${orphanedTasks.map(task => createTaskHTML(task)).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    if (stories.length === 0 && tasks.length === 0) {
        html += '<div class="loading-details">No stories or tasks found for this project.</div>';
    }

    detailsElement.innerHTML = html;
}

function createStoryHTML(story, tasksByStory) {
    const storyTasks = tasksByStory[story.title] || [];
    const completedTasks = storyTasks.filter(task => task.completed).length;
    const totalTasks = storyTasks.length;
    
    return `
        <div class="story-item">
            <div class="story-title">${story.title}</div>
            <span class="story-status ${story.status ? story.status.toLowerCase() : 'idea'}">${story.status || 'Idea'}</span>
            ${story.description ? `<div style="font-size: 0.9rem; color: #666; margin-top: 0.25rem;">${story.description}</div>` : ''}
            ${totalTasks > 0 ? `
                <div class="task-list">
                    <div style="font-size: 0.8rem; color: #666; margin-bottom: 0.5rem;">
                        Tasks: ${completedTasks}/${totalTasks} completed
                    </div>
                    ${storyTasks.map(task => createTaskHTML(task)).join('')}
                </div>
            ` : ''}
        </div>
    `;
}

function createTaskHTML(task) {
    return `
        <div class="task-item">
            <span class="task-checkbox">${task.completed ? '☑️' : '☐'}</span>
            <span class="task-description ${task.completed ? 'completed' : ''}">${task.description}</span>
        </div>
    `;
}

async function loadWeeklyStatusData() {
    try {
        const response = await fetch('/api/projects');
        const result = await response.json();
        
        if (result.success && result.projects) {
            weeklyStatusData.clear();
            result.projects.forEach(project => {
                if (project.status && project.status !== 'unknown') {
                    weeklyStatusData.set(project.name, project.status);
                }
            });
            console.log(`📊 Loaded weekly status data for ${weeklyStatusData.size} projects`);
            
            // Refresh the display to show status badges
            if (allProjects.length > 0) {
                displayProjects();
            }
        }
    } catch (error) {
        console.warn('⚠️ Could not load weekly status data:', error.message);
    }
}

function createWeeklyStatusBadge(projectName) {
    const status = weeklyStatusData.get(projectName);
    if (!status) return '';

    const statusMap = {
        'idea': { emoji: '💡', text: 'Idea' },
        'parking-lot': { emoji: '🅿️', text: 'Parking Lot' },
        'planning': { emoji: '📝', text: 'Planning' },
        'active': { emoji: '🚀', text: 'Active' },
        'paused': { emoji: '⏸️', text: 'Paused' },
        'released': { emoji: '🌍', text: 'Released' },
        'done': { emoji: '✅', text: 'Done' }
    };

    const statusInfo = statusMap[status] || { emoji: '❓', text: status };
    
    return `
        <span class="weekly-status-badge ${status}" title="Weekly Planning Status: ${statusInfo.text}">
            ${statusInfo.emoji} ${statusInfo.text}
        </span>
    `;
}

function getStatusEmoji(status) {
    const statusEmojis = {
        'Active': '🚀',
        'Planning': '📝',
        'Review': '👀',
        'Done': '✅',
        'Idea': '💡'
    };
    return statusEmojis[status] || '📋';
}

function toggleEpic(projectName, statusTitle) {
    const statusKey = `${projectName}-${statusTitle}`;
    const statusElement = document.querySelector(`[data-epic="${statusKey}"]`);
    
    if (!statusElement) {
        console.error(`Status element not found for ${statusKey}`);
        return;
    }

    const contentElement = statusElement.querySelector('.epic-content');
    const toggleElement = statusElement.querySelector('.epic-toggle');
    
    if (!contentElement || !toggleElement) {
        console.error(`Status content or toggle element not found for ${statusKey}`);
        return;
    }

    if (expandedEpics.has(statusKey)) {
        // Collapse
        contentElement.classList.remove('expanded');
        contentElement.classList.add('collapsed');
        toggleElement.classList.remove('expanded');
        expandedEpics.delete(statusKey);
    } else {
        // Expand
        contentElement.classList.remove('collapsed');
        contentElement.classList.add('expanded');
        toggleElement.classList.add('expanded');
        expandedEpics.add(statusKey);
    }
}
