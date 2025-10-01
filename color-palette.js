/**
 * Color Palette System for GitHub Notion Logger
 * 
 * Generates category-based color bands and assigns colors to projects.
 * Each project category gets its own "color band" with distinct base hues.
 * Within each band, multiple evenly spaced colors are generated for projects.
 */

const fs = require('fs');
const path = require('path');

// Color palette configuration
const COLOR_PALETTE_CONFIG = {
  // Base hues for different categories (0-360 degrees)
  categoryHues: {
    'Writing & Story Tools': 280,        // Purple
    'Infrastructure & Utilities': 200,   // Blue
    'Avoros (Shared Fantasy/Game World)': 120, // Green
    'Miscellaneous / Standalone': 30,    // Orange
    'Development': 0,                    // Red
    'Tools': 60,                         // Yellow
    'Research': 300,                     // Magenta
    'Design': 320,                       // Pink
    'Marketing': 15,                     // Red-orange
    'Documentation': 180,                // Cyan
    'Testing': 240,                      // Blue-purple
    'Deployment': 140,                   // Green-cyan
    'Maintenance': 40,                   // Yellow-orange
    'Experimental': 260,                 // Blue-purple
    'Legacy': 20                         // Red-orange
  },
  
  // HSL color generation parameters
  hueRange: 30,        // ±15 degrees around base hue
  saturationRange: [40, 80],  // Min and max saturation
  lightnessRange: [35, 75],   // Min and max lightness
  colorsPerBand: 8,    // Number of colors per category band
  
  // Fallback colors for unknown categories
  fallbackHues: [0, 60, 120, 180, 240, 300],
  fallbackSaturation: 60,
  fallbackLightness: 50
};

// Storage for generated color palettes
let colorPalettes = {};
let projectColors = {};

// File path for persistent storage
const COLOR_PALETTE_PATH = path.join(process.env.DATA_DIR || path.join(__dirname, 'data'), 'color-palettes.json');

/**
 * Load color palettes from persistent storage
 */
function loadColorPalettes() {
  try {
    if (fs.existsSync(COLOR_PALETTE_PATH)) {
      const data = fs.readFileSync(COLOR_PALETTE_PATH, 'utf8');
      const stored = JSON.parse(data);
      colorPalettes = stored.colorPalettes || {};
      projectColors = stored.projectColors || {};
      console.log('🎨 Loaded color palettes from storage');
    }
  } catch (error) {
    console.warn('⚠️ Could not load color palettes, starting fresh:', error.message);
    colorPalettes = {};
    projectColors = {};
  }
}

/**
 * Save color palettes to persistent storage
 */
