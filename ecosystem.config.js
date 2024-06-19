module.exports = {
  apps: [
    {
      name: 'philopho',
      script: 'dist/index.js',
      node_args: '--env-file=.env',
      watch: true,
      // Delay between restart
      watch_delay: 1000,
      ignore_watch: ['node_modules', 'src', 'sun*', 'ecosystem.config.js', 'README.md'],
      watch_options: {
        followSymlinks: false,
      },
    },
  ],
  env: {
    PM2_HOME: '~/philo',
  },
}
