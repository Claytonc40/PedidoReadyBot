module.exports = {
  apps: [
    {
      name: 'PedidoReadyBot',
      script: 'server.js',
      cwd: './',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      ignore_watch: [
        'node_modules',
        'data',
        'logs',
        '*.log',
        'ecosystem.config.js',
        'package.json',
        'package-lock.json',
        'README.md',
        'DASHBOARD.md',
        'DATABASE.md',
        'stores-examples.env',
        'cron-examples.env'
      ],
      env: {
        NODE_ENV: 'production',
        PORT: 80
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 80
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 80
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      max_memory_restart: '500M',
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000,
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 8000,
      autorestart: true,
      cron_restart: '0 2 * * *', // Reiniciar todos os dias às 2h da manhã
      exp_backoff_restart_delay: 100,
      // Configurações específicas para o PedidoReadyBot
      node_args: '--max-old-space-size=512',
      // Variáveis de ambiente específicas
      env_file: './config.env'
    }
  ],

  // Configurações de deploy (opcional)
  deploy: {
    production: {
      user: 'node',
      host: 'localhost',
      ref: 'origin/main',
      repo: 'git@github.com:seu-usuario/pedidoreadybot.git',
      path: '/var/www/pedidoreadybot',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    }
  }
};
