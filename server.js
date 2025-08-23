// Carregar variáveis de ambiente
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'config.env') });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cron = require('node-cron');
const axios = require('axios');
const { processOrders, initializeCheckpoint, getCurrentCheckpoint } = require('./services/orderService');
const databaseService = require('./services/databaseService');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware de segurança
app.use(helmet({
  contentSecurityPolicy: false // Desabilitar CSP para desenvolvimento
}));
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir arquivos estáticos
app.use(express.static('public'));

// Rotas básicas
app.get('/', (req, res) => {
  res.json({
    message: 'PedidoReadyBot API',
    status: 'running',
        endpoints: {
      health: '/health',
      process: '/process-orders',
      status: '/status',
      checkpoint: '/checkpoint',
      dashboard: '/dashboard',
      admin: '/admin',
      testToken: '/test-token-request',
      testTokenPage: '/test-token',
      api: {
        database: '/api/database/stats',
        cancelledOrders: '/api/cancelled-orders',
        restaurants: '/api/restaurants',
        areas: '/api/areas',
        settings: '/api/settings'
      }
    }
  });
});

// Rota para o dashboard
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Rota para o painel de administração
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Rota para teste de token
app.get('/test-token', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'test-token.html'));
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.get('/status', (req, res) => {
  res.json({
    status: 'running',
    lastProcessed: global.lastProcessed || 'Nunca processado',
    totalProcessed: global.totalProcessed || 0,
    totalStores: global.totalStores || 0,
    successfulStores: global.successfulStores || 0,
    failedStores: global.failedStores || 0,
    uptime: process.uptime()
  });
});

app.get('/checkpoint', (req, res) => {
  res.json({
    currentCheckpoint: getCurrentCheckpoint(),
    lastProcessed: global.lastProcessed || 'Nunca processado',
    totalStores: global.totalStores || 0,
    successfulStores: global.successfulStores || 0,
    failedStores: global.failedStores || 0,
    uptime: process.uptime()
  });
});

// Endpoint para dados do dashboard
app.get('/dashboard-data', (req, res) => {
  res.json({
    status: 'running',
    lastProcessed: global.lastProcessed || 'Nunca processado',
    totalProcessed: global.totalProcessed || 0,
    totalStores: global.totalStores || 0,
    successfulStores: global.successfulStores || 0,
    failedStores: global.failedStores || 0,
    currentCheckpoint: getCurrentCheckpoint(),
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    // Adicionar dados detalhados dos restaurantes
    storeResults: global.storeResults || [],
    // Adicionar contadores de erro
    errorCount: global.errorCount || 0,
    // Adicionar tempo de duração do último processamento
    duration: global.lastDuration || 0,
    // Adicionar hora de início e fim do último processamento
    startTime: global.lastStartTime || null,
    endTime: global.lastEndTime || null
  });
});

// ===== API PARA GERENCIAMENTO DO BANCO DE DADOS =====

