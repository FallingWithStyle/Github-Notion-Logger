# Timezone-Aware Commit Date Calculation

## Overview

The commit activity visualizer now includes a timezone-aware date calculation system that allows you to configure when commits should count as the previous day vs. the current day.

## How It Works

By default, the system uses **Eastern Time (ET)** with a **6:00 AM cutoff**. This means:

- **Commits before 6:00 AM ET** count as work for the **previous day**
- **Commits at or after 6:00 AM ET** count as work for the **current day**

## Example Scenarios

### Scenario 1: Late Night Coding
- You commit at **1:00 AM ET** on January 23rd
- This counts as work for **January 22nd** (before the 6 AM cutoff)

### Scenario 2: Early Morning Start
- You commit at **6:30 AM ET** on January 23rd  
- This counts as work for **January 23rd** (after the 6 AM cutoff)

### Scenario 3: All-Nighter
- You commit at **3:00 AM ET** on January 23rd
- This counts as work for **January 22nd** (before the 6 AM cutoff)

## Configuration

### Accessing Settings
1. Open the commit activity visualizer
2. Click the **⚙️ Settings** button
3. Configure your timezone and cutoff time
4. Click **💾 Save Settings**

### Available Timezones
- Eastern Time (ET)
- Central Time (CT) 
- Mountain Time (MT)
- Pacific Time (PT)
- Alaska Time (AKT)
- Hawaii Time (HST)
- Greenwich Mean Time (GMT)
- Central European Time (CET)
- Japan Standard Time (JST)
- China Standard Time (CST)
- Australian Eastern Time (AET)

### Cutoff Time
- **Hour**: 0-23 (24-hour format)
- **Minute**: 0-59
- Default: 6:00 AM

## Technical Details

### Date Calculation Logic
1. Convert UTC commit timestamp to your configured timezone
2. Check if the time is before your cutoff time
3. If before cutoff: assign to previous day
4. If at or after cutoff: assign to current day

### Storage
- Configuration is saved to `data/timezone-config.json`
- Changes take effect immediately
- Existing commit data is automatically recalculated

## Use Cases

### For Night Owls
- Set cutoff to 2:00 AM to count late-night work as the same day
- Useful if you work late but want commits to count for the current day

### For Early Birds  
- Set cutoff to 4:00 AM to count early morning work as the previous day
- Useful if you start early and want commits to count for the previous day

### For International Teams
- Configure timezone to match your local working hours
- Ensure commit dates align with your actual work schedule

## Benefits

1. **Accurate Work Tracking**: Commits are assigned to the correct work day
2. **Flexible Scheduling**: Adapt to your personal work rhythm
3. **Team Coordination**: Align with your team's timezone and schedule
4. **Better Analytics**: More accurate project activity timelines

## Troubleshooting

### Commits Showing Wrong Date
- Check your timezone configuration
- Verify the cutoff time is set correctly
- Ensure your system clock is accurate

### Configuration Not Saving
- Check browser console for errors
- Verify the server is running
- Check file permissions for the data directory

### Timezone Display Issues
- Refresh the page after changing settings
- Clear browser cache if needed
- Check that your timezone is supported
