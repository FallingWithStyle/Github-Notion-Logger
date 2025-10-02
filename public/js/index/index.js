// Available colors for projects (CSS colors) - optimized for uniqueness
const availableColors = [
    '#e74c3c', '#2ecc71', '#f1c40f', '#9b59b6', '#e67e22', '#1abc9c', '#34495e',
    '#e91e63', '#4caf50', '#ff9800', '#673ab7', '#ff5722', '#00bcd4', '#795548',
    '#607d8b', '#f44336', '#009688', '#ffc107', '#9c27b0', '#8bc34a', '#ff5722',
    '#795548', '#607d8b', '#3f51b5', '#009688', '#ffc107', '#9c27b0', '#ff5722',
    '#795548', '#607d8b', '#f44336', '#3f51b5', '#009688', '#ffc107', '#9c27b0'
];

// Project to color mapping (will be populated dynamically)
const projectColors = {};

// Track color usage to assign least used colors to new projects
const colorUsage = {};

// Cache for storing fetched results
let cachedData = null;
let lastFetchTime = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

// Initialize color usage tracking
availableColors.forEach(color => {
    colorUsage[color] = 0;
});

// Get the least used color with better uniqueness
function getLeastUsedColor() {
    let minUsage = Infinity;
    let leastUsedColor = availableColors[0];
    
    availableColors.forEach(color => {
        if (colorUsage[color] < minUsage) {
            minUsage = colorUsage[color];
            leastUsedColor = color;
        }
    });
    
    return leastUsedColor;
}

// Assign color to a new project with better uniqueness
function assignColorToProject(projectName) {
    if (!projectColors[projectName]) {
        // Try to find a color that's maximally different from already used colors
        const usedColors = Object.values(projectColors);
        let bestColor = availableColors[0];
        let maxMinDistance = 0;
        
        availableColors.forEach(color => {
            if (colorUsage[color] === 0) {
                // If color hasn't been used, prefer it
                bestColor = color;
                maxMinDistance = Infinity;
            } else {
                // Calculate minimum distance to any used color
                let minDistance = Infinity;
                usedColors.forEach(usedColor => {
                    const distance = colorDistance(color, usedColor);
                    if (distance < minDistance) {
                        minDistance = distance;
                    }
                });
                
                if (minDistance > maxMinDistance) {
                    maxMinDistance = minDistance;
                    bestColor = color;
                }
            }
        });
        
        projectColors[projectName] = bestColor;
        colorUsage[bestColor]++;
    }
    return projectColors[projectName];
}

// Calculate color distance for better uniqueness
function colorDistance(color1, color2) {
    // Convert hex to RGB
    const rgb1 = hexToRgb(color1);
    const rgb2 = hexToRgb(color2);
    
    // Calculate Euclidean distance in RGB space
    const dr = rgb1.r - rgb2.r;
    const dg = rgb1.g - rgb2.g;
    const db = rgb1.b - rgb2.b;
    
    return Math.sqrt(dr * dr + dg * dg + db * db);
}

// Convert hex color to RGB
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : {r: 0, g: 0, b: 0};
}

// Get color for a project
function getProjectColor(projectName) {
    const colorData = projectColors[projectName];
    if (colorData && colorData.hex) {
        return colorData.hex;
    }
    // Fallback to old system if no color palette data
    return assignColorToProject(projectName);
}

