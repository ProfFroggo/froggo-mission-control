// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// ecosystem.config.js
// pm2 process manager configuration for Mission Control platform.
// Usage:
//   npm install -g pm2
//   pm2 start ecosystem.config.js
//   pm2 save
//   pm2 startup   # generates auto-start command

module.exports = {
  apps: [
    {
      name: 'mission-control-dashboard',
      script: 'npm',
      args: 'run dev',
      cwd: process.env.PROJECT_DIR || `${process.env.HOME}/git/mission-control-nextjs`,
      env: {
        NODE_ENV: 'development',
      },
    },
    {
      name: 'mission-control-cron-daemon',
      script: 'tools/cron-daemon.js',
      cwd: process.env.PROJECT_DIR || `${process.env.HOME}/git/mission-control-nextjs`,
    },
    {
      name: 'mission-control-session-monitor',
      script: 'tools/session-monitor.js',
      cwd: process.env.PROJECT_DIR || `${process.env.HOME}/git/mission-control-nextjs`,
    },
  ],
};
