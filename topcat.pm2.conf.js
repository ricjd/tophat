module.exports = {
  apps : [
    {
      name      : 'Topcat',
      script    : 'index.js',
      env: {
      },
      env_production : {
        NODE_ENV: 'production'
      },
      watch: true,
      ignore_watch : ['combined.log'],
      watch_options: {
        followSymlinks: false
      }
    }
  ]
};