let refreshInterval;
let monitoringInterval;

// Função para formatar timestamp

// Função para formatar timestamp
function formatTimestamp(timestamp) {
    if (!timestamp || timestamp === 'Nunca processado') return '-';
    try {
        const date = new Date(timestamp);
        return date.toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    } catch (e) {
        return timestamp;
    }
}

// Função para formatar duração
function formatDuration(ms) {
    if (!ms) return '0ms';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(0);
    return `${minutes}m ${seconds}s`;
}

// Função para formatar uptime
function formatUptime(seconds) {
    if (!seconds) return '-';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hours}h ${minutes}m ${secs}s`;
}

// Função para atualizar a interface
function updateInterface(data) {
    // Atualizar métricas gerais
    document.getElementById('totalSuccess').textContent = data.totalProcessed || 0;
    document.getElementById('totalErrors').textContent = data.errorCount || 0;
    document.getElementById('totalProcessed').textContent = (data.totalProcessed || 0) + (data.errorCount || 0);
    document.getElementById('totalStores').textContent = data.totalStores || 0;

    // Calcular e atualizar taxa de sucesso
    const total = (data.totalProcessed || 0) + (data.errorCount || 0);
    const successRate = total > 0 ? ((data.totalProcessed || 0) / total * 100) : 0;
    document.getElementById('successRate').style.width = `${successRate}%`;
    document.getElementById('successRateText').textContent = `${successRate.toFixed(1)}%`;

    // Atualizar performance
    document.getElementById('totalTime').textContent = formatDuration(data.duration || 0);
    document.getElementById('startTime').textContent = formatTimestamp(data.startTime);
    document.getElementById('endTime').textContent = formatTimestamp(data.endTime);
    document.getElementById('lastProcessed').textContent = formatTimestamp(data.lastProcessed);

    // Atualizar checkpoint
    document.getElementById('currentCheckpoint').textContent = data.currentCheckpoint || '-';
    document.getElementById('uptime').textContent = formatUptime(data.uptime);

    // Atualizar restaurantes
    updateStoreGrid(data.storeResults || []);

    // Atualizar timestamp
    document.getElementById('lastUpdate').textContent = new Date().toLocaleString('pt-BR');
}

// Função para atualizar grid de restaurantes
function updateStoreGrid(storeResults) {
    const storeGrid = document.getElementById('storeGrid');
    storeGrid.innerHTML = '';

    if (!storeResults || storeResults.length === 0) {
        storeGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: #666; padding: 40px;">Nenhum restaurante configurado</div>';
        return;
    }

    // Criar resumo por restaurante
    const summaryByStore = {};
    storeResults.forEach(store => {
        if (!summaryByStore[store.store]) {
            summaryByStore[store.store] = { 
                success: 0, 
                errors: 0, 
                status: store.success,
                totalProcessed: 0,
                validOrders: 0,
                skippedOrders: 0,
                cancelledOrders: 0
            };
        }
        
        // Usar os dados de processamento se disponíveis
        if (store.processedSuccesses !== undefined && store.processedErrors !== undefined) {
            summaryByStore[store.store].success = store.processedSuccesses;
            summaryByStore[store.store].errors = store.processedErrors;
            summaryByStore[store.store].totalProcessed = store.totalProcessed;
        } else {
            // Fallback para dados antigos
            if (store.success && store.orders) {
                summaryByStore[store.store].success += store.orders.length;
            } else if (!store.success) {
                summaryByStore[store.store].errors += 1;
            }
        }
        
        // Adicionar dados de validação se disponíveis
        if (store.validOrders !== undefined) {
            summaryByStore[store.store].validOrders = store.validOrders;
        }
        if (store.skippedOrders !== undefined) {
            summaryByStore[store.store].skippedOrders = store.skippedOrders;
        }
        if (store.cancelledOrders !== undefined) {
            summaryByStore[store.store].cancelledOrders = store.cancelledOrders;
        }
    });

    // Exibir resumo por restaurante
    Object.keys(summaryByStore).forEach(storeName => {
        const storeData = summaryByStore[storeName];
        const storeCard = document.createElement('div');
        storeCard.className = `store-card ${storeData.status ? '' : 'error'}`;
        
        storeCard.innerHTML = `
            <div class="store-name">🏪 ${storeName}</div>
            <div class="store-stats">
                <div class="stat-item">
                    <span class="stat-number success">${storeData.success}</span>
                    <span class="stat-label">Sucessos</span>
                </div>
                <div class="stat-item">
                    <span class="stat-number error">${storeData.errors}</span>
                    <span class="stat-label">Erros</span>
                </div>
            </div>
            <div style="margin-top: 10px; font-size: 0.9rem; color: #666;">
                ${storeData.totalProcessed > 0 ? 
                    `📦 Total acumulado: ${storeData.totalProcessed}` : 
                    (storeData.status ? '✅ Funcionando' : '❌ Com problemas')
                }
            </div>
            ${storeData.validOrders !== undefined || storeData.skippedOrders !== undefined || storeData.cancelledOrders !== undefined ? `
                <div style="margin-top: 8px; font-size: 0.8rem; color: #888; border-top: 1px solid #eee; padding-top: 8px;">
                    ${storeData.validOrders !== undefined ? `✅ Válidos: ${storeData.validOrders} | ` : ''}
                    ${storeData.skippedOrders !== undefined ? `⏭️ Ignorados: ${storeData.skippedOrders} | ` : ''}
                    ${storeData.cancelledOrders !== undefined ? `❌ Cancelados: ${storeData.cancelledOrders}` : ''}
                </div>
            ` : ''}
            <div style="margin-top: 8px; font-size: 0.8rem; color: #999; font-style: italic;">
                📊 Estatísticas acumuladas desde o início
            </div>
            <div style="margin-top: 5px; font-size: 0.75rem; color: #aaa;">
                Status atual: ${storeData.status ? '✅ Ativo' : '❌ Inativo'}
            </div>
        `;
        
        storeGrid.appendChild(storeCard);
    });
}

// Função para resetar estatísticas dos restaurantes
async function resetStoreStats() {
    if (!confirm('Tem certeza que deseja resetar todas as estatísticas acumuladas dos restaurantes? Esta ação não pode ser desfeita.')) {
        return;
    }
    
    try {
        const response = await fetch('/reset-store-stats', { method: 'POST' });
        const result = await response.json();
        
        if (result.success) {
            showNotification('✅ Estatísticas resetadas com sucesso!', 'success');
            // Recarregar dados após reset
            setTimeout(() => {
                fetchData();
            }, 1000);
        } else {
            showNotification('❌ Erro ao resetar estatísticas: ' + result.error, 'error');
        }
    } catch (error) {
        showNotification('❌ Erro ao resetar estatísticas: ' + error.message, 'error');
    }
}

// Função para buscar dados
async function fetchData() {
    try {
        const response = await authManager.authenticatedFetch('/dashboard-data');
        
        if (!response) {
            return; // authManager já redirecionou para login
        }
        
        const data = await response.json();

        // Preparar dados para a interface
        const interfaceData = {
            ...data,
            startTime: data.startTime || data.lastProcessed,
            endTime: data.endTime || data.lastProcessed,
            duration: data.duration || 0,
            storeResults: data.storeResults || [],
            processed: data.totalProcessed || 0,
            errorCount: data.errorCount || 0
        };

        updateInterface(interfaceData);
        
        // Esconder loading e mostrar conteúdo
        document.getElementById('loading').style.display = 'none';
        document.getElementById('content').style.display = 'block';
        
    } catch (error) {
        console.error('Erro ao buscar dados:', error);
        document.getElementById('loading').innerHTML = `
            <div style="color: #dc3545; margin-bottom: 20px;">❌ Erro ao carregar dados</div>
            <button class="refresh-btn" onclick="refreshData()">🔄 Tentar Novamente</button>
        `;
    }
}

// Função para atualizar dados
function refreshData() {
    document.getElementById('loading').style.display = 'block';
    document.getElementById('content').style.display = 'none';
    document.getElementById('loading').innerHTML = `
        <div class="spinner"></div>
        Atualizando dados...
    `;
    
    // Atualizar tudo de uma vez
    Promise.all([
        fetchData(),
        updateMonitoringStatus(),
        updatePendingOrders()
    ]).then(() => {
        updateAutoUpdateStatus();
    });
}

// Função inteligente que combina refreshData e forceRefresh
function smartRefresh() {
    const btn = document.getElementById('smartRefreshBtn');
    const originalText = btn.innerHTML;
    
    // Desabilitar botão durante atualização
    btn.disabled = true;
    btn.innerHTML = '⏳ Atualizando...';
    
    // Primeiro tentar atualização normal
    Promise.all([
        fetchData(),
        updateMonitoringStatus(),
        updatePendingOrders()
    ]).then(() => {
        updateAutoUpdateStatus();
        showNotification('✅ Dados atualizados com sucesso!', 'success');
        
        // Restaurar botão
        btn.disabled = false;
        btn.innerHTML = originalText;
    }).catch((error) => {
        console.warn('Atualização normal falhou, tentando forçar...', error);
        
        // Se falhar, tentar atualização forçada
        btn.innerHTML = '🚀 Forçando atualização...';
        
        // Aguardar um pouco antes de tentar novamente
        setTimeout(() => {
            Promise.all([
                fetchData(),
                updateMonitoringStatus(),
                updatePendingOrders()
            ]).then(() => {
                updateAutoUpdateStatus();
                showNotification('✅ Atualização forçada concluída!', 'success');
            }).catch((forceError) => {
                console.error('Atualização forçada também falhou:', forceError);
                showNotification('❌ Erro na atualização', 'error');
            }).finally(() => {
                // Restaurar botão
                btn.disabled = false;
                btn.innerHTML = originalText;
            });
        }, 1000);
    });
}

// Verificar autenticação
async function checkAuth() {
    return await authManager.checkAuthAndRedirect();
}

// Inicializar
document.addEventListener('DOMContentLoaded', async function() {
    // Verificar autenticação primeiro
    const isAuth = await checkAuth();
    if (!isAuth) {
        return; // authManager já redirecionou para login
    }
    
    fetchData();
    
    // Atualizar automaticamente a cada 10 segundos para melhor tempo real
    refreshInterval = setInterval(() => {
        fetchData();
        updateMonitoringStatus();
        updatePendingOrders();
        updateAutoUpdateStatus();
    }, 10000);
    
    // Inicializar status do monitoramento
    updateMonitoringStatus();
    updatePendingOrders();
    updateAutoUpdateStatus();
});

// Função para atualizar status da atualização automática
function updateAutoUpdateStatus() {
    const statusElement = document.getElementById('autoUpdateStatus');
    const liveIndicator = document.getElementById('liveIndicator');
    
    if (statusElement) {
        const now = new Date();
        statusElement.innerHTML = `🔄 Atualização automática a cada 10 segundos | Última: ${now.toLocaleTimeString('pt-BR')}`;
    }
    
    // Piscar o indicador ao vivo para mostrar atividade
    if (liveIndicator) {
        liveIndicator.style.animation = 'none';
        liveIndicator.offsetHeight; // Trigger reflow
        liveIndicator.style.animation = 'pulse 2s infinite';
    }
}

// Limpar intervalo quando a página for fechada
window.addEventListener('beforeunload', function() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }
    if (monitoringInterval) {
        clearInterval(monitoringInterval);
    }
});

// ===== FUNÇÕES DE MONITORAMENTO =====

// Função para iniciar monitoramento
async function startMonitoring() {
    try {
        const response = await fetch('/api/monitoring/start', { method: 'POST' });
        const result = await response.json();
        
        if (result.success) {
            showNotification('✅ Monitoramento iniciado com sucesso', 'success');
            updateMonitoringStatus(result.status);
            startMonitoringUpdates();
        } else {
            showNotification(`❌ Erro ao iniciar monitoramento: ${result.error}`, 'error');
        }
    } catch (error) {
        console.error('Erro ao iniciar monitoramento:', error);
        showNotification('❌ Erro ao iniciar monitoramento', 'error');
    }
}

// Função para parar monitoramento
async function stopMonitoring() {
    try {
        const response = await fetch('/api/monitoring/stop', { method: 'POST' });
        const result = await response.json();
        
        if (result.success) {
            showNotification('🛑 Monitoramento parado com sucesso', 'success');
            updateMonitoringStatus(result.status);
            stopMonitoringUpdates();
        } else {
            showNotification(`❌ Erro ao parar monitoramento: ${result.error}`, 'error');
        }
    } catch (error) {
        console.error('Erro ao parar monitoramento:', error);
        showNotification('❌ Erro ao parar monitoramento', 'error');
    }
}

// Função para atualizar status do monitoramento
async function updateMonitoringStatus(status = null) {
    try {
        if (!status) {
            const response = await fetch('/api/monitoring/status');
            const result = await response.json();
            if (result.success) {
                status = result.data;
            }
        }
        
        if (status) {
            const statusElement = document.getElementById('monitoringStatus');
            const startBtn = document.getElementById('startMonitoringBtn');
            const stopBtn = document.getElementById('stopMonitoringBtn');
            
                         if (statusElement) {
                 statusElement.innerHTML = `
                     <div class="status-item ${status.isActive ? 'active' : 'inactive'}">
                         <span class="status-dot"></span>
                         ${status.isActive ? '🟢 Ativo' : '🔴 Inativo'}
                     </div>
                     <div class="status-item">
                         <span class="status-label">Pedidos na fila:</span>
                         <span class="status-value">${status.pendingOrdersCount}/${status.maxOrders || '∞'}</span>
                     </div>
                     <div class="status-item">
                         <span class="status-label">Utilização:</span>
                         <span class="status-value">${status.queueStats?.utilization || 0}%</span>
                     </div>
                     <div class="queue-utilization">
                         <div class="utilization-bar">
                             <div class="utilization-fill" id="queueUtilization"></div>
                         </div>
                     </div>
                     <div class="status-item">
                         <span class="status-label">Processando:</span>
                         <span class="status-value">${status.isProcessing ? '🔄 Sim' : '⏸️ Não'}</span>
                     </div>
                     <div class="status-item">
                         <span class="status-label">Intervalo:</span>
                         <span class="status-value">${status.interval}</span>
                     </div>
                     <div class="status-item">
                         <span class="status-label">Modo de Processamento:</span>
                         <span class="status-value">${status.processingMode || 'Cron Job'}</span>
                     </div>
                     <div class="status-item">
                         <span class="status-label">Sincronizado com Cron:</span>
                         <span class="status-value">${status.cronSync ? '✅ Sim' : '❌ Não'}</span>
                     </div>
                 `;
                 
                 // Atualizar barra de utilização
                 updateQueueUtilizationBar(status.queueStats?.utilization || 0);
             }
            
            if (startBtn) startBtn.disabled = status.isActive;
            if (stopBtn) stopBtn.disabled = !status.isActive;
        }
    } catch (error) {
        console.error('Erro ao atualizar status do monitoramento:', error);
    }
}

// Função para atualizar fila de pedidos
async function updatePendingOrders() {
    try {
        const response = await fetch('/api/monitoring/pending-orders');
        const result = await response.json();
        
        if (result.success) {
            const queueElement = document.getElementById('pendingOrdersQueue');
            if (queueElement) {
                if (result.data.length === 0) {
                    queueElement.innerHTML = '<div class="empty-queue">Nenhum pedido na fila</div>';
                } else {
                    queueElement.innerHTML = result.data.map(order => `
                        <div class="queue-item">
                            <div class="order-id">📦 ${order.id}</div>
                            <div class="order-store">🏪 ${order.store}</div>
                            <div class="order-status">
                                ${order.statusChange.from} → ${order.statusChange.to}
                            </div>
                            <div class="order-time">
                                ${formatTimestamp(order.addedToQueue)}
                            </div>
                        </div>
                    `).join('');
                }
            }
        }
    } catch (error) {
        console.error('Erro ao atualizar fila de pedidos:', error);
    }
}

// Função para limpar fila
async function clearQueue() {
    if (!confirm('Tem certeza que deseja limpar a fila de pedidos?')) {
        return;
    }
    
    try {
        const response = await fetch('/api/monitoring/clear-queue', { method: 'POST' });
        const result = await response.json();
        
        if (result.success) {
            showNotification(result.message, 'success');
            updateMonitoringStatus(result.status);
            updatePendingOrders();
        } else {
            showNotification(`❌ Erro ao limpar fila: ${result.error}`, 'error');
        }
    } catch (error) {
        console.error('Erro ao limpar fila:', error);
        showNotification('❌ Erro ao limpar fila', 'error');
    }
}

// Função para processar fila manualmente usando sendFullReady
async function processQueue() {
    try {
        // Mostrar indicador de processamento
        const processBtn = document.querySelector('button[onclick="processQueue()"]');
        const originalText = processBtn.innerHTML;
        processBtn.innerHTML = '🔄 Processando...';
        processBtn.disabled = true;
        
        // Buscar configurações de lote
        const configResponse = await fetch('/api/monitoring/queue-config');
        const configResult = await configResponse.json();
        const batchSize = configResult.success ? configResult.data.BATCH_SIZE : 10;
        
        // Buscar pedidos na fila
        const queueResponse = await fetch('/api/monitoring/pending-orders');
        const queueResult = await queueResponse.json();
        
        if (!queueResult.success || queueResult.data.length === 0) {
            showNotification('ℹ️ Nenhum pedido na fila para processar', 'info');
            return;
        }
        
        const pendingOrders = queueResult.data;
        const totalOrders = pendingOrders.length;
        let processedCount = 0;
        let successCount = 0;
        let errorCount = 0;
        
        showNotification(`🚀 Iniciando processamento de ${totalOrders} pedidos em lotes de ${batchSize}`, 'info');
        
        // Processar em lotes
        for (let i = 0; i < totalOrders; i += batchSize) {
            const batch = pendingOrders.slice(i, i + batchSize);
            const batchNumber = Math.floor(i / batchSize) + 1;
            const totalBatches = Math.ceil(totalOrders / batchSize);
            
            showNotification(`📦 Processando lote ${batchNumber}/${totalBatches} (${batch.length} pedidos)`, 'info');
            
            // Processar cada pedido do lote
            for (const order of batch) {
                try {
                    // Chamar sendFullReady para cada pedido
                    const processResponse = await fetch('/api/orders/process-full-ready', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            orderId: order.id,
                            store: order.store
                        })
                    });
                    
                    const processResult = await processResponse.json();
                    
                    if (processResult.success) {
                        successCount++;
                        console.log(`✅ Pedido ${order.id} processado com sucesso`);
        } else {
                        errorCount++;
                        console.error(`❌ Erro ao processar pedido ${order.id}:`, processResult.error);
                    }
                    
                    processedCount++;
                    
                    // Atualizar progresso
                    const progress = Math.round((processedCount / totalOrders) * 100);
                    processBtn.innerHTML = `🔄 Processando... ${progress}%`;
                    
                } catch (error) {
                    errorCount++;
                    console.error(`❌ Erro ao processar pedido ${order.id}:`, error);
                }
            }
            
            // Delay entre lotes se configurado
            if (i + batchSize < totalOrders && configResult.data.BATCH_DELAY > 0) {
                await new Promise(resolve => setTimeout(resolve, configResult.data.BATCH_DELAY));
            }
        }
        
        // Resultado final
        const message = `✅ Processamento concluído! ${successCount} sucessos, ${errorCount} erros de ${totalOrders} pedidos`;
        showNotification(message, successCount > 0 ? 'success' : 'warning');
        
        // Atualizar interface
        updateMonitoringStatus();
        updatePendingOrders();
        fetchData(); // Atualizar dashboard
        
        // Restaurar botão
        processBtn.innerHTML = originalText;
        processBtn.disabled = false;
        
    } catch (error) {
        console.error('Erro ao processar fila:', error);
        showNotification(`❌ Erro ao processar fila: ${error.message}`, 'error');
        
        // Restaurar botão em caso de erro
        const processBtn = document.querySelector('button[onclick="processQueue()"]');
        if (processBtn) {
            processBtn.innerHTML = '🚀 Processar Fila';
            processBtn.disabled = false;
        }
    }
}

// Função para iniciar atualizações do monitoramento
function startMonitoringUpdates() {
    if (monitoringInterval) {
        clearInterval(monitoringInterval);
    }
    
    // Atualizar a cada 5 segundos quando ativo
    monitoringInterval = setInterval(async () => {
        await updateMonitoringStatus();
        await updatePendingOrders();
    }, 5000);
}

// Função para parar atualizações do monitoramento
function stopMonitoringUpdates() {
    if (monitoringInterval) {
        clearInterval(monitoringInterval);
        monitoringInterval = null;
    }
}

// Função para atualizar barra de utilização da fila
function updateQueueUtilizationBar(utilization) {
    const utilizationBar = document.getElementById('queueUtilization');
    if (utilizationBar) {
        utilizationBar.style.width = `${utilization}%`;
        
        // Aplicar classe de cor baseada na utilização
        utilizationBar.className = 'utilization-fill';
        if (utilization < 50) {
            utilizationBar.classList.add('low');
        } else if (utilization < 80) {
            utilizationBar.classList.add('medium');
        } else {
            utilizationBar.classList.add('high');
        }
    }
}

// Função para mostrar notificações
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Remover após 5 segundos
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 5000);
}

// ===== FUNÇÕES DO MODAL DE CONFIGURAÇÕES =====

// Abrir modal de configurações
function openQueueConfigModal() {
    const modal = document.getElementById('queueConfigModal');
    if (modal) {
        modal.style.display = 'block';
        loadCurrentConfig();
    }
}

// Fechar modal de configurações
function closeQueueConfigModal() {
    const modal = document.getElementById('queueConfigModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Carregar configurações atuais
async function loadCurrentConfig() {
    try {
        const response = await fetch('/api/monitoring/queue-config');
        const result = await response.json();
        
        if (result.success) {
            const config = result.data;
            
            // Preencher campos do formulário
            document.getElementById('maxOrders').value = config.MAX_ORDERS;
            document.getElementById('batchSize').value = config.BATCH_SIZE;
            document.getElementById('batchDelay').value = config.BATCH_DELAY;
            document.getElementById('cronSync').value = config.CRON_SYNC.toString();
            
            // Atualizar estatísticas
            document.getElementById('configTotalAdded').textContent = config.currentStats.totalAdded;
            document.getElementById('configTotalProcessed').textContent = config.currentStats.totalProcessed;
            document.getElementById('configTotalRejected').textContent = config.currentStats.totalRejected;
            document.getElementById('configUtilization').textContent = `${config.currentUtilization}%`;
        }
    } catch (error) {
        console.error('Erro ao carregar configurações:', error);
        showNotification('❌ Erro ao carregar configurações', 'error');
    }
}

// Salvar configurações
async function saveQueueConfig() {
    try {
        const maxOrders = parseInt(document.getElementById('maxOrders').value);
        const batchSize = parseInt(document.getElementById('batchSize').value);
        const batchDelay = parseInt(document.getElementById('batchDelay').value);
        const cronSync = document.getElementById('cronSync').value === 'true';
        
        const response = await fetch('/api/monitoring/queue-config', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                MAX_ORDERS: maxOrders,
                BATCH_SIZE: batchSize,
                BATCH_DELAY: batchDelay,
                CRON_SYNC: cronSync
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('✅ Configurações salvas com sucesso', 'success');
            closeQueueConfigModal();
            
            // Atualizar status do monitoramento
            updateMonitoringStatus();
        } else {
            showNotification(`❌ Erro ao salvar: ${result.error}`, 'error');
        }
    } catch (error) {
        console.error('Erro ao salvar configurações:', error);
        showNotification('❌ Erro ao salvar configurações', 'error');
    }
}

// Restaurar configurações padrão
async function resetQueueConfig() {
    if (!confirm('Tem certeza que deseja restaurar as configurações padrão?')) {
        return;
    }
    
    try {
        const defaultConfig = {
            MAX_ORDERS: 1000,
            BATCH_SIZE: 10,
            BATCH_DELAY: 2000,
            CRON_SYNC: true
        };
        
        const response = await fetch('/api/monitoring/queue-config', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(defaultConfig)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('🔄 Configurações restauradas para padrão', 'success');
            loadCurrentConfig();
        } else {
            showNotification(`❌ Erro ao restaurar: ${result.error}`, 'error');
        }
    } catch (error) {
        console.error('Erro ao restaurar configurações:', error);
        showNotification('❌ Erro ao restaurar configurações', 'error');
    }
}

// Fechar modal ao clicar fora dele
window.onclick = function(event) {
    const modal = document.getElementById('queueConfigModal');
    if (event.target === modal) {
        closeQueueConfigModal();
    }
}

// Função para fazer logout
function logout() {
    authManager.logout();
}

// Função para controlar o sidebar
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('open');
}

// Fechar sidebar ao clicar fora (apenas em mobile)
document.addEventListener('click', function(event) {
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.querySelector('.sidebar-toggle');
    
    if (window.innerWidth <= 1024 && 
        !sidebar.contains(event.target) && 
        !sidebarToggle.contains(event.target) &&
        sidebar.classList.contains('open')) {
        sidebar.classList.remove('open');
    }
});

// Função para forçar atualização manual
function forceRefresh() {
    // Mostrar indicador de atualização forçada
    const statusElement = document.getElementById('autoUpdateStatus');
    if (statusElement) {
        statusElement.innerHTML = '🔄 Atualização forçada em andamento...';
    }
    
    // Atualizar tudo de uma vez
    Promise.all([
        fetchData(),
        updateMonitoringStatus(),
        updatePendingOrders()
    ]).then(() => {
        updateAutoUpdateStatus();
        showNotification('✅ Atualização forçada concluída!', 'success');
    }).catch(() => {
        if (statusElement) {
            statusElement.innerHTML = '❌ Erro na atualização forçada';
        }
        showNotification('❌ Erro na atualização forçada', 'error');
    });
}