function saveColorPalettes() {
  try {
    const dataDir = path.dirname(COLOR_PALETTE_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    const data = {
      colorPalettes,
      projectColors,
      lastUpdated: new Date().toISOString()
    };
    
    fs.writeFileSync(COLOR_PALETTE_PATH, JSON.stringify(data, null, 2));
    console.log('🎨 Saved color palettes to storage');
  } catch (error) {
    console.error('❌ Error saving color palettes:', error.message);
  }
}

/**
 * Convert HSL to HEX color
 */
function hslToHex(h, s, l) {
  h = h / 360;
  s = s / 100;
  l = l / 100;
  
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  
  let r, g, b;
  
  if (s === 0) {
    r = g = b = l; // achromatic
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  
  const toHex = (c) => {
    const hex = Math.round(c * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Generate a color palette for a specific project category
 */
function generatePalette(projectType) {
  if (!projectType) {
    projectType = 'Miscellaneous / Standalone';
  }
  
  // Check if palette already exists
  if (colorPalettes[projectType]) {
    return colorPalettes[projectType];
  }
  
  console.log(`🎨 Generating color palette for category: ${projectType}`);
  
  // Get base hue for this category
  let baseHue = COLOR_PALETTE_CONFIG.categoryHues[projectType];
  
  // If no specific hue defined, use fallback
  if (baseHue === undefined) {
    // Use a hash of the category name to get a consistent fallback hue
    const hash = projectType.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    baseHue = Math.abs(hash) % 360;
    console.log(`🎨 Using generated fallback hue ${baseHue} for category: ${projectType}`);
  }
  
  const palette = [];
  const { hueRange, saturationRange, lightnessRange, colorsPerBand } = COLOR_PALETTE_CONFIG;
  
  // Generate colors within the hue range
  for (let i = 0; i < colorsPerBand; i++) {
    // Distribute hues within the range
    const hueOffset = (i / (colorsPerBand - 1)) * hueRange - (hueRange / 2);
    const hue = (baseHue + hueOffset + 360) % 360;
    
    // Vary saturation and lightness for visual distinction
    const saturation = saturationRange[0] + (i % 2) * (saturationRange[1] - saturationRange[0]);
    const lightness = lightnessRange[0] + Math.floor(i / 2) * (lightnessRange[1] - lightnessRange[0]) / Math.ceil(colorsPerBand / 2);
    
    const hex = hslToHex(hue, saturation, lightness);
    
    palette.push({
      hex,
      hsl: { h: hue, s: saturation, l: lightness },
      index: i
    });
  }
  
  // Store the palette
  colorPalettes[projectType] = palette;
  saveColorPalettes();
  
  console.log(`✅ Generated ${palette.length} colors for category: ${projectType}`);
  return palette;
}

/**
 * Assign a color to a project based on its category
 */
function assignColor(projectType, projectName = null) {
  if (!projectType) {
    projectType = 'Miscellaneous / Standalone';
  }
  
  // Check if project already has a color assigned
  if (projectName && projectColors[projectName]) {
    return projectColors[projectName];
  }
  
  // Generate or get existing palette for this category
  const palette = generatePalette(projectType);
  
  // Find the least used color in this category
  const usedColors = new Set();
  Object.entries(projectColors).forEach(([name, color]) => {
    if (color.category === projectType) {
      usedColors.add(color.hex);
    }
  });
  
  // Find first unused color, or least used if all are used
  let selectedColor = palette[0];
  let minUsage = Infinity;
  
  for (const color of palette) {
    const usageCount = Array.from(usedColors).filter(hex => hex === color.hex).length;
    if (usageCount < minUsage) {
      minUsage = usageCount;
      selectedColor = color;
    }
  }
  
  const assignedColor = {
    hex: selectedColor.hex,
    hsl: selectedColor.hsl,
    category: projectType,
    assignedAt: new Date().toISOString()
  };
  
  // Store the assignment if project name provided
  if (projectName) {
    projectColors[projectName] = assignedColor;
    saveColorPalettes();
    console.log(`🎨 Assigned color ${selectedColor.hex} to project: ${projectName} (${projectType})`);
  }
  
  return assignedColor;
}

/**
 * Get color for a specific project
 */
function getProjectColor(projectName) {
  return projectColors[projectName] || null;
}

/**
 * Update project color assignment
 */
function updateProjectColor(projectName, projectType) {
  const newColor = assignColor(projectType, projectName);
  console.log(`🎨 Updated color for ${projectName}: ${newColor.hex}`);
  return newColor;
}

/**
 * Get all color palettes
 */
function getAllPalettes() {
  return colorPalettes;
}

/**
 * Get all project color assignments
 */
function getAllProjectColors() {
  return projectColors;
}

/**
 * Clear all color data (useful for testing)
 */
function clearColorData() {
  colorPalettes = {};
  projectColors = {};
  saveColorPalettes();
  console.log('🧹 Cleared all color data');
}

/**
 * Migrate existing projects to use color system
 */
function migrateExistingProjects(projects) {
  console.log('🔄 Migrating existing projects to color system...');
  
  let migratedCount = 0;
  
  projects.forEach(project => {
    if (project.name && project.category && !projectColors[project.name]) {
      const color = assignColor(project.category, project.name);
      project.color = color;
      migratedCount++;
    }
  });
  
  console.log(`✅ Migrated ${migratedCount} projects to color system`);
  return projects;
}

/**
 * Get color statistics
 */
function getColorStats() {
  const stats = {
    totalPalettes: Object.keys(colorPalettes).length,
    totalProjects: Object.keys(projectColors).length,
    categoryBreakdown: {},
    paletteBreakdown: {}
  };
  
  // Count projects per category
  Object.values(projectColors).forEach(color => {
    const category = color.category;
    stats.categoryBreakdown[category] = (stats.categoryBreakdown[category] || 0) + 1;
  });
  
  // Count colors per palette
  Object.entries(colorPalettes).forEach(([category, palette]) => {
    stats.paletteBreakdown[category] = palette.length;
  });
  
  return stats;
}

// Helper function to convert HEX to HSL
function hexToHsl(hex) {
  // Remove # if present
  hex = hex.replace('#', '');
  
  // Parse RGB values
  const r = parseInt(hex.substr(0, 2), 16) / 255;
  const g = parseInt(hex.substr(2, 2), 16) / 255;
  const b = parseInt(hex.substr(4, 2), 16) / 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  
  if (max === min) {
    h = s = 0; // achromatic
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  
  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  };
}

// Helper function to generate palette from a specific hue
function generatePaletteFromHue(baseHue) {
  const colors = [];
  const saturation = 80;
  const lightnessValues = [45, 55, 35, 65, 25, 75];
  
  lightnessValues.forEach(lightness => {
    colors.push({
      hex: hslToHex(baseHue, saturation, lightness),
      hsl: { h: baseHue, s: saturation, l: lightness }
    });
  });
  
  return colors;
}

// Helper function to convert HSL to HEX (duplicate removed)

// Initialize the color palette system
loadColorPalettes();

module.exports = {
  generatePalette,
  assignColor,
  getProjectColor,
  updateProjectColor,
  getAllPalettes,
  getAllProjectColors,
  clearColorData,
  migrateExistingProjects,
  getColorStats,
  loadColorPalettes,
  saveColorPalettes,
  hexToHsl,
  generatePaletteFromHue,
  hslToHex
};
