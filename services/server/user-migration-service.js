// Migrate old 3-1-5 scale user answers to new 2-1-5 scale
function migrateOldUserAnswers(userAnswers) {
  const migrated = {};
  
  Object.entries(userAnswers).forEach(([projectName, answers]) => {
    migrated[projectName] = { ...answers };
    
    // If old 3-1-5 scale properties exist, migrate them to new 2-1-5 scale
    if (answers.working && !answers.head) {
      // Convert "working" (3-1-5) to "head" (2-1-5)
      // Map: 3→2, 1→1, 5→5 (same scale, different property name)
      migrated[projectName].head = answers.working;
      console.log(`🔄 Migrated ${projectName}: working(${answers.working}) → head(${answers.working})`);
    }
    
    if (answers.improve && !answers.heart) {
      // Convert "improve" (3-1-5) to "heart" (2-1-5)
      // Map: 3→2, 1→1, 5→5 (same scale, different property name)
      migrated[projectName].heart = answers.improve;
      console.log(`🔄 Migrated ${projectName}: improve(${answers.improve}) → heart(${answers.improve})`);
    }
    
    // Note: "start" property from old 3-1-5 scale is not used in new 2-1-5 scale
    // It was about what to start next, which is now covered by the status field
  });
  
  return migrated;
}

module.exports = {
  migrateOldUserAnswers
};
