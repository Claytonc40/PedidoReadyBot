let refreshInterval;

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
                    `📦 Total processado: ${storeData.totalProcessed}` : 
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
        `;
        
        storeGrid.appendChild(storeCard);
    });
}

// Função para buscar dados
async function fetchData() {
    try {
        const response = await fetch('/dashboard-data');
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
    fetchData();
}

// Inicializar
document.addEventListener('DOMContentLoaded', function() {
    fetchData();
    
    // Atualizar automaticamente a cada 30 segundos
    refreshInterval = setInterval(fetchData, 30000);
});

// Limpar intervalo quando a página for fechada
window.addEventListener('beforeunload', function() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }
});
