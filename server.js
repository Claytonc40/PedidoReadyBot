// Carregar variáveis de ambiente
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'config.env') });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cron = require('node-cron');
const axios = require('axios');
const multer = require('multer');
const XLSX = require('xlsx');
const { 
  processOrders, 
  initializeCheckpoint, 
  getCurrentCheckpoint,
  startMonitoring,
  stopMonitoring,
  getMonitoringStatus,
  getPendingOrders,
  clearPendingOrders,
  addOrderToQueue,
  getQueueConfig,
  updateQueueConfig
} = require('./services/orderService');
const databaseService = require('./services/databaseService');
const authService = require('./services/authService');
const { authenticateToken, requireAdmin } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuração do multer para upload de arquivos
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
        file.mimetype === 'application/vnd.ms-excel') {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos Excel são permitidos'));
    }
  }
});

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

// Rota para a página de login
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Rotas de autenticação
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Usuário e senha são obrigatórios'
      });
    }
    
    const result = await authService.login(username, password);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(401).json(result);
    }
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

app.post('/api/auth/change-password', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Senha atual e nova senha são obrigatórias'
      });
    }
    
    const result = await authService.changePassword(currentPassword, newPassword);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Erro ao alterar senha:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

app.get('/api/auth/verify', authenticateToken, (req, res) => {
  res.json({
    success: true,
    user: req.user
  });
});

// Rota raiz - redirecionar para login (mantida para compatibilidade)
app.get('/root', (req, res) => {
  res.redirect('/login');
});

// Rota de informações da API (protegida)
app.get('/api/info', authenticateToken, (req, res) => {
  res.json({
    message: 'PedidoReadyBot API',
    status: 'running',
    user: req.user,
        endpoints: {
      health: '/health',
      process: '/process-orders',
      status: '/status',
      checkpoint: '/checkpoint',
      dashboard: '/',
      admin: '/admin',
      testToken: '/test-token-request',
      testTokenPage: '/test-token',
      api: {
        database: '/api/database/stats',
        cancelledOrders: '/api/cancelled-orders',
        restaurants: '/api/restaurants',
        areas: '/api/areas',
        settings: '/api/settings',
        orders: {
          processFullReady: '/api/orders/process-full-ready'
        },
        monitoring: {
          start: '/api/monitoring/start',
          stop: '/api/monitoring/stop',
          status: '/api/monitoring/status',
          pendingOrders: '/api/monitoring/pending-orders',
          clearQueue: '/api/monitoring/clear-queue',
          addOrder: '/api/monitoring/add-order',
          processQueue: '/api/monitoring/process-queue',
          queueConfig: '/api/monitoring/queue-config'
        }
      }
    }
  });
});

// Rota para o dashboard (HTML servido sem autenticação, autenticação feita no frontend)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Rota para o painel de administração (HTML servido sem autenticação, autenticação feita no frontend)
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Rota para o dashboard (alias)
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
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