// Normalize project names by removing owner prefix
// This handles cases where some projects are stored with "Owner/Project-Name" format
// and others are stored without it, preventing duplicate entries in the legend
function normalizeProjectName(projectName) {
    // Remove any owner prefix (e.g., "FallingWithStyle/Project-Name" -> "Project-Name")
    return projectName.replace(/^[^\/]+\//, '');
}

// Check if cache is valid
function isCacheValid() {
    return cachedData && lastFetchTime && (Date.now() - lastFetchTime < CACHE_DURATION);
}

// Update cache info display
function updateCacheInfo() {
    const cacheInfo = document.getElementById('cache-info');
    if (lastFetchTime) {
        const timeSinceFetch = Date.now() - lastFetchTime;
        const minutesAgo = Math.floor(timeSinceFetch / 60000);
        const cacheStatus = isCacheValid() ? 'Valid' : 'Expired';
        cacheInfo.textContent = `Last fetch: ${minutesAgo} min ago (${cacheStatus})`;
    } else {
        cacheInfo.textContent = 'No cached data';
    }
}

// Calculate proportional squares for a day
function calculateProportionalSquares(projects) {
    const totalCommits = Object.values(projects).reduce((sum, count) => sum + count, 0);
    if (totalCommits === 0) return [];
    
    const squares = [];
    
    // If fewer than 10 commits, show 1 box per commit
    if (totalCommits < 10) {
        Object.entries(projects).forEach(([projectName, commitCount]) => {
            const normalizedName = normalizeProjectName(projectName);
            for (let i = 0; i < commitCount; i++) {
                squares.push(normalizedName);
            }
        });
    } else {
        // For 10+ commits, use proportional coloring with max 10 squares
        const maxSquares = 10;
        
        // Calculate proportional shares
        Object.entries(projects).forEach(([projectName, commitCount]) => {
            const proportion = commitCount / totalCommits;
            const squareCount = Math.round(proportion * maxSquares);
            const normalizedName = normalizeProjectName(projectName);
            
            for (let i = 0; i < squareCount; i++) {
                squares.push(normalizedName);
            }
        });
        
        // Ensure we don't exceed max squares
        if (squares.length > maxSquares) {
            squares.splice(maxSquares);
        }
        
        // If we have fewer than max squares, add some from the largest projects
        if (squares.length < maxSquares) {
            const sortedProjects = Object.entries(projects)
                .sort(([,a], [,b]) => b - a);
            
            for (const [projectName] of sortedProjects) {
                if (squares.length >= maxSquares) break;
                const normalizedName = normalizeProjectName(projectName);
                squares.push(normalizedName);
            }
        }
    }
    
    return squares;
}

// Create a commit square element
function createCommitSquare(projectName, index) {
    const normalizedName = normalizeProjectName(projectName);
    const square = document.createElement('div');
    square.className = 'commit-square';
    square.style.backgroundColor = getProjectColor(normalizedName);
    
    // Get project category for tooltip from the loaded project data
    const colorData = projectColors[normalizedName];
    const category = colorData?.category || 'Unknown Category';
    const tooltipText = `${normalizedName} (${category})`;
    
    square.title = tooltipText;
    
    // Add tooltip
    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip';
    tooltip.textContent = tooltipText;
    square.appendChild(tooltip);
    
    return square;
}

// Create a day row
function createDayRow(dayData) {
    const row = document.createElement('div');
    row.className = 'day-row';
    
    // Date label
    const dateLabel = document.createElement('div');
    dateLabel.className = 'date-label';
    // Fix: Treat the date as local time, not UTC
    // Split the date string and create a local date to avoid timezone shift
    const [year, month, day] = dayData.date.split('-').map(Number);
    const date = new Date(year, month - 1, day); // month is 0-indexed
    console.log('Creating date label for:', dayData.date, '-> Date object:', date, '-> Formatted:', date.toLocaleDateString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric' 
    }));
    dateLabel.textContent = date.toLocaleDateString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric' 
    });
    row.appendChild(dateLabel);
    
    // Commit squares
    const squaresContainer = document.createElement('div');
    squaresContainer.className = 'commit-squares';
    
    // Calculate proportional squares
    console.log('Calculating squares for day:', dayData.date, 'projects:', dayData.projects);
    const squares = calculateProportionalSquares(dayData.projects);
    console.log('Generated squares:', squares);
    
    // Create squares
    squares.forEach((projectName, index) => {
        console.log('Creating square for project:', projectName, 'at index:', index);
        const square = createCommitSquare(projectName, index);
        squaresContainer.appendChild(square);
    });
    
    row.appendChild(squaresContainer);
    return row;
}

// Create legend
function createLegend() {
    const legendContainer = document.getElementById('legend-items');
    legendContainer.innerHTML = '';
    
    // Get unique projects from the data and normalize them
    const uniqueProjects = new Set();
    commitData.forEach(day => {
        Object.keys(day.projects).forEach(project => {
            uniqueProjects.add(normalizeProjectName(project));
        });
    });
    
    // Convert to array and reverse to show newest projects first
    const projectsArray = Array.from(uniqueProjects).reverse();
    
    projectsArray.forEach(project => {
        const legendItem = document.createElement('div');
        legendItem.className = 'legend-item';
        
        const emoji = document.createElement('div');
        emoji.className = 'legend-emoji';
        emoji.style.backgroundColor = getProjectColor(project);
        
        const name = document.createElement('span');
        name.textContent = project;
        
        legendItem.appendChild(emoji);
        legendItem.appendChild(name);
        legendContainer.appendChild(legendItem);
    });
}

