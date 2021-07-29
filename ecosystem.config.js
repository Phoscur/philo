module.exports = {
  apps: [
    {
      name: 'philo',
      script: 'dist/index.js',
      node_args: '-r dotenv/config',
      watch: true,
      // Delay between restart
      watch_delay: 1000,
      ignore_watch: ['node_modules', 'src'],
      watch_options: {
        followSymlinks: false,
      },
    },
  ],
}
