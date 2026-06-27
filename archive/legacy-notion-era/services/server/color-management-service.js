// Available colors for projects (matching the frontend)
const availableColors = ['🟩', '🟥', '🟪', '🟦', '🟨', '🟧', '🟫', '⬛', '⬜', '🟣', '🟢', '🔴', '🔵', '🟡', '🟠'];

// Function to get least used color for new projects
function getLeastUsedColor(projectColors) {
  const colorUsage = {};
  availableColors.forEach(color => {
    colorUsage[color] = 0;
  });
  
  Object.values(projectColors).forEach(color => {
    if (colorUsage[color] !== undefined) {
      colorUsage[color]++;
    }
  });
  
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

// Function to assign color to project
function assignColorToProject(projectName, projectColors) {
  if (!projectColors[projectName]) {
    const color = getLeastUsedColor(projectColors);
    projectColors[projectName] = color;
  }
  return projectColors[projectName];
}

module.exports = {
  getLeastUsedColor,
  assignColorToProject,
  availableColors
};
