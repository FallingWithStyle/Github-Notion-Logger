const fs = require('fs');
const path = require('path');

// Default timezone configuration
const DEFAULT_CONFIG = {
  timezone: 'America/New_York', // Eastern Time
  cutoffHour: 6, // 6 AM
  cutoffMinute: 0,
  autoSave: true
};

const CONFIG_FILE = path.join(process.env.DATA_DIR || 'data', 'timezone-config.json');

class TimezoneConfig {
  constructor() {
    this.config = this.loadConfig();
  }

  loadConfig() {
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        const data = fs.readFileSync(CONFIG_FILE, 'utf8');
        return { ...DEFAULT_CONFIG, ...JSON.parse(data) };
      }
    } catch (error) {
      console.warn('⚠️ Could not load timezone config, using defaults:', error.message);
    }
    return { ...DEFAULT_CONFIG };
  }

  saveConfig() {
    try {
      const configDir = path.dirname(CONFIG_FILE);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(this.config, null, 2));
      return true;
    } catch (error) {
      console.error('❌ Could not save timezone config:', error.message);
      return false;
    }
  }

  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    return this.saveConfig();
  }

  getConfig() {
    return { ...this.config };
  }

  // Convert a UTC timestamp to the user's timezone and apply cutoff logic
  getEffectiveDate(utcTimestamp) {
    const date = new Date(utcTimestamp);
    
    // Get the time in the user's timezone using Intl.DateTimeFormat
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: this.config.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    
    const parts = formatter.formatToParts(date);
    const timeValues = {};
    parts.forEach(part => {
      if (part.type !== 'literal') {
        timeValues[part.type] = parseInt(part.value);
      }
    });
    
    // Fix hour 24 issue (some engines return 24 for midnight)
    if (timeValues.hour === 24) {
      timeValues.hour = 0;
    }
    
    // Check if the time is before the cutoff
    if (timeValues.hour < this.config.cutoffHour || 
        (timeValues.hour === this.config.cutoffHour && timeValues.minute < this.config.cutoffMinute)) {
      // Before cutoff - count as previous day
      // Create a date object for the current time and subtract one day
      const currentDate = new Date(timeValues.year, timeValues.month - 1, timeValues.day);
      currentDate.setDate(currentDate.getDate() - 1);
      
      const year = currentDate.getFullYear();
      const month = String(currentDate.getMonth() + 1).padStart(2, '0');
      const day = String(currentDate.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } else {
      // After cutoff - count as current day
      const year = timeValues.year;
      const month = String(timeValues.month).padStart(2, '0');
      const day = String(timeValues.day).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  }

  // Get timezone offset information for display
  getTimezoneInfo() {
    const now = new Date();
    const utc = new Date(now.getTime() + (now.getTimezoneOffset() * 60000));
    const userTime = new Date(utc.toLocaleString('en-US', { timeZone: this.config.timezone }));
    const offset = (userTime.getTime() - utc.getTime()) / (1000 * 60 * 60);
    
    return {
      timezone: this.config.timezone,
      offset: offset,
      offsetString: `UTC${offset >= 0 ? '+' : ''}${offset}`,
      currentTime: userTime.toLocaleTimeString('en-US', { 
        timeZone: this.config.timezone,
        hour12: false 
      }),
      cutoffTime: `${String(this.config.cutoffHour).padStart(2, '0')}:${String(this.config.cutoffMinute).padStart(2, '0')}`
    };
  }

  // Get available timezones (common ones)
  getAvailableTimezones() {
    return [
      { value: 'America/New_York', label: 'Eastern Time (ET)' },
      { value: 'America/Chicago', label: 'Central Time (CT)' },
      { value: 'America/Denver', label: 'Mountain Time (MT)' },
      { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
      { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
      { value: 'Pacific/Honolulu', label: 'Hawaii Time (HST)' },
      { value: 'Europe/London', label: 'Greenwich Mean Time (GMT)' },
      { value: 'Europe/Paris', label: 'Central European Time (CET)' },
      { value: 'Europe/Berlin', label: 'Central European Time (CET)' },
      { value: 'Asia/Tokyo', label: 'Japan Standard Time (JST)' },
      { value: 'Asia/Shanghai', label: 'China Standard Time (CST)' },
      { value: 'Australia/Sydney', label: 'Australian Eastern Time (AET)' }
    ];
  }
}

// Create singleton instance
const timezoneConfig = new TimezoneConfig();

module.exports = timezoneConfig;
