const axios = require('axios');
const databaseService = require('./databaseService');

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
    
    // Obter token
    const token = await getToken();
    console.log('✅ Token obtido com sucesso');
    
    // Buscar IDs dos pedidos de múltiplos restaurantes
    const orderResult = await getOrderIds(token, global.lastCheckpoint);
    const orderIds = orderResult.orderIds;
    const storeResults = orderResult.storeResults;
    const allOrders = orderResult.allOrders || []; // Adicionar esta linha
    
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
      global.storeResults = orderResult.storeResults;
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
    
    // Criar storeResults com dados de processamento
    const processedStoreResults = orderResult.storeResults.map(storeResult => {
      const storeName = storeResult.store;
      const storeOrders = results.filter(r => r.store === storeName);
      const storeSuccesses = storeOrders.filter(r => r.status === 'success').length;
      const storeErrors = storeOrders.filter(r => r.status === 'error').length;
      
      return {
        ...storeResult,
        processedSuccesses: storeSuccesses,
        processedErrors: storeErrors,
        totalProcessed: storeSuccesses + storeErrors
      };
    });
    
    global.storeResults = processedStoreResults;
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
      storeResults
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

module.exports = {
  processOrders,
  getToken,
  getOrderIds,
  sendFullReady,
  initializeCheckpoint,
  getCurrentCheckpoint
};