// Obter estatísticas do banco de dados
app.get('/api/database/stats', (req, res) => {
  try {
    const stats = databaseService.getDatabaseStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Obter pedidos cancelados
app.get('/api/cancelled-orders', (req, res) => {
  try {
    const { store, limit = 100 } = req.query;
    let orders;
    
    if (store) {
      orders = databaseService.getCancelledOrdersByStore(store, parseInt(limit));
    } else {
      orders = databaseService.getCancelledOrders(parseInt(limit));
    }
    
    res.json({ success: true, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===== RESTAURANTES =====

// Listar todos os restaurantes
app.get('/api/restaurants', (req, res) => {
  try {
    const restaurants = databaseService.getAllRestaurants();
    res.json({ success: true, data: restaurants });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Obter restaurante por ID
app.get('/api/restaurants/:id', (req, res) => {
  try {
    const restaurant = databaseService.getRestaurantByCode(req.params.id);
    if (restaurant) {
      res.json({ success: true, data: restaurant });
    } else {
      res.status(404).json({ success: false, error: 'Restaurante não encontrado' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Adicionar novo restaurante
app.post('/api/restaurants', (req, res) => {
  try {
    const { code, name, description } = req.body;
    if (!code || !name) {
      return res.status(400).json({ success: false, error: 'Código e nome são obrigatórios' });
    }
    
    const result = databaseService.addRestaurant(code, name, description);
    if (result.success) {
      res.json({ success: true, message: 'Restaurante adicionado com sucesso', id: result.id });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Atualizar restaurante
app.put('/api/restaurants/:id', (req, res) => {
  try {
    const { code, name, description, active } = req.body;
    const id = parseInt(req.params.id);
    
    if (!code || !name) {
      return res.status(400).json({ success: false, error: 'Código e nome são obrigatórios' });
    }
    
    const result = databaseService.updateRestaurant(id, code, name, description, active);
    if (result.success) {
      res.json({ success: true, message: 'Restaurante atualizado com sucesso' });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Deletar restaurante
app.delete('/api/restaurants/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const result = databaseService.deleteRestaurant(id);
    if (result.success) {
      res.json({ success: true, message: 'Restaurante deletado com sucesso' });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===== ÁREAS DE PROCESSAMENTO =====

// Listar todas as áreas
app.get('/api/areas', (req, res) => {
  try {
    const areas = databaseService.getAllAreas();
    res.json({ success: true, data: areas });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Obter área por ID
app.get('/api/areas/:id', (req, res) => {
  try {
    const area = databaseService.getAreaByCode(req.params.id);
    if (area) {
      res.json({ success: true, data: area });
    } else {
      res.status(404).json({ success: false, error: 'Área não encontrada' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Adicionar nova área
app.post('/api/areas', (req, res) => {
  try {
    const { code, name, description } = req.body;
    if (!code || !name) {
      return res.status(400).json({ success: false, error: 'Código e nome são obrigatórios' });
    }
    
    const result = databaseService.addArea(code, name, description);
    if (result.success) {
      res.json({ success: true, message: 'Área adicionada com sucesso', id: result.id });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Atualizar área
app.put('/api/areas/:id', (req, res) => {
  try {
    const { code, name, description, active } = req.body;
    const id = parseInt(req.params.id);
    
    if (!code || !name) {
      return res.status(400).json({ success: false, error: 'Código e nome são obrigatórios' });
    }
    
    const result = databaseService.updateArea(id, code, name, description, active);
    if (result.success) {
      res.json({ success: true, message: 'Área atualizada com sucesso' });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Deletar área
app.delete('/api/areas/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const result = databaseService.deleteArea(id);
    if (result.success) {
      res.json({ success: true, message: 'Área deletada com sucesso' });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===== CONFIGURAÇÕES =====

// Listar todas as configurações
app.get('/api/settings', (req, res) => {
  try {
    const settings = databaseService.getAllSettings();
    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Atualizar configuração
app.put('/api/settings/:key', (req, res) => {
  try {
    const { value, description } = req.body;
    const key = req.params.key;
    
    if (!value) {
      return res.status(400).json({ success: false, error: 'Valor é obrigatório' });
    }
    
    const result = databaseService.updateSetting(key, value, description);
    if (result.success) {
      res.json({ success: true, message: 'Configuração atualizada com sucesso' });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Rota para processar pedidos manualmente
app.post('/process-orders', async (req, res) => {
  try {
    const result = await processOrders();
    res.json({
      success: true,
      message: 'Pedidos processados com sucesso',
      result
    });
  } catch (error) {
    console.error('Erro ao processar pedidos:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao processar pedidos',
      error: error.message
    });
  }
});

// Endpoint para testar requisição de token
app.post('/test-token-request', async (req, res) => {
  try {
    console.log('🔐 Testando requisição de token...');
    
    const url = 'https://adsa-br-ui.fkdlv.com/ui/token';
    const headers = {
      'sec-ch-ua-platform': '"Windows"',
      'Referer': '',
      'sec-ch-ua': '"Not;A=Brand";v="99", "Google Chrome";v="139", "Chromium";v="139"',
      'sec-ch-ua-mobile': '?0',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
      'accept': 'application/json',
      'DNT': '1',
      'content-type': 'application/x-www-form-urlencoded'
    };
    
    const data = new URLSearchParams({
      brand: 'ADSA',
      apikey: '5dGp7PG47wCVRspbUiw2q6mSHEWONidv',
      username: 'LBR.ADSA',
      passwd: '216d1b02a63f567bfb717df1263b8556a4eac1f7'
    });
    
    console.log('📋 Parâmetros da requisição:');
    console.log('   - URL:', url);
    console.log('   - Headers:', JSON.stringify(headers, null, 2));
    console.log('   - Data:', data.toString());
    
    const response = await axios.post(url, data, { headers });
    
    console.log('✅ Resposta recebida:');
    console.log('   - Status:', response.status);
    console.log('   - Headers:', JSON.stringify(response.headers, null, 2));
    console.log('   - Data:', JSON.stringify(response.data, null, 2));
    
    res.json({
      success: true,
      message: 'Requisição de token testada com sucesso',
      response: {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        data: response.data
      }
    });
    
  } catch (error) {
    console.error('❌ Erro ao testar requisição de token:', error.message);
    
    if (error.response) {
      console.error('   - Status:', error.response.status);
      console.error('   - Headers:', JSON.stringify(error.response.headers, null, 2));
      console.error('   - Data:', JSON.stringify(error.response.data, null, 2));
      
      res.status(error.response.status).json({
        success: false,
        message: 'Erro na requisição de token',
        error: {
          status: error.response.status,
          statusText: error.response.statusText,
          message: error.message,
          data: error.response.data
        }
      });
    } else if (error.request) {
      console.error('   - Request feito mas sem resposta');
      
      res.status(500).json({
        success: false,
        message: 'Erro na requisição de token - Sem resposta do servidor',
        error: {
          message: error.message,
          code: error.code
        }
      });
    } else {
      console.error('   - Erro na configuração da requisição');
      
      res.status(500).json({
        success: false,
        message: 'Erro na configuração da requisição de token',
        error: {
          message: error.message
        }
      });
    }
  }
});

// Configuração do cron job usando configurações do banco de dados
const cronPattern = databaseService.getSetting('CRON_PATTERN') || '*/5 * * * *';
const cronTimezone = databaseService.getSetting('CRON_TIMEZONE') || 'America/Sao_Paulo';

cron.schedule(cronPattern, async () => {
  console.log('📅 Executando cron job para processar pedidos...');
  try {
    const result = await processOrders();
    if (!result.success) {
      console.log('⚠️ Cron job executado com avisos:', result.message);
    } else {
      console.log('✅ Cron job executado com sucesso');
    }
  } catch (error) {
    console.error('❌ Erro crítico no cron job:', error.message);
  }
}, {
  timezone: cronTimezone
});

// Inicialização do servidor
async function startServer() {
  try {
    // Aguardar inicialização do banco de dados
    await databaseService.init();
    
    app.listen(PORT, () => {
      console.log(`🚀 Servidor rodando na porta ${PORT}`);
      console.log(`📅 Cron job configurado para executar com padrão: ${databaseService.getSetting('CRON_PATTERN') || '*/5 * * * *'}`);
      console.log(`🌍 Timezone do cron: ${databaseService.getSetting('CRON_TIMEZONE') || 'America/Sao_Paulo'}`);
      console.log(`🌐 Acesse: http://localhost:${PORT}`);
      
      // Inicializar sistema de checkpoint
      initializeCheckpoint();
      console.log('✅ Sistema de checkpoint inicializado');
      
      // Mostrar estatísticas do banco de dados
      const stats = databaseService.getDatabaseStats();
      console.log(`📊 Banco de dados: ${stats.activeRestaurants} restaurantes ativos, ${stats.activeAreas} áreas ativas`);
    });
  } catch (error) {
    console.error('❌ Erro ao inicializar servidor:', error.message);
    process.exit(1);
  }
}

startServer();

// Tratamento de erros não capturados
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});
