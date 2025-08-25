const axios = require('axios');
const databaseService = require('./databaseService');

// Variáveis globais para o sistema de monitoramento
let monitoringInterval = null;
let isMonitoring = false;
let pendingOrders = []; // Fila de pedidos pendentes para processamento
let lastOrderStates = new Map(); // Cache dos últimos estados dos pedidos
let processingQueue = false; // Flag para evitar processamento simultâneo

// Configurações da fila
const QUEUE_CONFIG = {
  MAX_ORDERS: 1000, // Máximo de pedidos na fila
  BATCH_SIZE: 10, // Pedidos processados por lote
  BATCH_DELAY: 2000, // Delay entre lotes (2 segundos)
  CRON_SYNC: true // Sincronizar com cron job
};

// Estatísticas da fila
let queueStats = {
  totalAdded: 0,
  totalProcessed: 0,
  totalRejected: 0,
  maxReachedCount: 0,
  lastProcessed: null
};

/**
 * Get JWT token from database or refresh if needed
 */
async function getToken() {
  try {
    console.log('🔐 Obtendo token JWT do banco de dados...');
    const token = await databaseService.getOrRefreshToken();
    
    // Log detalhado do token para debug
    console.log('🔐 Token JWT obtido com sucesso:');
    console.log(`   - Tipo: ${typeof token}`);
    console.log(`   - Comprimento: ${token ? token.length : 0}`);
    console.log(`   - Primeiros 50 caracteres: ${token ? token.substring(0, 50) + '...' : 'N/A'}`);
    console.log(`   - Últimos 50 caracteres: ${token ? '...' + token.substring(token.length - 50) : 'N/A'}`);
    
    if (!token) {
      throw new Error('Token retornado é null ou undefined');
    }
    
    if (typeof token !== 'string') {
      throw new Error(`Token deve ser string, recebido: ${typeof token}`);
    }
    
    if (token.length < 100) {
      console.log('⚠️ Token parece ser muito curto, pode estar inválido');
    }
    
    return token;
  } catch (error) {
    console.error('❌ Erro ao obter token:', error.message);
    throw new Error(`Falha ao obter token JWT: ${error.message}`);
  }
}

/**
 * Fetch orders from a specific store with retry mechanism
 */
