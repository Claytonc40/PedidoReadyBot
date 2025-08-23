// Configurações para o cron job
const cronConfig = {
  // Padrão: a cada 5 minutos
  default: '*/5 * * * *',
  
  // Opções de agendamento comuns
  patterns: {
    everyMinute: '* * * * *',
    every5Minutes: '*/5 * * * *',
    every10Minutes: '*/10 * * * *',
    every15Minutes: '*/15 * * * *',
    every30Minutes: '*/30 * * * *',
    everyHour: '0 * * * *',
    every2Hours: '0 */2 * * *',
    every6Hours: '0 */6 * * *',
    daily: '0 0 * * *',
    weekly: '0 0 * * 0',
    monthly: '0 0 1 * *'
  },
  
  // Configuração padrão para produção
  production: {
    pattern: '*/5 * * * *', // A cada 5 minutos
    timezone: 'America/Sao_Paulo',
    enabled: true
  },
  
  // Configuração para desenvolvimento
  development: {
    pattern: '*/2 * * * *', // A cada 2 minutos (mais frequente para testes)
    timezone: 'America/Sao_Paulo',
    enabled: true
  },
  
  // Configuração para horário comercial (8h às 18h, segunda a sexta)
  businessHours: {
    pattern: '*/5 8-18 * * 1-5', // A cada 5 minutos, 8h-18h, seg-sex
    timezone: 'America/Sao_Paulo',
    enabled: false
  }
};

// Função para obter configuração baseada no ambiente
function getCronConfig(environment = 'development') {
  switch (environment) {
    case 'production':
      return cronConfig.production;
    case 'business':
      return cronConfig.businessHours;
    default:
      return cronConfig.development;
  }
}

// Função para validar padrão cron
function validateCronPattern(pattern) {
  try {
    // node-cron valida automaticamente o padrão
    require('node-cron').validate(pattern);
    return true;
  } catch (error) {
    console.error('Padrão cron inválido:', pattern);
    return false;
  }
}

module.exports = {
  cronConfig,
  getCronConfig,
  validateCronPattern
};