// Load and display commit data
let commitData = [];
let autoRefreshInterval = null;
let sseConnected = false;

async function loadCommitData() {
    try {
        const response = await fetch('/commit-log.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        commitData = await response.json();
        
        // Load color data from the color palette API
        try {
            // Load project colors from the color palette system
            const projectColorResponse = await fetch('/api/weekly-data');
            if (projectColorResponse.ok) {
                const weeklyData = await projectColorResponse.json();
                if (weeklyData.success && weeklyData.projectColors) {
                    // Clear existing colors and use the new color palette system
                    Object.keys(projectColors).forEach(key => delete projectColors[key]);
                    Object.assign(projectColors, weeklyData.projectColors);
                    console.log('🎨 Loaded project colors from color palette system:', Object.keys(projectColors).length, 'projects');
                }
            }
        } catch (colorError) {
            console.warn('⚠️ Could not load color data, using fallback colors:', colorError);
        }
        
        const gridContainer = document.getElementById('grid-container');
        gridContainer.innerHTML = '';
        
        // Create rows for each day (most recent first)
        console.log('Raw commit data:', commitData);
        const reversedData = commitData.slice().reverse();
        console.log('Reversed data:', reversedData);
        reversedData.forEach(dayData => {
            console.log('Processing day:', dayData.date, 'with projects:', dayData.projects);
            const row = createDayRow(dayData);
            gridContainer.appendChild(row);
        });
        
        // Create legend
        createLegend();
        
        updateStatus(`Loaded ${commitData.length} days of commit data`);
        updateCacheInfo();
        
    } catch (error) {
        console.error('Error loading commit data:', error);
        document.getElementById('grid-container').innerHTML = 
            '<div class="error">Error loading commit data. Please check that commit-log.json exists and is valid.</div>';
        updateStatus('Error loading data');
    }
}

// Fetch data from Notion
async function fetchFromNotion(params = {}) {
    const btn = document.getElementById('fetch-notion-btn');
    const originalText = btn.textContent;
    
    try {
        btn.disabled = true;
        btn.textContent = '🔄 Fetching...';
        updateStatus('Fetching data from Notion...');
        
        const search = new URLSearchParams(params).toString();
        const response = await fetch('/api/fetch-notion-data' + (search ? `?${search}` : ''));
        const result = await response.json();
        
        if (result.success) {
            // Cache the fetched data
            cachedData = result.data || commitData;
            lastFetchTime = Date.now();
            
            updateStatus(result.message);
            // No need to force reload here; SSE will trigger refresh below
            btn.classList.add('success');
            btn.textContent = '✅ Fetched!';
            setTimeout(() => {
                btn.classList.remove('success');
                btn.textContent = originalText;
            }, 2000);
        } else {
            updateStatus(`Error: ${result.error}`);
        }
        
    } catch (error) {
        console.error('Error fetching from Notion:', error);
        updateStatus('Error fetching from Notion');
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

// Incremental fetch based on last displayed date (with overlap)
async function fetchIncremental() {
    if (!Array.isArray(commitData) || commitData.length === 0) {
        // Fall back to full fetch
        return fetchFromNotion();
    }
    const lastDate = commitData[commitData.length - 1]?.date;
    const params = { incremental: 'true', overlapDays: '1' };
    if (lastDate) params.since = lastDate; // server will subtract overlapDays
    return fetchFromNotion(params);
}

// Migrate existing projects to use color palette system
async function migrateColors() {
    const btn = document.getElementById('migrate-colors-btn');
    const originalText = btn.textContent;
    
    try {
        btn.textContent = '🔄 Migrating...';
        btn.disabled = true;
        updateStatus('Migrating project colors...');
        
        const response = await fetch('/api/color-palette/migrate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            updateStatus(`Color migration completed: ${result.stats.migrated} migrated, ${result.stats.skipped} skipped`);
            btn.classList.add('success');
            
            // Reload the data to show new colors
            await loadCommitData();
            
            setTimeout(() => {
                btn.classList.remove('success');
            }, 3000);
        } else {
            throw new Error(result.error || 'Migration failed');
        }
        
    } catch (error) {
        console.error('Error migrating colors:', error);
        updateStatus(`Migration failed: ${error.message}`);
        btn.classList.add('error');
        
        setTimeout(() => {
            btn.classList.remove('error');
        }, 3000);
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

// Toggle auto-refresh
function toggleAutoRefresh() {
    const btn = document.getElementById('auto-refresh-btn');
    
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
        btn.textContent = '🔄 Auto-refresh';
        btn.classList.remove('success');
        updateStatus('Auto-refresh disabled');
    } else {
        autoRefreshInterval = setInterval(loadCommitData, 30000); // Refresh every 30 seconds
        btn.textContent = '⏸️ Auto-refresh ON';
        btn.classList.add('success');
        updateStatus('Auto-refresh enabled (30s interval)');
    }
}

// Update status message
function updateStatus(message) {
    document.getElementById('status').textContent = message;
}

// Settings functionality
let timezoneConfig = null;

async function loadTimezoneConfig() {
    try {
        const response = await fetch('/api/timezone-config');
        if (response.ok) {
            const result = await response.json();
            if (result.success) {
                timezoneConfig = result.config;
                populateTimezoneSelect(result.availableTimezones);
                updateCurrentTimeInfo(result.timezoneInfo);
            }
        }
    } catch (error) {
        console.error('Error loading timezone config:', error);
    }
}

function populateTimezoneSelect(timezones) {
    const select = document.getElementById('timezone-select');
    select.innerHTML = '';
    
    timezones.forEach(tz => {
        const option = document.createElement('option');
        option.value = tz.value;
        option.textContent = tz.label;
        if (timezoneConfig && tz.value === timezoneConfig.timezone) {
            option.selected = true;
        }
        select.appendChild(option);
    });
}

function updateCurrentTimeInfo(timezoneInfo) {
    document.getElementById('current-time').textContent = timezoneInfo.currentTime;
    document.getElementById('current-cutoff').textContent = timezoneInfo.cutoffTime;
    
    // Update cutoff inputs
    if (timezoneConfig) {
        document.getElementById('cutoff-hour').value = timezoneConfig.cutoffHour;
        document.getElementById('cutoff-minute').value = timezoneConfig.cutoffMinute;
    }
}

async function saveTimezoneConfig() {
    try {
        const timezone = document.getElementById('timezone-select').value;
        const cutoffHour = parseInt(document.getElementById('cutoff-hour').value);
        const cutoffMinute = parseInt(document.getElementById('cutoff-minute').value);

        const response = await fetch('/api/timezone-config', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                timezone,
                cutoffHour,
                cutoffMinute
            })
        });

        if (response.ok) {
            const result = await response.json();
            if (result.success) {
                timezoneConfig = result.config;
                updateStatus('Timezone settings saved successfully');
                closeSettingsModal();
                // Reload data to apply new timezone settings
                await loadCommitData();
            } else {
                updateStatus(`Error: ${result.error}`);
            }
        } else {
            updateStatus('Error saving timezone settings');
        }
    } catch (error) {
        console.error('Error saving timezone config:', error);
        updateStatus('Error saving timezone settings');
    }
}

function openSettingsModal() {
    document.getElementById('settings-modal').style.display = 'block';
    loadTimezoneConfig();
}

function closeSettingsModal() {
    document.getElementById('settings-modal').style.display = 'none';
}

// Event listeners
document.getElementById('fetch-notion-btn').addEventListener('click', () => fetchFromNotion());
document.getElementById('fetch-incremental-btn').addEventListener('click', fetchIncremental);
document.getElementById('migrate-colors-btn').addEventListener('click', migrateColors);
document.getElementById('auto-refresh-btn').addEventListener('click', toggleAutoRefresh);
document.getElementById('settings-btn').addEventListener('click', openSettingsModal);
document.getElementById('save-settings-btn').addEventListener('click', saveTimezoneConfig);
document.getElementById('cancel-settings-btn').addEventListener('click', closeSettingsModal);

// Close modal when clicking outside or on close button
document.querySelector('.close').addEventListener('click', closeSettingsModal);
document.getElementById('settings-modal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('settings-modal')) {
        closeSettingsModal();
    }
});

// Connect to server-sent events to auto-refresh when data updates
function connectSSE() {
    if (sseConnected) return;
    try {
        const evt = new EventSource('/events');
        evt.addEventListener('commit-log-updated', async () => {
            await loadCommitData();
            updateStatus('Data updated');
        });
        evt.onerror = () => {
            // Try to reconnect after a delay
            setTimeout(() => {
                sseConnected = false;
                connectSSE();
            }, 3000);
        };
        evt.onopen = () => { sseConnected = true; };
    } catch (e) {
        // SSE not supported
    }
}

// Load data when page loads
document.addEventListener('DOMContentLoaded', () => {
    loadCommitData();
    updateCacheInfo();
    connectSSE();
});