async function fetchOrdersFromStore(token, store, checkpoint) {
  const maxRetries = 3;
  const baseDelay = 2000; // 2 segundos
  
  // Validar e converter o token se necessário
  let validToken = token;
  if (token && typeof token === 'object') {
    console.log('⚠️ Token recebido como objeto, tentando extrair valor...');
    console.log('   - Estrutura do token:', JSON.stringify(token, null, 2));
    
    // Tentar extrair o token de diferentes propriedades comuns
    if (token.token) {
      validToken = token.token;
      console.log('   ✅ Token extraído da propriedade "token"');
    } else if (token.access_token) {
      validToken = token.access_token;
      console.log('   ✅ Token extraído da propriedade "access_token"');
    } else if (token.jwt) {
      validToken = token.jwt;
      console.log('   ✅ Token extraído da propriedade "jwt"');
    } else if (token.value) {
      validToken = token.value;
      console.log('   ✅ Token extraído da propriedade "value"');
    } else {
      console.log('   ❌ Não foi possível extrair token do objeto');
      console.log('   - Propriedades disponíveis:', Object.keys(token));
      throw new Error('Token deve ser uma string válida, não um objeto');
    }
  }
  
  // Validação final do token
  if (!validToken || typeof validToken !== 'string') {
    throw new Error(`Token inválido: deve ser string, recebido ${typeof validToken}`);
  }
  
  if (validToken.length < 100) {
    console.log('⚠️ Token parece ser muito curto, pode estar inválido');
  }
  
  console.log(`   🔐 Token validado para requisição:`);
  console.log(`      - Tipo: ${typeof validToken}`);
  console.log(`      - Comprimento: ${validToken.length}`);
  console.log(`      - Primeiros 30 caracteres: ${validToken.substring(0, 30)}...`);
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Formatar o parâmetro area corretamente
      let areaParam = databaseService.getAreasString() || 'MCC|CDP|CHK|BKF|DLV';
      
      // Se estiver separado por vírgula, converter para pipe (formato que a API espera)
      if (areaParam.includes(',')) {
        areaParam = areaParam.replace(/,/g, '|');
      }
      
      const params = new URLSearchParams({
        checkpoint,
        brand: 'ADSA',
        country: 'BR',
        store: store,
        area: areaParam,
      });
      
      // Log dos parâmetros para debug
      console.log(`   📋 Parâmetros da requisição (tentativa ${attempt}/${maxRetries}):`);
      console.log(`      - checkpoint: ${checkpoint}`);
      console.log(`      - brand: ADSA`);
      console.log(`      - country: BR`);
      console.log(`      - store: ${store}`);
      console.log(`      - area original: ${databaseService.getAreasString() || 'MCC|CDP|CHK|BKF|DLV'}`);
      console.log(`      - area formatado: ${areaParam}`);
      
      const url = `https://adsa-br-ui.fkdlv.com/ui/v1/orders?${params.toString()}`;
      // Log do token que será usado na requisição
      console.log(`   🔐 Token JWT para requisição:`);
      console.log(`      - Tipo: ${typeof validToken}`);
      console.log(`      - Comprimento: ${validToken.length}`);
      console.log(`      - Header Authorization: JWT ${validToken.substring(0, 20)}...`);
      
      const headers = {
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7,es;q=0.6,zh-CN;q=0.5,zh-TW;q=0.4,zh;q=0.3',
        Connection: 'keep-alive',
        DNT: '1',
        Origin: 'https://flex-dlv.arcosdorados.net',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'cross-site',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
        accept: 'application/json',
        authorization: `JWT ${validToken}`,
        'content-type': 'application/json',
        'sec-ch-ua': '"Not;ABrand";v="99", "Google Chrome";v="139", "Chromium";v="139"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
      };
      
      try {
        console.log(`   🔍 Fazendo requisição para: ${url}`);
        const res = await axios.get(url, { 
          headers,
          timeout: 120000 // 2 minutos de timeout para requests com muitos dados
        });
        
        // Extract orders and checkpoint from response
        const allOrders = res.data?.data?.orders ?? [];
        const newCheckpoint = res.data?.data?.checkpoint;
        
        // Filtrar pedidos baseado no currentState
        const validOrders = [];
        const skippedOrders = [];
        const cancelledOrders = [];
        
        allOrders.forEach(order => {
          const currentState = order.currentState;
          
          switch (currentState) {
            case 'READY':
              // ✅ Pedido pronto para processamento
              validOrders.push(order);
              break;
              
            case 'FULL_READY':
              // ⏭️ Já foi processado, pular
              skippedOrders.push({ id: order.id, state: currentState, reason: 'Já processado' });
              break;
              
            case 'DELIVERING':
            case 'DELIVERED':
              // 🚚 Já saiu para entrega ou foi entregue, pular
              skippedOrders.push({ id: order.id, state: currentState, reason: 'Já em entrega/entregue' });
              break;
              
            case 'CANCELLED':
              // ❌ Pedido cancelado, registrar para auditoria
              cancelledOrders.push({ 
                id: order.id, 
                state: currentState, 
                reason: 'Pedido cancelado',
                store: store,
                timestamp: new Date().toISOString()
              });
              break;
              
            default:
              // ⚠️ Estado desconhecido, pular por segurança
              skippedOrders.push({ id: order.id, state: currentState, reason: 'Estado desconhecido' });
              break;
          }
        });
        
        // Registrar pedidos cancelados no banco de dados
        if (cancelledOrders.length > 0) {
          try {
            await databaseService.recordCancelledOrders(cancelledOrders);
            console.log(`   📝 ${cancelledOrders.length} pedidos cancelados registrados no banco de dados`);
          } catch (error) {
            console.error(`   ⚠️ Erro ao registrar pedidos cancelados: ${error.message}`);
          }
        }
        
        console.log(`   📊 Resposta da API:`);
        console.log(`      - Status: ${res.status}`);
        console.log(`      - Total de pedidos: ${allOrders.length}`);
        console.log(`      - Pedidos válidos (READY): ${validOrders.length}`);
        console.log(`      - Pedidos ignorados: ${skippedOrders.length}`);
        console.log(`      - Pedidos cancelados: ${cancelledOrders.length}`);
        console.log(`      - Checkpoint: ${newCheckpoint || 'N/A'}`);
        
        if (validOrders.length > 0) {
          console.log(`      - Primeiro pedido válido: ${validOrders[0].id}`);
          console.log(`      - Último pedido válido: ${validOrders[validOrders.length - 1].id}`);
        }
        
        // Log dos pedidos ignorados para debug
        if (skippedOrders.length > 0) {
          console.log(`      - Pedidos ignorados:`);
          skippedOrders.forEach(order => {
            console.log(`         • ${order.id}: ${order.state} - ${order.reason}`);
          });
        }
        
        return {
          store,
          orders: validOrders.map(o => ({ ...o, store })),
          checkpoint: newCheckpoint,
          success: true,
          totalOrders: allOrders.length,
          validOrders: validOrders.length,
          skippedOrders: skippedOrders.length,
          cancelledOrders: cancelledOrders.length
        };
        
      } catch (error) {
        console.error(`❌ Erro ao buscar pedidos do restaurante ${store}:`, error.message);
        if (error.response) {
          console.error('Status:', error.response.status);
          console.error('Response:', error.response.data);
          
          // Se for erro 401, o token pode ter expirado
          if (error.response.status === 401) {
            console.log('🔄 Token expirado detectado, tentando renovar...');
            console.log(`   📊 Detalhes do erro 401:`);
            console.log(`      - URL: ${url}`);
            console.log(`      - Token usado: ${validToken.substring(0, 30)}...`);
            console.log(`      - Status: ${error.response.status}`);
            console.log(`      - Mensagem: ${error.response.data?.message || 'N/A'}`);
            
            try {
              console.log('   🔄 Chamando databaseService.handleTokenExpiration()...');
              const newToken = await databaseService.handleTokenExpiration();
              
              console.log('   ✅ Novo token obtido:');
              console.log(`      - Tipo: ${typeof newToken}`);
              console.log(`      - Comprimento: ${newToken ? newToken.length : 0}`);
              console.log(`      - Primeiros 30 caracteres: ${newToken ? newToken.substring(0, 30) + '...' : 'N/A'}`);
              
              if (!newToken) {
                throw new Error('Novo token retornado é null ou undefined');
              }
              
              console.log('✅ Token renovado com sucesso, tentando novamente...');
              
              // Tentar novamente com o novo token
              console.log(`   🔄 Fazendo retry com novo token:`);
              console.log(`      - URL: ${url}`);
              console.log(`      - Novo token: ${newToken ? newToken.substring(0, 30) + '...' : 'N/A'}`);
              console.log(`      - Header Authorization: JWT ${newToken ? newToken.substring(0, 20) + '...' : 'N/A'}`);
              
              const retryResponse = await axios.get(url, { 
                ...headers, 
                authorization: `JWT ${newToken}`,
                timeout: 120000 // 2 minutos de timeout para requests com muitos dados
              });
              
              // Processar resposta de retry
              const allOrders = retryResponse.data?.data?.orders ?? [];
              const newCheckpoint = retryResponse.data?.data?.checkpoint;
              
              // ... resto do processamento igual ao código original ...
              const validOrders = [];
              const skippedOrders = [];
              const cancelledOrders = [];
              
              allOrders.forEach(order => {
                const currentState = order.currentState;
                
                switch (currentState) {
                  case 'READY':
                    validOrders.push(order);
                    break;
                  case 'FULL_READY':
                    skippedOrders.push({ id: order.id, state: currentState, reason: 'Já processado' });
                    break;
                  case 'DELIVERING':
                  case 'DELIVERED':
                    skippedOrders.push({ id: order.id, state: currentState, reason: 'Já em entrega/entregue' });
                    break;
                  case 'CANCELLED':
                    cancelledOrders.push({ 
                      id: order.id, 
                      state: currentState, 
                      reason: 'Pedido cancelado',
                      store: store,
                      timestamp: new Date().toISOString()
                    });
                    break;
                  default:
                    skippedOrders.push({ id: order.id, state: currentState, reason: 'Estado desconhecido' });
                    break;
                }
              });
              
              if (cancelledOrders.length > 0) {
                try {
                  await databaseService.recordCancelledOrders(cancelledOrders);
                  console.log(`   📝 ${cancelledOrders.length} pedidos cancelados registrados no banco de dados`);
                } catch (error) {
                  console.error(`   ⚠️ Erro ao registrar pedidos cancelados: ${error.message}`);
                }
              }
              
              console.log(`   📊 Resposta da API (retry):`);
              console.log(`      - Status: ${retryResponse.status}`);
              console.log(`      - Total de pedidos: ${allOrders.length}`);
              console.log(`      - Pedidos válidos (READY): ${validOrders.length}`);
              console.log(`      - Pedidos ignorados: ${skippedOrders.length}`);
              console.log(`      - Pedidos cancelados: ${cancelledOrders.length}`);
              console.log(`      - Checkpoint: ${newCheckpoint || 'N/A'}`);
              
              if (validOrders.length > 0) {
                console.log(`      - Primeiro pedido válido: ${validOrders[0].id}`);
                console.log(`      - Último pedido válido: ${validOrders[validOrders.length - 1].id}`);
              }
              
              if (skippedOrders.length > 0) {
                console.log(`      - Pedidos ignorados:`);
                skippedOrders.forEach(order => {
                  console.log(`         • ${order.id}: ${order.state} - ${order.reason}`);
                });
              }
              
              return {
                store,
                orders: validOrders.map(o => ({ ...o, store })),
                checkpoint: newCheckpoint,
                success: true,
                totalOrders: allOrders.length,
                validOrders: validOrders.length,
                skippedOrders: skippedOrders.length,
                cancelledOrders: cancelledOrders.length
              };
              
            } catch (retryError) {
              console.error('❌ Falha ao renovar token:');
              console.error(`   - Erro: ${retryError.message}`);
              console.error(`   - Stack: ${retryError.stack}`);
              console.error(`   - Token original usado: ${validToken.substring(0, 30)}...`);
              console.error(`   - URL da requisição: ${url}`);
              console.error(`   - Status do erro original: ${error.response?.status}`);
              console.error(`   - Resposta do erro original:`, error.response?.data);
              throw new Error('Token expirado e falha ao renovar. Verifique as credenciais da API.');
            }
          }
        }
        
        // Se chegou aqui, é um erro que não é 401 (token expirado)
        // Para outros erros, tentar novamente com retry
        if (attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt - 1); // Backoff exponencial
          console.log(`   ⏳ Tentativa ${attempt} falhou. Aguardando ${delay}ms antes da próxima tentativa...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        // Se todas as tentativas falharam, lançar erro
        throw error;
      }
    } catch (error) {
      // Se for erro 401, o token pode ter expirado
      if (error.response && error.response.status === 401) {
        console.log('🔄 Token expirado detectado, tentando renovar...');
        try {
          const newToken = await databaseService.handleTokenExpiration();
          console.log('✅ Token renovado com sucesso, tentando novamente...');
          
          // Tentar novamente com o novo token
          const retryResponse = await axios.get(url, { 
            ...headers, 
            authorization: `JWT ${newToken}`,
            timeout: 120000 // 2 minutos de timeout para requests com muitos dados
          });
          
          // Processar resposta de retry
          const allOrders = retryResponse.data?.data?.orders ?? [];
          const newCheckpoint = retryResponse.data?.data?.checkpoint;
          
          // ... resto do processamento igual ao código original ...
          const validOrders = [];
          const skippedOrders = [];
          const cancelledOrders = [];
          
          allOrders.forEach(order => {
            const currentState = order.currentState;
            
            switch (currentState) {
              case 'READY':
                validOrders.push(order);
                break;
              case 'FULL_READY':
                skippedOrders.push({ id: order.id, state: currentState, reason: 'Já processado' });
                break;
              case 'DELIVERING':
              case 'DELIVERED':
                skippedOrders.push({ id: order.id, state: currentState, reason: 'Já em entrega/entregue' });
                break;
              case 'CANCELLED':
                cancelledOrders.push({ 
                  id: order.id, 
                  state: currentState, 
                  reason: 'Pedido cancelado',
                  store: store,
                  timestamp: new Date().toISOString()
                });
                break;
              default:
                skippedOrders.push({ id: order.id, state: currentState, reason: 'Estado desconhecido' });
                break;
            }
          });
          
          if (cancelledOrders.length > 0) {
            try {
              await databaseService.recordCancelledOrders(cancelledOrders);
              console.log(`   📝 ${cancelledOrders.length} pedidos cancelados registrados no banco de dados`);
            } catch (error) {
              console.error(`   ⚠️ Erro ao registrar pedidos cancelados: ${error.message}`);
            }
          }
          
          console.log(`   📊 Resposta da API (retry):`);
          console.log(`      - Status: ${retryResponse.status}`);
          console.log(`      - Total de pedidos: ${allOrders.length}`);
          console.log(`      - Pedidos válidos (READY): ${validOrders.length}`);
          console.log(`      - Pedidos ignorados: ${skippedOrders.length}`);
          console.log(`      - Pedidos cancelados: ${cancelledOrders.length}`);
          console.log(`      - Checkpoint: ${newCheckpoint || 'N/A'}`);
          
          if (validOrders.length > 0) {
            console.log(`      - Primeiro pedido válido: ${validOrders[0].id}`);
            console.log(`      - Último pedido válido: ${validOrders[validOrders.length - 1].id}`);
          }
          
          if (skippedOrders.length > 0) {
            console.log(`      - Pedidos ignorados:`);
            skippedOrders.forEach(order => {
              console.log(`         • ${order.id}: ${order.state} - ${order.reason}`);
            });
          }
          
          return {
            store,
            orders: validOrders.map(o => ({ ...o, store })),
            checkpoint: newCheckpoint,
            success: true,
            totalOrders: allOrders.length,
            validOrders: validOrders.length,
            skippedOrders: skippedOrders.length,
            cancelledOrders: cancelledOrders.length
          };
          
        } catch (retryError) {
          console.error('❌ Falha ao renovar token:', retryError.message);
          throw new Error('Token expirado e falha ao renovar. Verifique as credenciais da API.');
        }
      }
      
      // Se chegou aqui, é um erro que não é 401 (token expirado)
      // Para outros erros, tentar novamente com retry
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt - 1); // Backoff exponencial
        console.log(`   ⏳ Tentativa ${attempt} falhou. Aguardando ${delay}ms antes da próxima tentativa...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // Se todas as tentativas falharam, lançar erro
      throw error;
    }
  }
  
  // Se chegou aqui, todas as tentativas falharam
  return {
    store,
    orders: [],
    checkpoint: null,
    success: false,
    error: 'Todas as tentativas falharam',
    totalOrders: 0,
    validOrders: 0,
    skippedOrders: 0,
    cancelledOrders: 0
  };
}

