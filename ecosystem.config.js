module.exports = {
  apps: [
    {
      name: "tornado-monitor",
      script: "dist/index.js",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      restart_delay: 5000,
      max_restarts: 10,
      min_uptime: "10s",
      env: {
        NODE_ENV: "production",
        // Default environment variables (can be overridden)
        MONITOR_INTERVAL: "30",
        MONITOR_TIMEOUT: "10", 
        MAX_QUEUE: "3",
        MAX_FAILURES: "3"
      },
      env_production: {
        NODE_ENV: "production",
        // Production-specific overrides
        MONITOR_INTERVAL: "30",
        MONITOR_TIMEOUT: "15",
        MAX_QUEUE: "5",
        MAX_FAILURES: "3"
      },
      // Logging configuration
      log_file: "./logs/tornado-monitor.log",
      out_file: "./logs/tornado-monitor-out.log", 
      error_file: "./logs/tornado-monitor-error.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
      // Log rotation
      log_type: "json",
      // Health monitoring
      health_check_grace_period: 30000,
      // Advanced PM2 options
      kill_timeout: 5000,
      listen_timeout: 10000,
      // Cron restart (optional - restart daily at 3 AM)
      cron_restart: "0 3 * * *",
      // Source map support for better stack traces
      source_map_support: true,
      // Graceful shutdown
      shutdown_with_message: true
    }
  ],

  // Deployment configuration
  deploy: {
    production: {
      user: "deploy",
      host: ["your-server.com"],
      ref: "origin/main",
      repo: "git@github.com:yourusername/tornado-monitor.git",
      path: "/var/www/tornado-monitor",
      "pre-deploy-local": "",
      "post-deploy": "npm install && npm run build && pm2 reload ecosystem.config.js --env production",
      "pre-setup": "",
      env: {
        NODE_ENV: "production"
      }
    }
  }
};