// Endpoint para resetar estatísticas dos restaurantes
app.post('/reset-store-stats', (req, res) => {
  try {
    // Resetar estatísticas acumuladas
    global.storeResults = global.storeResults?.map(store => ({
      ...store,
      processedSuccesses: 0,
      processedErrors: 0,
      totalProcessed: 0,
      validOrders: 0,
      skippedOrders: 0,
      cancelledOrders: 0
    })) || [];
    
    // Resetar contadores globais
    global.totalProcessed = 0;
    global.errorCount = 0;
    
    res.json({ 
      success: true, 
      message: 'Estatísticas dos restaurantes resetadas com sucesso' 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Endpoint para dados do dashboard
app.get('/dashboard-data', authenticateToken, (req, res) => {
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
app.get('/api/database/stats', authenticateToken, (req, res) => {
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
app.get('/api/restaurants', authenticateToken, (req, res) => {
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

// Importar restaurantes de planilha Excel
app.post('/api/restaurants/import', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Nenhum arquivo enviado' });
    }

    const { skipExisting, updateExisting } = req.body;
    const skipExistingFlag = skipExisting === 'true';
    const updateExistingFlag = updateExisting === 'true';

    // Ler arquivo Excel
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Converter para JSON
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    if (data.length < 2) {
      return res.status(400).json({ success: false, error: 'Planilha deve ter pelo menos cabeçalho e uma linha de dados' });
    }

    // Validar cabeçalhos
    const headers = data[0];
    const expectedHeaders = ['Código', 'Nome', 'Descrição', 'Ativo'];
    
    for (let i = 0; i < expectedHeaders.length; i++) {
      if (headers[i] !== expectedHeaders[i]) {
        return res.status(400).json({ 
          success: false, 
          error: `Cabeçalho inválido na coluna ${i + 1}. Esperado: "${expectedHeaders[i]}", encontrado: "${headers[i]}"` 
        });
      }
    }

    // Processar dados
    const results = {
      total: 0,
      imported: 0,
      updated: 0,
      skipped: 0,
      errors: []
    };

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row.length < 4) continue; // Pular linhas vazias
      
      const code = String(row[0]).trim();
      const name = String(row[1]).trim();
      const description = String(row[2] || '').trim();
      const active = String(row[3] || 'Sim').toLowerCase() === 'sim';
      
      if (!code || !name) {
        results.errors.push(`Linha ${i + 1}: Código e nome são obrigatórios`);
        continue;
      }

      if (code.length > 10) {
        results.errors.push(`Linha ${i + 1}: Código deve ter no máximo 10 caracteres`);
        continue;
      }

      results.total++;

      try {
        // Verificar se restaurante já existe
        const existingRestaurant = databaseService.getRestaurantByCode(code);
        
        if (existingRestaurant) {
          if (skipExistingFlag) {
            results.skipped++;
            continue;
          }
          
          if (updateExistingFlag) {
            // Atualizar restaurante existente
            const updateResult = databaseService.updateRestaurant(
              existingRestaurant.id, 
              code, 
              name, 
              description, 
              active
            );
            
            if (updateResult.success) {
              results.updated++;
            } else {
              results.errors.push(`Linha ${i + 1}: ${updateResult.error}`);
            }
          } else {
            results.skipped++;
          }
        } else {
          // Adicionar novo restaurante
          const addResult = databaseService.addRestaurant(code, name, description);
          if (addResult.success) {
            results.imported++;
          } else {
            results.errors.push(`Linha ${i + 1}: ${addResult.error}`);
          }
        }
      } catch (error) {
        results.errors.push(`Linha ${i + 1}: ${error.message}`);
      }
    }

    res.json({
      success: true,
      message: 'Importação concluída',
      results: results
    });

  } catch (error) {
    console.error('Erro na importação:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro ao processar arquivo Excel: ' + error.message 
    });
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
app.get('/api/settings', authenticateToken, (req, res) => {
  try {
    const settings = databaseService.getAllSettings();
    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Atualizar configuração
app.put('/api/settings/:key', authenticateToken, requireAdmin, (req, res) => {
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

// ===== ENDPOINTS DE MONITORAMENTO CONTÍNUO =====

// Iniciar monitoramento contínuo
app.post('/api/monitoring/start', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await startMonitoring();
    if (result) {
      res.json({ 
        success: true, 
        message: 'Monitoramento iniciado com sucesso',
        status: await getMonitoringStatus()
      });
    } else {
      res.status(400).json({ 
        success: false, 
        error: 'Monitoramento já está ativo' 
      });
    }
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Parar monitoramento contínuo
app.post('/api/monitoring/stop', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = stopMonitoring();
    if (result) {
      res.json({ 
        success: true, 
        message: 'Monitoramento parado com sucesso',
        status: await getMonitoringStatus()
      });
    } else {
      res.status(400).json({ 
        success: false, 
        error: 'Monitoramento não está ativo' 
      });
    }
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Obter status do monitoramento
app.get('/api/monitoring/status', async (req, res) => {
  try {
    const status = await getMonitoringStatus();
    res.json({ success: true, data: status });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Obter fila de pedidos pendentes
app.get('/api/monitoring/pending-orders', (req, res) => {
  try {
    const orders = getPendingOrders();
    res.json({ success: true, data: orders });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Limpar fila de pedidos pendentes
app.post('/api/monitoring/clear-queue', async (req, res) => {
  try {
    const count = clearPendingOrders();
    res.json({ 
      success: true, 
      message: `Fila limpa com sucesso. ${count} pedidos removidos.`,
      status: await getMonitoringStatus()
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Adicionar pedido manualmente à fila
app.post('/api/monitoring/add-order', async (req, res) => {
  try {
    const { id, store, currentState } = req.body;
    
    if (!id) {
      return res.status(400).json({ 
        success: false, 
        error: 'ID do pedido é obrigatório' 
      });
    }
    
    const order = {
      id,
      store: store || 'Desconhecido',
      currentState: currentState || 'READY'
    };
    
    const result = addOrderToQueue(order);
    if (result) {
      res.json({ 
        success: true, 
        message: 'Pedido adicionado à fila com sucesso',
        status: await getMonitoringStatus()
      });
    } else {
      res.status(400).json({ 
        success: false, 
        error: 'Pedido já está na fila' 
      });
    }
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Processar fila manualmente
app.post('/api/monitoring/process-queue', async (req, res) => {
  try {
    const { startMonitoring, processPendingOrdersQueue } = require('./services/orderService');
    
    // Se o monitoramento não estiver ativo, iniciar
    const monitoringStatus = await getMonitoringStatus();
    if (!monitoringStatus.isActive) {
      await startMonitoring();
    }
    
    // Processar fila
    await processPendingOrdersQueue();
    
    res.json({ 
      success: true, 
      message: 'Fila processada com sucesso',
      status: await getMonitoringStatus()
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Obter configurações da fila
app.get('/api/monitoring/queue-config', (req, res) => {
  try {
    const config = getQueueConfig();
    res.json({ success: true, data: config });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Atualizar configurações da fila
app.put('/api/monitoring/queue-config', (req, res) => {
  try {
    const { MAX_ORDERS, BATCH_SIZE, BATCH_DELAY, CRON_SYNC } = req.body;
    
    const newConfig = {};
    if (MAX_ORDERS !== undefined) newConfig.MAX_ORDERS = parseInt(MAX_ORDERS);
    if (BATCH_SIZE !== undefined) newConfig.BATCH_SIZE = parseInt(BATCH_SIZE);
    if (BATCH_DELAY !== undefined) newConfig.BATCH_DELAY = parseInt(BATCH_DELAY);
    if (CRON_SYNC !== undefined) newConfig.CRON_SYNC = Boolean(CRON_SYNC);
    
    const updatedConfig = updateQueueConfig(newConfig);
    
    res.json({ 
      success: true, 
      message: 'Configurações da fila atualizadas com sucesso',
      data: updatedConfig
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Reconfigurar cron job
app.post('/api/cron/reconfigure', (req, res) => {
  try {
    setupCronJob();
    res.json({ 
      success: true, 
      message: 'Cron job reconfigurado com sucesso',
      pattern: databaseService.getSetting('CRON_PATTERN') || '*/5 * * * *',
      timezone: databaseService.getSetting('CRON_TIMEZONE') || 'America/Sao_Paulo'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Configuração do cron job usando configurações do banco de dados
let cronJob = null;

function setupCronJob() {
  // Parar cron job existente se houver
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
  }
  
const cronPattern = databaseService.getSetting('CRON_PATTERN') || '*/5 * * * *';
const cronTimezone = databaseService.getSetting('CRON_TIMEZONE') || 'America/Sao_Paulo';

  console.log(`📅 Configurando cron job com padrão: ${cronPattern}`);
  console.log(`🌍 Timezone: ${cronTimezone}`);
  
  try {
    cronJob = cron.schedule(cronPattern, async () => {
  console.log('📅 Executando cron job para processar pedidos...');
  try {
    const result = await processOrders();
    if (!result.success) {
      console.log('⚠️ Cron job executado com avisos:', result.message);
    } else {
      console.log('✅ Cron job executado com sucesso');
          
          // Mostrar informações detalhadas sobre limpeza da fila
          if (result.queueCleanup && result.queueCleanup.removed > 0) {
            console.log(`🧹 ==========================================`);
            console.log(`🧹 FILA LIMPA AUTOMATICAMENTE`);
            console.log(`🧹 ==========================================`);
            console.log(`📊 Resumo da limpeza:`);
            console.log(`   - Método de processamento: ${result.processingMethod || 'sendFullReady'}`);
            console.log(`   - Pedidos processados: ${result.processed}`);
            console.log(`   - Pedidos removidos da fila: ${result.queueCleanup.removed}`);
            console.log(`   - Pedidos restantes na fila: ${result.queueCleanup.remaining}`);
            console.log(`   - Status da fila: ${result.queueStatus?.before || 'N/A'} → ${result.queueStatus?.after || 'N/A'}`);
            console.log(`   - Mensagem: ${result.queueCleanup.message}`);
            console.log(`🧹 ==========================================`);
          }
    }
  } catch (error) {
    console.error('❌ Erro crítico no cron job:', error.message);
  }
}, {
      timezone: cronTimezone,
      scheduled: true
    });
    
    console.log('✅ Cron job configurado e iniciado');
  } catch (error) {
    console.error('❌ Erro ao configurar cron job:', error.message);
    // Usar padrão de fallback
    cronJob = cron.schedule('*/5 * * * *', async () => {
      console.log('📅 Executando cron job de fallback...');
      try {
        const result = await processOrders();
        if (result.success && result.queueCleanup && result.queueCleanup.removed > 0) {
          console.log(`🧹 ==========================================`);
          console.log(`🧹 FILA LIMPA AUTOMATICAMENTE (FALLBACK)`);
          console.log(`🧹 ==========================================`);
          console.log(`📊 Resumo da limpeza:`);
          console.log(`   - Método de processamento: ${result.processingMethod || 'sendFullReady'}`);
          console.log(`   - Pedidos processados: ${result.processed}`);
          console.log(`   - Pedidos removidos da fila: ${result.queueCleanup.removed}`);
          console.log(`   - Pedidos restantes na fila: ${result.queueCleanup.remaining}`);
          console.log(`   - Status da fila: ${result.queueStatus?.before || 'N/A'} → ${result.queueStatus?.after || 'N/A'}`);
          console.log(`   - Mensagem: ${result.queueCleanup.message}`);
          console.log(`🧹 ==========================================`);
        }
      } catch (error) {
        console.error('❌ Erro no cron job de fallback:', error.message);
      }
    });
  }
}

// Endpoint para processar pedidos usando sendFullReady
app.post('/api/orders/process-full-ready', async (req, res) => {
  try {
    const { orderId, store } = req.body;
    
    if (!orderId || !store) {
      return res.status(400).json({
        success: false,
        error: 'orderId e store são obrigatórios'
      });
    }
    
    console.log(`🚀 Processando pedido ${orderId} da loja ${store} usando sendFullReady`);
    
    // Verificar se a loja existe
    const storeData = databaseService.getRestaurantByCode(store);
    if (!storeData) {
      return res.status(400).json({
        success: false,
        error: `Loja ${store} não encontrada no banco de dados`
      });
    }
    
    // Usar token global (JWT_TOKEN das configurações)
    const token = databaseService.getSetting('JWT_TOKEN');
    if (!token || token === 'aguardando_obtencao_automatica') {
      return res.status(400).json({
        success: false,
        error: 'Token JWT não configurado ou aguardando obtenção automática'
      });
    }
    
    // Importar e usar a função sendFullReady
    const { sendFullReady } = require('./services/orderService');
    
    // Processar pedido
    const result = await sendFullReady(token, orderId);
    
    if (result) {
      console.log(`✅ Pedido ${orderId} processado com sucesso`);
      
      // Remover pedido da fila
      const queueResult = await clearPendingOrders([orderId]);
      
      // Atualizar estatísticas globais
      if (global.storeResults) {
        const storeIndex = global.storeResults.findIndex(s => s.store === store);
        if (storeIndex !== -1) {
          global.storeResults[storeIndex].processedSuccesses = (global.storeResults[storeIndex].processedSuccesses || 0) + 1;
          global.storeResults[storeIndex].totalProcessed = (global.storeResults[storeIndex].totalProcessed || 0) + 1;
        } else {
          global.storeResults.push({
            store,
            processedSuccesses: 1,
            processedErrors: 0,
            totalProcessed: 1,
            success: true
          });
        }
      }
      
      global.totalProcessed = (global.totalProcessed || 0) + 1;
      
      return res.json({
        success: true,
        message: `Pedido ${orderId} processado com sucesso`,
        data: result,
        queueCleaned: queueResult.success
      });
    } else {
      throw new Error('Falha ao processar pedido');
    }
    
  } catch (error) {
    console.error(`❌ Erro ao processar pedido ${req.body?.orderId}:`, error.message);
    
    // Atualizar estatísticas de erro
    const { store } = req.body;
    if (store && global.storeResults) {
      const storeIndex = global.storeResults.findIndex(s => s.store === store);
      if (storeIndex !== -1) {
        global.storeResults[storeIndex].processedErrors = (global.storeResults[storeIndex].processedErrors || 0) + 1;
        global.storeResults[storeIndex].totalProcessed = (global.storeResults[storeIndex].totalProcessed || 0) + 1;
      } else {
        global.storeResults.push({
          store,
          processedSuccesses: 0,
          processedErrors: 1,
          totalProcessed: 1,
          success: false
        });
      }
    }
    
    global.errorCount = (global.errorCount || 0) + 1;
    
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Inicialização do servidor
async function startServer() {
  try {
    // Aguardar inicialização do banco de dados
    await databaseService.init();
    
    // Inicializar senha padrão se necessário
    await authService.initializeDefaultPassword();
    
    // Inicializar variáveis globais
    global.storeResults = [];
    global.totalProcessed = 0;
    global.errorCount = 0;
    global.totalStores = 0;
    global.successfulStores = 0;
    global.failedStores = 0;
    global.lastProcessed = null;
    global.lastDuration = 0;
    global.lastStartTime = null;
    global.lastEndTime = null;
    
    console.log('📊 Variáveis globais inicializadas');
    
    app.listen(PORT, () => {
      console.log(`🚀 Servidor rodando na porta ${PORT}`);
      console.log(`📅 Cron job configurado para executar com padrão: ${databaseService.getSetting('CRON_PATTERN') || '*/5 * * * *'}`);
      console.log(`🌍 Timezone do cron: ${databaseService.getSetting('CRON_TIMEZONE') || 'America/Sao_Paulo'}`);
      console.log(`🌐 Acesse: http://localhost:${PORT}`);
      
      // Inicializar sistema de checkpoint
      initializeCheckpoint();
      console.log('✅ Sistema de checkpoint inicializado');
      
      // Configurar cron job
      setupCronJob();
      
      // Iniciar monitoramento automaticamente após 5 segundos
      setTimeout(async () => {
        try {
          console.log('🔄 Iniciando monitoramento automático...');
          const result = await startMonitoring();
          if (result) {
            console.log('✅ Monitoramento iniciado automaticamente');
          } else {
            console.log('⚠️ Monitoramento já estava ativo');
          }
        } catch (error) {
          console.error('❌ Erro ao iniciar monitoramento automático:', error.message);
        }
      }, 5000);
      
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