/**
 * Fetch the list of orders from multiple stores using the JWT token
 */
async function getOrderIds(token, lastCheckpoint = null) {
  // Use the lastCheckpoint if provided, otherwise use current timestamp
  const checkpoint = lastCheckpoint || Date.now().toString();
  console.log(`📅 Usando checkpoint: ${checkpoint}`);
  
  // Get stores from database
  const stores = databaseService.getStoresString().split(',').map(s => s.trim());
  console.log(`🏪 Buscando pedidos dos restaurantes: ${stores.join(', ')}`);
  
  // Fetch orders from all stores
  const storeResults = [];
  let allOrders = [];
  let latestCheckpoint = checkpoint;
  
  console.log(`\n🔍 INICIANDO BUSCA EM ${stores.length} RESTAURANTES`);
  console.log(`📅 Checkpoint base: ${checkpoint}`);
  
  for (let i = 0; i < stores.length; i++) {
    const store = stores[i];
    const progress = `${i + 1}/${stores.length}`;
    
    try {
      console.log(`\n🔄 [${progress}] Buscando pedidos do restaurante ${store}...`);
      const startTime = Date.now();
      
      const result = await fetchOrdersFromStore(token, store, checkpoint);
      const searchTime = Date.now() - startTime;
      
      storeResults.push(result);
      
      if (result.success && result.orders.length > 0) {
        allOrders = allOrders.concat(result.orders);
        console.log(`✅ [${progress}] Restaurante ${store}: ${result.orders.length} pedidos encontrados em ${searchTime}ms`);
      } else if (result.success) {
        console.log(`ℹ️ [${progress}] Restaurante ${store}: Nenhum pedido encontrado em ${searchTime}ms`);
      } else {
        console.log(`⚠️ [${progress}] Restaurante ${store}: Erro na busca - ${result.error}`);
      }
      
      // Update checkpoint if we got a newer one
      if (result.checkpoint && result.checkpoint > latestCheckpoint) {
        console.log(`🔄 [${progress}] Novo checkpoint encontrado: ${result.checkpoint} (anterior: ${latestCheckpoint})`);
        latestCheckpoint = result.checkpoint;
      }
      
      // Small delay between requests to avoid overwhelming the API
      if (i < stores.length - 1) {
        console.log(`⏳ Aguardando 100ms antes da próxima busca...`);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
    } catch (error) {
      console.error(`💥 [${progress}] Erro crítico ao buscar do restaurante ${store}:`, error.message);
      storeResults.push({
        store,
        orders: [],
        checkpoint: null,
        success: false,
        error: error.message
      });
    }
  }
  
  // Store the latest checkpoint globally for next request
  if (latestCheckpoint && latestCheckpoint !== checkpoint) {
    global.lastCheckpoint = latestCheckpoint.toString();
    console.log(`💾 Novo checkpoint salvo: ${global.lastCheckpoint}`);
  }
  
  // Log summary
  const totalOrders = allOrders.length;
  const successfulStores = storeResults.filter(r => r.success).length;
  const failedStores = storeResults.filter(r => !r.success).length;
  
  // Calcular estatísticas de validação
  const totalValidOrders = storeResults.reduce((sum, r) => sum + (r.validOrders || 0), 0);
  const totalSkippedOrders = storeResults.reduce((sum, r) => sum + (r.skippedOrders || 0), 0);
  const totalCancelledOrders = storeResults.reduce((sum, r) => sum + (r.cancelledOrders || 0), 0);
  
  console.log(`\n📊 RESUMO DA BUSCA`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`🏪 Restaurantes configurados: ${stores.length}`);
  console.log(`✅ Restaurantes com sucesso: ${successfulStores}`);
  console.log(`❌ Restaurantes com falha: ${failedStores}`);
  console.log(`📦 Total de pedidos encontrados: ${totalOrders}`);
  console.log(`✅ Pedidos válidos (READY): ${totalValidOrders}`);
  console.log(`⏭️ Pedidos ignorados: ${totalSkippedOrders}`);
  console.log(`❌ Pedidos cancelados: ${totalCancelledOrders}`);
  console.log(`💾 Checkpoint final: ${latestCheckpoint}`);
  
  if (totalValidOrders > 0) {
    console.log(`\n📋 Pedidos válidos por restaurante:`);
    storeResults.forEach(result => {
      if (result.success && result.validOrders > 0) {
        console.log(`   🏪 ${result.store}: ${result.validOrders} pedidos válidos`);
      }
    });
  }
  
  if (totalSkippedOrders > 0) {
    console.log(`\n⏭️ Pedidos ignorados por restaurante:`);
    storeResults.forEach(result => {
      if (result.success && result.skippedOrders > 0) {
        console.log(`   🏪 ${result.store}: ${result.skippedOrders} pedidos ignorados`);
      }
    });
  }
  
  if (totalCancelledOrders > 0) {
    console.log(`\n❌ Pedidos cancelados por restaurante:`);
    storeResults.forEach(result => {
      if (result.success && result.cancelledOrders > 0) {
        console.log(`   🏪 ${result.store}: ${result.cancelledOrders} pedidos cancelados`);
      }
    });
  }
  
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  
  return {
    orderIds: allOrders.map(o => o.id),
    allOrders: allOrders, // Adicionar esta linha
    checkpoint: latestCheckpoint,
    storeResults,
    totalStores: stores.length,
    successfulStores,
    failedStores
  };
}

/**
 * Send a FULL_READY action for a specific order ID
 */
async function sendFullReady(token, orderId) {
  // Validar e converter o token se necessário
  let validToken = token;
  if (token && typeof token === 'object') {
    console.log('⚠️ Token recebido como objeto em sendFullReady, tentando extrair valor...');
    
    // Tentar extrair o token de diferentes propriedades comuns
    if (token.token) {
      validToken = token.token;
      console.log('   ✅ Token extraído da propriedade "token"');
    } else if (token.access_token) {
      validToken = token.access_token;
      console.log('   ✅ Token extraído da propriedade "access_token"');
    } else if (token.jwt) {
      validToken = token.jwt;
      console.log('   ✅ Token extraído da propriedade "jwt"');
    } else if (token.value) {
      validToken = token.value;
      console.log('   ✅ Token extraído da propriedade "value"');
    } else {
      console.log('   ❌ Não foi possível extrair token do objeto');
      throw new Error('Token deve ser uma string válida, não um objeto');
    }
  }
  
  // Validação final do token
  if (!validToken || typeof validToken !== 'string') {
    throw new Error(`Token inválido em sendFullReady: deve ser string, recebido ${typeof validToken}`);
  }
  
  const url = 'https://adsa-br-ui.fkdlv.com/ui/v1/orders';
  const headers = {
    'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7,es;q=0.6,zh-CN;q=0.5,zh-TW;q=0.4,zh;q=0.3',
    Connection: 'keep-alive',
    DNT: '1',
    Origin: 'https://flex-dlv.arcosdorados.net',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'cross-site',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
    accept: 'application/json',
    authorization: `JWT ${validToken}`,
    'content-type': 'application/json',
    'sec-ch-ua': '"Not;A=Brand";v="99", "Google Chrome";v="139", "Chromium";v="139"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
  };
  
  const body = {
    id: orderId,
    action: 'FULL_READY',
  };
  
  try {
    const res = await axios.post(url, body, { 
      headers,
      timeout: 60000 // 1 minuto de timeout para FULL_READY
    });
    return res.data;
  } catch (error) {
    console.error(`Erro ao enviar FULL_READY para pedido ${orderId}:`, error.message);
    
    // Se for erro 401, o token pode ter expirado
    if (error.response && error.response.status === 401) {
      console.log('🔄 Token expirado detectado em FULL_READY, tentando renovar...');
      try {
        const newToken = await databaseService.handleTokenExpiration();
        console.log('✅ Token renovado com sucesso, tentando FULL_READY novamente...');
        
        // Tentar novamente com o novo token
        const retryResponse = await axios.post(url, body, { 
          ...headers, 
          authorization: `JWT ${newToken}`,
          timeout: 60000 // 1 minuto de timeout para FULL_READY
        });
        
        return retryResponse.data;
        
      } catch (retryError) {
        console.error('❌ Falha ao renovar token em FULL_READY:', retryError.message);
        throw new Error(`Token expirado e falha ao renovar para pedido ${orderId}. Verifique as credenciais da API.`);
      }
    }
    
    throw new Error(`Falha ao processar pedido ${orderId}: ${error.message}`);
  }
}

/**
 * Initialize checkpoint system
 */
function initializeCheckpoint() {
  if (!global.lastCheckpoint) {
    global.lastCheckpoint = Date.now().toString();
    console.log(`🚀 Inicializando checkpoint: ${global.lastCheckpoint}`);
  }
}

/**
 * Get current checkpoint status
 */
function getCurrentCheckpoint() {
  return global.lastCheckpoint || 'Não inicializado';
}

/**
 * Main function to process orders
 */
async function processOrders() {
  const startTime = Date.now();
  console.log('\n🚀 ==========================================');
  console.log('🚀 INICIANDO PROCESSAMENTO DE PEDIDOS');
  console.log('🚀 ==========================================');
  console.log(`⏰ Hora de início: ${new Date().toISOString()}`);
  console.log(`🔍 Checkpoint atual: ${global.lastCheckpoint || 'Não definido'}`);
  
  try {
    // Inicializar sistema de checkpoint
    initializeCheckpoint();
    
    // Obter configurações de lote
    const batchSize = parseInt(databaseService.getSetting('BATCH_SIZE')) || QUEUE_CONFIG.BATCH_SIZE;
    const batchDelay = parseInt(databaseService.getSetting('BATCH_DELAY')) || QUEUE_CONFIG.BATCH_DELAY;
    
    console.log(`📦 Configurações de lote: ${batchSize} pedidos por lote, ${batchDelay}ms entre lotes`);
    
    // Verificar se há pedidos na fila para processar
    if (pendingOrders.length > 0) {
      console.log(`📋 Processando ${pendingOrders.length} pedidos da fila em lotes de ${batchSize}`);
      
      const results = [];
      let successCount = 0;
      let errorCount = 0;
      
      // Processar em lotes
      for (let i = 0; i < pendingOrders.length; i += batchSize) {
        const batch = pendingOrders.slice(i, i + batchSize);
        const batchNumber = Math.floor(i / batchSize) + 1;
        const totalBatches = Math.ceil(pendingOrders.length / batchSize);
        
        console.log(`\n📦 Processando lote ${batchNumber}/${totalBatches} (${batch.length} pedidos)`);
        
        // Processar cada pedido do lote
        for (const order of batch) {
          try {
            console.log(`🔄 Processando pedido ${order.id} (Loja: ${order.store})...`);
            
            // Buscar token da loja
            const storeData = databaseService.getRestaurantByName(order.store);
            if (!storeData || !storeData.token) {
              throw new Error(`Token não encontrado para a loja ${order.store}`);
            }
            
            // Processar pedido usando sendFullReady
            const response = await sendFullReady(storeData.token, order.id);
            
            if (response) {
              results.push({ id: order.id, status: 'success', response, store: order.store });
              successCount++;
              console.log(`✅ Pedido ${order.id} (Loja: ${order.store}) processado com sucesso`);
              
              // Atualizar estatísticas globais
              if (global.storeResults) {
                const storeIndex = global.storeResults.findIndex(s => s.store === order.store);
                if (storeIndex !== -1) {
                  global.storeResults[storeIndex].processedSuccesses = (global.storeResults[storeIndex].processedSuccesses || 0) + 1;
                  global.storeResults[storeIndex].totalProcessed = (global.storeResults[storeIndex].totalProcessed || 0) + 1;
                } else {
                  global.storeResults.push({
                    store: order.store,
                    processedSuccesses: 1,
                    processedErrors: 0,
                    totalProcessed: 1,
                    success: true
                  });
                }
              }
              
              global.totalProcessed = (global.totalProcessed || 0) + 1;
            } else {
              throw new Error('Falha ao processar pedido');
            }
            
          } catch (error) {
            console.error(`❌ Erro ao processar pedido ${order.id}:`, error.message);
            errorCount++;
            
            // Atualizar estatísticas de erro
            if (global.storeResults) {
              const storeIndex = global.storeResults.findIndex(s => s.store === order.store);
              if (storeIndex !== -1) {
                global.storeResults[storeIndex].processedErrors = (global.storeResults[storeIndex].processedErrors || 0) + 1;
                global.storeResults[storeIndex].totalProcessed = (global.storeResults[storeIndex].totalProcessed || 0) + 1;
              } else {
                global.storeResults.push({
                  store: order.store,
                  processedSuccesses: 0,
                  processedErrors: 1,
                  totalProcessed: 1,
                  success: false
                });
              }
            }
            
            global.errorCount = (global.errorCount || 0) + 1;
          }
        }
        
        // Delay entre lotes se configurado
        if (i + batchSize < pendingOrders.length && batchDelay > 0) {
          console.log(`⏳ Aguardando ${batchDelay}ms antes do próximo lote...`);
          await new Promise(resolve => setTimeout(resolve, batchDelay));
        }
      }
      
      // Limpar fila após processamento
      const processedOrderIds = pendingOrders.map(o => o.id);
      pendingOrders = [];
      
      console.log(`\n✅ Processamento da fila concluído!`);
      console.log(`📊 Resumo: ${successCount} sucessos, ${errorCount} erros de ${results.length} pedidos`);
      
      // Atualizar estatísticas globais
      const duration = Date.now() - startTime;
      global.lastProcessed = new Date().toISOString();
      global.lastDuration = duration;
      global.lastStartTime = new Date(startTime).toISOString();
      global.lastEndTime = new Date().toISOString();
      
      return {
        success: true,
        message: `Fila processada com sucesso: ${successCount} sucessos, ${errorCount} erros`,
        processed: successCount,
        totalStores: 1, // Processando apenas da fila
        successfulStores: successCount > 0 ? 1 : 0,
        failedStores: errorCount > 0 ? 1 : 0,
        duration: duration,
        processingMethod: 'sendFullReady',
        queueCleanup: {
          removed: processedOrderIds.length,
          remaining: 0,
          message: 'Fila processada e limpa'
        }
      };
    }
    
    // Se não há pedidos na fila, processar normalmente
    console.log('📋 Nenhum pedido na fila, processando normalmente...');
    
    // Obter token
    const token = await getToken();
    console.log('✅ Token obtido com sucesso');
    
    // Buscar IDs dos pedidos de múltiplos restaurantes
    const orderResult = await getOrderIds(token, global.lastCheckpoint);
    const orderIds = orderResult.orderIds;
    const storeResults = orderResult.storeResults;
    const allOrders = orderResult.allOrders || [];
    
    console.log(`📋 Encontrados ${orderIds.length} pedidos para processar de ${orderResult.totalStores} restaurantes`);
    
    if (orderIds.length === 0) {
      console.log('ℹ️ Nenhum pedido para processar');
      
      // Atualizar estatísticas globais mesmo quando não há pedidos
      const duration = Date.now() - startTime;
      global.lastProcessed = new Date().toISOString();
      global.totalProcessed = global.totalProcessed || 0;
      global.totalStores = orderResult.totalStores;
      global.successfulStores = orderResult.successfulStores;
      global.failedStores = orderResult.failedStores;
      global.errorCount = 0;
      
          // Manter dados acumulados existentes se não houver novos dados
    if (!global.storeResults || global.storeResults.length === 0) {
      global.storeResults = orderResult.storeResults;
      console.log(`📊 Inicializando global.storeResults com ${orderResult.storeResults.length} restaurantes`);
    } else {
      console.log(`📊 global.storeResults já existe com ${global.storeResults.length} restaurantes`);
    }
      
      global.lastDuration = duration;
      global.lastStartTime = new Date(startTime).toISOString();
      global.lastEndTime = new Date().toISOString();
      
      return {
        success: true,
        message: 'Nenhum pedido para processar',
        processed: 0,
        totalStores: orderResult.totalStores,
        successfulStores: orderResult.successfulStores,
        failedStores: orderResult.failedStores,
        duration: duration
      };
    }
    
    // Processar cada pedido
    const results = [];
    let successCount = 0;
    let errorCount = 0;
    
    console.log(`\n🚀 INICIANDO PROCESSAMENTO DE ${orderIds.length} PEDIDOS`);
    console.log(`📊 Estatísticas por restaurante:`);
    
    // Agrupar pedidos por restaurante para melhor visualização
    const ordersByStore = {};
    orderIds.forEach(id => {
      const order = allOrders.find(o => o.id === id);
      if (order && order.store) {
        if (!ordersByStore[order.store]) {
          ordersByStore[order.store] = [];
        }
        ordersByStore[order.store].push(id);
      }
    });
    
    // Mostrar resumo por restaurante
    Object.keys(ordersByStore).forEach(store => {
      console.log(`   🏪 ${store}: ${ordersByStore[store].length} pedidos`);
    });
    
    console.log(`\n🔄 PROCESSANDO PEDIDOS...`);
    
    for (const id of orderIds) {
      try {
        // Encontrar o restaurante do pedido
        const order = allOrders.find(o => o.id === id);
        const store = order?.store || 'Desconhecido';
        
        console.log(`\n🔄 Processando pedido ${id} (Loja: ${store})...`);
        const response = await sendFullReady(token, id);
        results.push({ id, status: 'success', response, store });
        successCount++;
        console.log(`✅ Pedido ${id} (Loja: ${store}) processado com sucesso`);
      } catch (error) {
        console.error(`❌ Erro ao processar pedido ${id}:`, error.message);
        const order = allOrders.find(o => o.id === id);
        const store = order?.store || 'Desconhecido';
        results.push({ id, status: 'error', error: error.message, store });
        errorCount++;
      }
    }
    
    const duration = Date.now() - startTime;
    
    // Atualizar estatísticas globais
    global.lastProcessed = new Date().toISOString();
    global.totalProcessed = (global.totalProcessed || 0) + successCount;
    global.totalStores = orderResult.totalStores;
    global.successfulStores = orderResult.successfulStores;
    global.failedStores = orderResult.failedStores;
    global.errorCount = errorCount;
    
    // Criar storeResults com dados de processamento acumulados
    const processedStoreResults = orderResult.storeResults.map(storeResult => {
      const storeName = storeResult.store;
      const storeOrders = results.filter(r => r.store === storeName);
      const storeSuccesses = storeOrders.filter(r => r.status === 'success').length;
      const storeErrors = storeOrders.filter(r => r.status === 'error').length;
      
      // Obter dados acumulados anteriores se existirem
      const previousStoreData = global.storeResults?.find(s => s.store === storeName) || {};
      
      // Calcular novos valores acumulados
      const newProcessedSuccesses = (previousStoreData.processedSuccesses || 0) + storeSuccesses;
      const newProcessedErrors = (previousStoreData.processedErrors || 0) + storeErrors;
      const newTotalProcessed = (previousStoreData.totalProcessed || 0) + storeSuccesses + storeErrors;
      
      // Log para debug
      console.log(`📊 Estatísticas para ${storeName}:`);
      console.log(`   - Sucessos anteriores: ${previousStoreData.processedSuccesses || 0}`);
      console.log(`   - Sucessos atuais: ${storeSuccesses}`);
      console.log(`   - Sucessos acumulados: ${newProcessedSuccesses}`);
      console.log(`   - Erros anteriores: ${previousStoreData.processedErrors || 0}`);
      console.log(`   - Erros atuais: ${storeErrors}`);
      console.log(`   - Erros acumulados: ${newProcessedErrors}`);
      console.log(`   - Total processado anterior: ${previousStoreData.totalProcessed || 0}`);
      console.log(`   - Total processado atual: ${storeSuccesses + storeErrors}`);
      console.log(`   - Total processado acumulados: ${newTotalProcessed}`);
      
      return {
        ...storeResult,
        processedSuccesses: newProcessedSuccesses,
        processedErrors: newProcessedErrors,
        totalProcessed: newTotalProcessed,
        // Manter dados de validação acumulados
        validOrders: (previousStoreData.validOrders || 0) + (storeResult.validOrders || 0),
        skippedOrders: (previousStoreData.skippedOrders || 0) + (storeResult.skippedOrders || 0),
        cancelledOrders: (previousStoreData.cancelledOrders || 0) + (storeResult.cancelledOrders || 0)
      };
    });
    
    // Atualizar estatísticas globais
    global.storeResults = processedStoreResults;
    
    // Log para debug das estatísticas finais
    console.log(`\n📊 ESTATÍSTICAS GLOBAIS ATUALIZADAS:`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`✅ Total processado: ${global.totalProcessed}`);
    console.log(`❌ Total de erros: ${global.errorCount}`);
    console.log(`🏪 Total de restaurantes: ${global.totalStores}`);
    console.log(`📦 StoreResults atualizados: ${global.storeResults.length} restaurantes`);
    global.storeResults.forEach(store => {
      console.log(`   🏪 ${store.store}: ✅${store.processedSuccesses} ❌${store.processedErrors} 📦${store.totalProcessed}`);
    });
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    global.lastDuration = duration;
    global.lastStartTime = new Date(startTime).toISOString();
    global.lastEndTime = new Date().toISOString();
    
    // Estatísticas por restaurante
    const successByStore = {};
    const errorByStore = {};
    
    results.forEach(result => {
      const store = result.store || 'Desconhecido';
      if (result.status === 'success') {
        successByStore[store] = (successByStore[store] || 0) + 1;
      } else {
        errorByStore[store] = (errorByStore[store] || 0) + 1;
      }
    });
    
    console.log(`\n🎯 ==========================================`);
    console.log(`🎯 PROCESSAMENTO CONCLUÍDO`);
    console.log(`🎯 ==========================================`);
    console.log(`⏱️ Tempo total: ${duration}ms`);
    console.log(`⏰ Hora de conclusão: ${new Date().toISOString()}`);
    
    console.log(`\n📊 RESUMO GERAL:`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`✅ Total de sucessos: ${successCount}`);
    console.log(`❌ Total de erros: ${errorCount}`);
    console.log(`📦 Total processado: ${orderIds.length}`);
    console.log(`🏪 Restaurantes envolvidos: ${orderResult.totalStores}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    
    console.log(`\n🏪 RESUMO POR RESTAURANTE:`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    Object.keys(successByStore).forEach(store => {
      const errors = errorByStore[store] || 0;
      console.log(`🏪 ${store}: ✅ ${successByStore[store]} | ❌ ${errors}`);
    });
    
    // Mostrar restaurantes que tiveram apenas erros
    Object.keys(errorByStore).forEach(store => {
      if (!successByStore[store]) {
        console.log(`🏪 ${store}: ❌ ${errorByStore[store]} (apenas erros)`);
      }
    });
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    // Limpar pedidos processados da fila de pendentes usando função auxiliar
    const queueCleanupResult = clearProcessedOrdersFromQueue(orderIds);
    
    // Log detalhado sobre a limpeza da fila
    if (queueCleanupResult.removed > 0) {
      console.log(`\n🧹 ==========================================`);
      console.log(`🧹 FILA DE PEDIDOS LIMPA`);
      console.log(`🧹 ==========================================`);
      console.log(`📊 Resumo da limpeza:`);
      console.log(`   - Pedidos processados: ${orderIds.length}`);
      console.log(`   - Pedidos removidos da fila: ${queueCleanupResult.removed}`);
      console.log(`   - Pedidos restantes na fila: ${queueCleanupResult.remaining}`);
      console.log(`   - Mensagem: ${queueCleanupResult.message}`);
      console.log(`🧹 ==========================================\n`);
    } else {
      console.log(`\nℹ️ Nenhum pedido foi removido da fila neste ciclo`);
    }
    
    console.log(`\n🚀 ==========================================`);
    console.log(`🚀 PROCESSAMENTO FINALIZADO COM SUCESSO`);
    console.log(`🚀 ==========================================\n`);
    
    return {
      success: true,
      message: 'Processamento concluído',
      processed: orderIds.length,
      successCount,
      errorCount,
      totalStores: orderResult.totalStores,
      successfulStores: orderResult.successfulStores,
      failedStores: orderResult.failedStores,
      duration,
      results,
      storeResults,
      queueCleanup: queueCleanupResult,
      // Informações adicionais sobre o processamento
      processingMethod: 'sendFullReady',
      ordersProcessed: orderIds,
      queueStatus: {
        before: queueCleanupResult.remaining + queueCleanupResult.removed,
        after: queueCleanupResult.remaining,
        removed: queueCleanupResult.removed
      }
    };
    
  } catch (error) {
    console.error('💥 Erro crítico no processamento:', error.message);
    
    // Se for erro de autenticação, retornar erro específico
    if (error.message.includes('Token expirado') || error.message.includes('401')) {
      return {
        success: false,
        message: 'Erro de autenticação - token expirado ou inválido',
        error: error.message,
        processed: 0,
        successCount: 0,
        errorCount: 1,
        totalStores: 0,
        successfulStores: 0,
        failedStores: 0,
        duration: Date.now() - startTime
      };
    }
    
    throw error;
  }
}

/**
 * Limpa pedidos processados da fila de pendentes
 * Esta função é chamada automaticamente quando o cron job processa pedidos via sendFullReady
 */
function clearProcessedOrdersFromQueue(processedIds) {
  if (!processedIds || processedIds.length === 0) {
    return { removed: 0, remaining: pendingOrders.length, message: 'Nenhum ID para processar' };
  }
  
  if (pendingOrders.length === 0) {
    return { removed: 0, remaining: 0, message: 'Fila já está vazia' };
  }
  
  const beforeCount = pendingOrders.length;
  
  // Encontrar pedidos que estão na fila e foram processados
  const ordersToRemove = pendingOrders.filter(order => processedIds.includes(order.id));
  const ordersToKeep = pendingOrders.filter(order => !processedIds.includes(order.id));
  
  // Atualizar a fila
  pendingOrders = ordersToKeep;
  
  const afterCount = pendingOrders.length;
  const removedCount = beforeCount - afterCount;
  
  if (removedCount > 0) {
    console.log(`🧹 Fila de pedidos limpa: ${removedCount} pedidos processados removidos`);
    console.log(`📋 Pedidos restantes na fila: ${afterCount}/${QUEUE_CONFIG.MAX_ORDERS}`);
    
    // Atualizar estatísticas da fila
    queueStats.totalProcessed += removedCount;
    queueStats.lastProcessed = new Date().toISOString();
    
    // Log detalhado dos pedidos removidos
    const removedOrderIds = ordersToRemove.map(order => order.id);
    console.log(`📝 Pedidos removidos da fila: ${removedOrderIds.join(', ')}`);
    
    // Log detalhado dos pedidos que permaneceram
    if (afterCount > 0) {
      const remainingOrderIds = ordersToKeep.map(order => order.id);
      console.log(`📋 Pedidos que permaneceram na fila: ${remainingOrderIds.join(', ')}`);
    }
  } else {
    console.log(`ℹ️ Nenhum pedido da fila foi processado neste ciclo`);
  }
  
  return { 
    removed: removedCount, 
    remaining: afterCount, 
    message: removedCount > 0 ? `${removedCount} pedidos removidos` : 'Nenhum pedido removido',
    processedIds: processedIds,
    removedOrderIds: ordersToRemove.map(order => order.id)
  };
}

/**
 * Inicia o monitoramento contínuo de pedidos
 */
async function startMonitoring() {
  if (isMonitoring) {
    console.log('⚠️ Monitoramento já está ativo');
    return false;
  }
  
  console.log('🚀 Iniciando monitoramento contínuo de pedidos...');
  console.log('⏰ Intervalo de verificação: 30 segundos');
  
  isMonitoring = true;
  
  // Primeira verificação imediata
  await checkForOrderChanges();
  
  // Obter intervalo de monitoramento personalizado (padrão: 30 segundos)
  let monitoringIntervalMs = 30000; // 30 segundos padrão
  
  try {
    const setting = databaseService.getSetting('MONITORING_INTERVAL');
    if (setting && setting !== '') {
      monitoringIntervalMs = parseInt(setting);
    }
  } catch (error) {
    console.log('⚠️ Usando intervalo padrão de 30 segundos');
  }
  
  const intervalSeconds = Math.floor(monitoringIntervalMs / 1000);
  console.log(`⏰ Monitoramento configurado: ${intervalSeconds} segundos (tempo real)`);
  
  monitoringInterval = setInterval(async () => {
    if (isMonitoring) {
      await checkForOrderChanges();
    }
  }, monitoringIntervalMs);
  
  console.log('✅ Monitoramento iniciado com sucesso');
  return true;
}

/**
 * Para o monitoramento contínuo
 */
function stopMonitoring() {
  if (!isMonitoring) {
    console.log('⚠️ Monitoramento não está ativo');
    return false;
  }
  
  console.log('🛑 Parando monitoramento contínuo...');
  
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
  }
  
  isMonitoring = false;
  console.log('✅ Monitoramento parado com sucesso');
  return true;
}

/**
 * Verifica mudanças nos status dos pedidos
 */
async function checkForOrderChanges() {
  if (!isMonitoring) {
    return;
  }
  
  try {
    console.log('\n🔍 Verificando mudanças nos status dos pedidos...');
    const startTime = Date.now();
    
    // Obter token
    const token = await getToken();
    
    // Buscar pedidos atuais
    const orderResult = await getOrderIds(token, global.lastCheckpoint);
    const currentOrders = orderResult.allOrders || [];
    
    console.log(`📊 Verificação: ${currentOrders.length} pedidos encontrados`);
    
    // Verificar mudanças de status
    const newPendingOrders = [];
    
    for (const order of currentOrders) {
      const orderId = order.id;
      const currentState = order.currentState;
      const lastState = lastOrderStates.get(orderId);
      
      // Se é um pedido novo ou o status mudou
      if (!lastState || lastState !== currentState) {
        console.log(`🔄 Status alterado para pedido ${orderId}: ${lastState || 'NOVO'} → ${currentState}`);
        
        // Atualizar cache
        lastOrderStates.set(orderId, currentState);
        
        // Se o status é READY, adicionar à fila de processamento
        if (currentState === 'READY') {
          // Verificar se a fila está cheia
          if (pendingOrders.length >= QUEUE_CONFIG.MAX_ORDERS) {
            console.log(`⚠️ Fila cheia (${pendingOrders.length}/${QUEUE_CONFIG.MAX_ORDERS}). Pedido ${orderId} rejeitado.`);
            queueStats.totalRejected++;
            queueStats.maxReachedCount++;
            continue; // Pular este pedido
          }
          
          const orderWithStore = {
            ...order,
            store: order.store || 'Desconhecido',
            statusChange: {
              from: lastState || 'NOVO',
              to: currentState,
              timestamp: new Date().toISOString()
            }
          };
          
          // Verificar se já não está na fila
          const alreadyInQueue = pendingOrders.find(p => p.id === orderId);
          if (!alreadyInQueue) {
            pendingOrders.push(orderWithStore);
            newPendingOrders.push(orderWithStore);
            queueStats.totalAdded++;
            console.log(`✅ Pedido ${orderId} adicionado à fila de processamento (${pendingOrders.length}/${QUEUE_CONFIG.MAX_ORDERS})`);
          }
        }
      }
    }
    
    const checkTime = Date.now() - startTime;
    console.log(`⏱️ Verificação concluída em ${checkTime}ms`);
    console.log(`📋 Novos pedidos na fila: ${newPendingOrders.length}`);
    console.log(`📋 Total na fila: ${pendingOrders.length}`);
    
    // Se há pedidos na fila, apenas logar (processamento será feito pelo cron)
    if (pendingOrders.length > 0) {
      console.log(`📋 ${pendingOrders.length} pedidos aguardando processamento pelo cron job`);
    }
    
  } catch (error) {
    console.error('❌ Erro na verificação de mudanças:', error.message);
  }
}

/**
 * Processa a fila de pedidos pendentes
 */
async function processPendingOrdersQueue() {
  if (processingQueue) {
    console.log('⚠️ Processamento da fila já está em andamento');
    return;
  }
  
  if (pendingOrders.length === 0) {
    console.log('ℹ️ Nenhum pedido na fila para processar');
    return;
  }
  
  processingQueue = true;
  console.log(`\n🚀 PROCESSANDO FILA DE ${pendingOrders.length} PEDIDOS`);
  
  try {
    // Obter token
    const token = await getToken();
    
    const results = [];
    let successCount = 0;
    let errorCount = 0;
    
    // Processar pedidos em lote usando configurações da fila
    const batchSize = QUEUE_CONFIG.BATCH_SIZE;
    const batches = Math.ceil(pendingOrders.length / batchSize);
    
    for (let batch = 0; batch < batches; batch++) {
      const startIndex = batch * batchSize;
      const endIndex = Math.min(startIndex + batchSize, pendingOrders.length);
      const currentBatch = pendingOrders.slice(startIndex, endIndex);
      
      console.log(`\n📦 Processando lote ${batch + 1}/${batches} (${currentBatch.length} pedidos)`);
      
      for (const order of currentBatch) {
        try {
          console.log(`🔄 Processando pedido ${order.id} (Loja: ${order.store})...`);
          console.log(`   Status: ${order.statusChange.from} → ${order.statusChange.to}`);
          
          const response = await sendFullReady(token, order.id);
          results.push({ 
            id: order.id, 
            status: 'success', 
            response, 
            store: order.store,
            statusChange: order.statusChange
          });
          successCount++;
          console.log(`✅ Pedido ${order.id} processado com sucesso`);
          
        } catch (error) {
          console.error(`❌ Erro ao processar pedido ${order.id}:`, error.message);
          results.push({ 
            id: order.id, 
            status: 'error', 
            error: error.message, 
            store: order.store,
            statusChange: order.statusChange
          });
          errorCount++;
        }
      }
      
      // Pausa entre lotes usando configuração da fila
      if (batch < batches - 1) {
        console.log(`⏳ Aguardando ${QUEUE_CONFIG.BATCH_DELAY}ms antes do próximo lote...`);
        await new Promise(resolve => setTimeout(resolve, QUEUE_CONFIG.BATCH_DELAY));
      }
    }
    
    // Remover pedidos processados da fila usando função auxiliar
    const processedIds = results.map(r => r.id);
    const queueCleanupResult = clearProcessedOrdersFromQueue(processedIds);
    
    // Atualizar estatísticas da fila (já feito na função auxiliar)
    // queueStats.totalProcessed += successCount; // Removido - já é feito na função auxiliar
    // queueStats.lastProcessed = new Date().toISOString(); // Removido - já é feito na função auxiliar
    
    console.log(`\n🎯 PROCESSAMENTO DA FILA CONCLUÍDO`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`✅ Sucessos: ${successCount}`);
    console.log(`❌ Erros: ${errorCount}`);
    console.log(`📦 Total processado: ${results.length}`);
    console.log(`🧹 Fila limpa: ${queueCleanupResult.removed} pedidos removidos`);
    console.log(`📋 Restantes na fila: ${queueCleanupResult.remaining}/${QUEUE_CONFIG.MAX_ORDERS}`);
    console.log(`📊 Estatísticas da fila:`);
    console.log(`   - Total adicionado: ${queueStats.totalAdded}`);
    console.log(`   - Total processado: ${queueStats.totalProcessed}`);
    console.log(`   - Total rejeitado: ${queueStats.totalRejected}`);
    console.log(`   - Vezes que fila ficou cheia: ${queueStats.maxReachedCount}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    
    // Atualizar estatísticas globais
    global.lastQueueProcessed = new Date().toISOString();
    global.totalQueueProcessed = (global.totalQueueProcessed || 0) + successCount;
    global.queueErrorCount = (global.queueErrorCount || 0) + errorCount;
    
  } catch (error) {
    console.error('💥 Erro crítico no processamento da fila:', error.message);
  } finally {
    processingQueue = false;
  }
}

/**
 * Obtém o status atual do monitoramento
 */
async function getMonitoringStatus() {
  // Obter intervalo de monitoramento personalizado
  let intervalText = 'Não configurado';
  let intervalMs = 30000; // padrão
  
  try {
    const setting = databaseService.getSetting('MONITORING_INTERVAL');
    if (setting && setting !== '') {
      intervalMs = parseInt(setting);
      const intervalSeconds = Math.floor(intervalMs / 1000);
      intervalText = `${intervalSeconds} segundos (tempo real)`;
    } else {
      intervalText = '30 segundos (tempo real)';
    }
  } catch (error) {
    intervalText = '30 segundos (tempo real)';
  }
  
  return {
    isActive: isMonitoring,
    pendingOrdersCount: pendingOrders.length,
    maxOrders: QUEUE_CONFIG.MAX_ORDERS,
    isProcessing: processingQueue,
    lastOrderStatesCount: lastOrderStates.size,
    interval: monitoringInterval ? intervalText : 'Não configurado',
    cronSync: QUEUE_CONFIG.CRON_SYNC,
    processingMode: 'Cron Job',
    queueStats: {
      ...queueStats,
      utilization: Math.round((pendingOrders.length / QUEUE_CONFIG.MAX_ORDERS) * 100)
    }
  };
}

/**
 * Obtém a fila de pedidos pendentes
 */
function getPendingOrders() {
  return pendingOrders.map(order => ({
    id: order.id,
    store: order.store,
    currentState: order.currentState,
    statusChange: order.statusChange,
    addedToQueue: order.addedToQueue || new Date().toISOString()
  }));
}

/**
 * Limpa a fila de pedidos pendentes
 */
function clearPendingOrders() {
  const count = pendingOrders.length;
  pendingOrders = [];
  lastOrderStates.clear();
  
  // Resetar estatísticas da fila
  queueStats = {
    totalAdded: 0,
    totalProcessed: 0,
    totalRejected: 0,
    maxReachedCount: 0,
    lastProcessed: null
  };
  
  console.log(`🧹 Fila de pedidos limpa: ${count} pedidos removidos`);
  console.log(`📊 Estatísticas da fila resetadas`);
  return count;
}

/**
 * Adiciona um pedido manualmente à fila
 */
function addOrderToQueue(order) {
  if (!order || !order.id) {
    throw new Error('Pedido inválido: deve ter ID');
  }
  
  // Verificar se a fila está cheia
  if (pendingOrders.length >= QUEUE_CONFIG.MAX_ORDERS) {
    console.log(`⚠️ Fila cheia (${pendingOrders.length}/${QUEUE_CONFIG.MAX_ORDERS}). Pedido ${order.id} rejeitado.`);
    queueStats.totalRejected++;
    queueStats.maxReachedCount++;
    return false;
  }
  
  // Verificar se já está na fila
  const alreadyInQueue = pendingOrders.find(p => p.id === order.id);
  if (alreadyInQueue) {
    console.log(`⚠️ Pedido ${order.id} já está na fila`);
    return false;
  }
  
  const orderWithMetadata = {
    ...order,
    store: order.store || 'Desconhecido',
    statusChange: {
      from: 'MANUAL',
      to: order.currentState || 'READY',
      timestamp: new Date().toISOString()
    },
    addedToQueue: new Date().toISOString()
  };
  
  pendingOrders.push(orderWithMetadata);
  queueStats.totalAdded++;
  console.log(`✅ Pedido ${order.id} adicionado manualmente à fila (${pendingOrders.length}/${QUEUE_CONFIG.MAX_ORDERS})`);
  
  // Se não está sendo processada, iniciar processamento
  if (!processingQueue) {
    processPendingOrdersQueue();
  }
  
  return true;
}

/**
 * Obtém as configurações da fila
 */
function getQueueConfig() {
  return {
    ...QUEUE_CONFIG,
    currentStats: queueStats,
    currentUtilization: Math.round((pendingOrders.length / QUEUE_CONFIG.MAX_ORDERS) * 100)
  };
}

/**
 * Atualiza as configurações da fila
 */
function updateQueueConfig(newConfig) {
  if (newConfig.MAX_ORDERS && newConfig.MAX_ORDERS > 0) {
    QUEUE_CONFIG.MAX_ORDERS = newConfig.MAX_ORDERS;
  }
  
  if (newConfig.BATCH_SIZE && newConfig.BATCH_SIZE > 0) {
    QUEUE_CONFIG.BATCH_SIZE = newConfig.BATCH_SIZE;
  }
  
  if (newConfig.BATCH_DELAY && newConfig.BATCH_DELAY >= 0) {
    QUEUE_CONFIG.BATCH_DELAY = newConfig.BATCH_DELAY;
  }
  
  if (typeof newConfig.CRON_SYNC === 'boolean') {
    QUEUE_CONFIG.CRON_SYNC = newConfig.CRON_SYNC;
  }
  
  console.log('⚙️ Configurações da fila atualizadas:', QUEUE_CONFIG);
  return QUEUE_CONFIG;
}

module.exports = {
  processOrders,
  getToken,
  getOrderIds,
  sendFullReady,
  initializeCheckpoint,
  getCurrentCheckpoint,
  // Novas funções de monitoramento
  startMonitoring,
  stopMonitoring,
  checkForOrderChanges,
  processPendingOrdersQueue,
  getMonitoringStatus,
  getPendingOrders,
  clearPendingOrders,
  addOrderToQueue,
  getQueueConfig,
  updateQueueConfig,
  clearProcessedOrdersFromQueue
};

