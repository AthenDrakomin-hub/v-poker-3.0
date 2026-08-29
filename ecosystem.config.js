module.exports = {
  apps: [
    {
      name: "v-poker-api",
      cwd: "/opt/texas-platform/api-server",
      script: "dist/index.js",
      interpreter: "node",
      // 内存管理
      max_memory_restart: "200M",
      // 日志配置
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      error_file: "/var/log/v-poker/api-error.log",
      out_file: "/var/log/v-poker/api-out.log",
      merge_logs: true,
      // 自动重启配置
      autorestart: true,
      watch: false,
      max_restarts: 10,
      min_uptime: "10s",
      // 环境变量
      env: {
        NODE_ENV: "production",
        INSTANCE_NAME: "v-poker-api-1"
      }
    }
  ]
};
