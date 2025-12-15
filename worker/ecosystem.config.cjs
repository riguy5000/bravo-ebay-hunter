module.exports = {
  apps: [{
    name: 'ebay-hunter-worker',
    script: 'index.js',
    interpreter: 'node',
    interpreter_args: '--experimental-specifier-resolution=node',
    watch: false,
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    max_memory_restart: '500M',
    node_args: '--experimental-modules',
    env: {
      NODE_ENV: 'production'
    },
    // Logging
    error_file: './logs/error.log',
    out_file: './logs/output.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    merge_logs: true
  }]
};
