module.exports = {
  apps: [
    {
      name: 'github-activity-logger',
      script: 'server.js',
      cwd: '/Users/patrick/Documents/Projects/Dev/github-notion-logger',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'development',
        PORT: 3040,
        HOST: '127.0.0.1',
        NOTION_SYNC: 'false'
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3040,
        HOST: '127.0.0.1',
        NOTION_SYNC: 'false'
      },
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      restart_delay: 4000,
      max_restarts: 10,
      min_uptime: '10s',
      log_file: './logs/github-activity-logger-combined.log',
      out_file: './logs/github-activity-logger-out.log',
      error_file: './logs/github-activity-logger-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      kill_timeout: 5000,
      listen_timeout: 3000
    },
    {
      name: 'gnl-assistant',
      script: 'gnl-assistant.js',
      cwd: '/Users/patrick/Documents/Projects/Dev/github-notion-logger',
      instances: 1,
      exec_mode: 'fork',
      port: 4250,
      env: {
        NODE_ENV: 'development',
        GNL_ASSISTANT_PORT: 4250,
        FLY_IO_BASE_URL: 'https://notion-logger.fly.dev',
        LLAMA_HUB_URL: 'http://localhost:9000'
      },
      env_production: {
        NODE_ENV: 'production',
        GNL_ASSISTANT_PORT: 4250,
        FLY_IO_BASE_URL: 'https://notion-logger.fly.dev',
        LLAMA_HUB_URL: 'http://localhost:9000'
      },
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      restart_delay: 4000,
      max_restarts: 10,
      min_uptime: '10s',
      log_file: './logs/gnl-assistant-combined.log',
      out_file: './logs/gnl-assistant-out.log',
      error_file: './logs/gnl-assistant-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      health_check_grace_period: 3000,
      health_check_fatal_exceptions: true,
      kill_timeout: 5000,
      listen_timeout: 3000,
      shutdown_with_message: true
    }
  ]
};
