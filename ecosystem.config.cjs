// PM2 ecosystem configuration (CommonJS format)
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
        NODE_ENV: "production"
      },
      env_production: {
        NODE_ENV: "production"
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
  ]
};