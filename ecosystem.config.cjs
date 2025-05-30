// https://pm2.keymetrics.io/docs/usage/application-declaration/
module.exports = {
  apps: [
    {
      name: 'philopho',
      script: 'dist/main.js',
      node_args: '--env-file=.env',
      watch: true,
      time: true,
      // Delay between restart
      watch_delay: 1000,
      ignore_watch: [
        'node_modules',
        'src',
        'stora*',
        'sun*',
        'time*',
        'photo*',
        'ecosystem.config.cjs',
        'README.md',
      ],
      watch_options: {
        followSymlinks: false,
      },
    },
  ],
  env: {
    PM2_HOME: '~/philo',
  },
};
