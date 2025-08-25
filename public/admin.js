// Variáveis globais
let currentRestaurantId = null;
let currentAreaId = null;

// Verificar autenticação ao carregar a página
document.addEventListener('DOMContentLoaded', async function() {
    // Verificar se o usuário está autenticado
    const isAuth = await authManager.checkAuthAndRedirect();
    if (!isAuth) {
        return; // authManager já redirecionou para login
    }
    
    // Carregar dados iniciais
    loadStats();
    
    // Configurar formulários
    const restaurantForm = document.getElementById('restaurantForm');
    const areaForm = document.getElementById('areaForm');
    const cronForm = document.getElementById('cronConfigForm');
    const changePasswordForm = document.getElementById('changePasswordForm');
    
    if (restaurantForm) restaurantForm.addEventListener('submit', saveRestaurant);
    if (areaForm) areaForm.addEventListener('submit', saveArea);
    if (cronForm) cronForm.addEventListener('submit', saveCronConfig);
    if (changePasswordForm) changePasswordForm.addEventListener('submit', handlePasswordChange);
    
    // Fechar modais ao clicar fora
    window.addEventListener('click', function(event) {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = 'none';
        }
    });
});

// Funções de navegação
function showTab(tabName) {
    // Esconder todas as tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Remover classe active de todas as tabs
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Mostrar tab selecionada
    document.getElementById(tabName).classList.add('active');
    
    // Ativar tab no menu
    event.target.classList.add('active');
    
    // Atualizar sidebar
    updateSidebarActiveItem(tabName);
    
    // Carregar dados da tab
    loadTabData(tabName);
}

function loadTabData(tabName) {
    switch(tabName) {
        case 'overview':
            loadStats();
            break;
        case 'restaurants':
            loadRestaurants();
            break;
        case 'areas':
            loadAreas();
            break;
        case 'monitoring':
            loadMonitoringConfig();
            break;
        case 'settings':
            loadSettings();
            break;
        case 'profile':
            loadProfile();
            break;
    }
}

// Funções para estatísticas
async function loadStats() {
    try {
        const response = await authManager.authenticatedFetch('/api/database/stats');
        
        if (!response) {
            return; // authManager já redirecionou para login
        }
        
        const result = await response.json();
        
        if (result.success) {
            displayStats(result.data);
        } else {
            showError('Erro ao carregar estatísticas: ' + result.error);
        }
    } catch (error) {
        showError('Erro ao carregar estatísticas: ' + error.message);
    }
}

function displayStats(stats) {
    const content = document.getElementById('stats-content');
    
    content.innerHTML = `
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-number">${stats.totalRestaurants}</div>
                <div class="stat-label">Total de Restaurantes</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${stats.activeRestaurants}</div>
                <div class="stat-label">Restaurantes Ativos</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${stats.totalAreas}</div>
                <div class="stat-label">Total de Áreas</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${stats.activeAreas}</div>
                <div class="stat-label">Áreas Ativas</div>
            </div>
        </div>
    `;
}

function refreshStats() {
    loadStats();
}

// Funções para restaurantes
async function loadRestaurants() {
    try {
        const response = await authManager.authenticatedFetch('/api/restaurants');
        
        if (!response) {
            return; // authManager já redirecionou para login
        }
        
        const result = await response.json();
        
        if (result.success) {
            displayRestaurants(result.data);
        } else {
            showError('Erro ao carregar restaurantes: ' + result.error);
        }
    } catch (error) {
        showError('Erro ao carregar restaurantes: ' + error.message);
    }
}

function displayRestaurants(restaurants) {
    const content = document.getElementById('restaurants-content');
    
    if (restaurants.length === 0) {
        content.innerHTML = '<p style="text-align: center; color: #666; padding: 40px;">Nenhum restaurante encontrado</p>';
        return;
    }
    
    let tableHTML = `
        <table class="table">
            <thead>
                <tr>
                    <th>Código</th>
                    <th>Nome</th>
                    <th>Descrição</th>
                    <th>Status</th>
                    <th>Criado em</th>
                    <th>Ações</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    restaurants.forEach(restaurant => {
        const statusClass = restaurant.active ? 'status-active' : 'status-inactive';
        const statusText = restaurant.active ? 'Ativo' : 'Inativo';
        
        tableHTML += `
            <tr>
                <td><strong>${restaurant.code}</strong></td>
                <td>${restaurant.name}</td>
                <td>${restaurant.description || '-'}</td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                <td>${formatDate(restaurant.created_at)}</td>
                <td>
                    <button class="btn btn-secondary" onclick="editRestaurant(${restaurant.id})" style="margin-right: 5px;">✏️</button>
                    <button class="btn btn-danger" onclick="deleteRestaurant(${restaurant.id})">🗑️</button>
                </td>
            </tr>
        `;
    });
    
    tableHTML += '</tbody></table>';
    content.innerHTML = tableHTML;
}

function showRestaurantModal(restaurant = null) {
    const modal = document.getElementById('restaurantModal');
    const title = document.getElementById('restaurantModalTitle');
    const form = document.getElementById('restaurantForm');
    
    if (restaurant) {
        // Modo edição
        title.textContent = 'Editar Restaurante';
        document.getElementById('restaurantId').value = restaurant.id;
        document.getElementById('restaurantCode').value = restaurant.code;
        document.getElementById('restaurantName').value = restaurant.name;
        document.getElementById('restaurantDescription').value = restaurant.description || '';
        document.getElementById('restaurantActive').checked = restaurant.active == 1;
        currentRestaurantId = restaurant.id;
    } else {
        // Modo criação
        title.textContent = 'Adicionar Restaurante';
        form.reset();
        document.getElementById('restaurantId').value = '';
        currentRestaurantId = null;
    }
    
    modal.style.display = 'block';
}

function closeRestaurantModal() {
    document.getElementById('restaurantModal').style.display = 'none';
}

async function saveRestaurant(event) {
    event.preventDefault();
    
    const formData = {
        code: document.getElementById('restaurantCode').value,
        name: document.getElementById('restaurantName').value,
        description: document.getElementById('restaurantDescription').value,
        active: document.getElementById('restaurantActive').checked
    };
    
    try {
        let response;
        if (currentRestaurantId) {
            // Atualizar
            response = await fetch(`/api/restaurants/${currentRestaurantId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
        } else {
            // Criar
            response = await fetch('/api/restaurants', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
        }
        
        const result = await response.json();
        
        if (result.success) {
            showSuccess(result.message);
            closeRestaurantModal();
            loadRestaurants();
        } else {
            showError('Erro ao salvar restaurante: ' + result.error);
        }
    } catch (error) {
        showError('Erro ao salvar restaurante: ' + error.message);
    }
}

async function editRestaurant(id) {
    try {
        const response = await fetch(`/api/restaurants/${id}`);
        const result = await response.json();
        
        if (result.success) {
            showRestaurantModal(result.data);
        } else {
            showError('Erro ao carregar restaurante: ' + result.error);
        }
    } catch (error) {
        showError('Erro ao carregar restaurante: ' + error.message);
    }
}

async function deleteRestaurant(id) {
    if (!confirm('Tem certeza que deseja deletar este restaurante?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/restaurants/${id}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
            showSuccess(result.message);
            loadRestaurants();
        } else {
            showError('Erro ao deletar restaurante: ' + result.error);
        }
    } catch (error) {
        showError('Erro ao deletar restaurante: ' + error.message);
    }
}

// Funções para áreas
async function loadAreas() {
    try {
        const response = await authManager.authenticatedFetch('/api/areas');
        
        if (!response) {
            return; // authManager já redirecionou para login
        }
        
        const result = await response.json();
        
        if (result.success) {
            displayAreas(result.data);
        } else {
            showError('Erro ao carregar áreas: ' + result.error);
        }
    } catch (error) {
        showError('Erro ao carregar áreas: ' + error.message);
    }
}

function displayAreas(areas) {
    const content = document.getElementById('areas-content');
    
    if (areas.length === 0) {
        content.innerHTML = '<p style="text-align: center; color: #666; padding: 40px;">Nenhuma área encontrada</p>';
        return;
    }
    
    let tableHTML = `
        <table class="table">
            <thead>
                <tr>
                    <th>Código</th>
                    <th>Nome</th>
                    <th>Descrição</th>
                    <th>Status</th>
                    <th>Criado em</th>
                    <th>Ações</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    areas.forEach(area => {
        const statusClass = area.active ? 'status-active' : 'status-inactive';
        const statusText = area.active ? 'Ativa' : 'Inativa';
        
        tableHTML += `
            <tr>
                <td><strong>${area.code}</strong></td>
                <td>${area.name}</td>
                <td>${area.description || '-'}</td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                <td>${formatDate(area.created_at)}</td>
                <td>
                    <button class="btn btn-secondary" onclick="editArea(${area.id})" style="margin-right: 5px;">✏️</button>
                    <button class="btn btn-danger" onclick="deleteArea(${area.id})">🗑️</button>
                </td>
            </tr>
        `;
    });
    
    tableHTML += '</tbody></table>';
    content.innerHTML = tableHTML;
}

function showAreaModal(area = null) {
    const modal = document.getElementById('areaModal');
    const title = document.getElementById('areaModalTitle');
    const form = document.getElementById('areaForm');
    
    if (area) {
        // Modo edição
        title.textContent = 'Editar Área';
        document.getElementById('areaId').value = area.id;
        document.getElementById('areaCode').value = area.code;
        document.getElementById('areaName').value = area.name;
        document.getElementById('areaDescription').value = area.description || '';
        document.getElementById('areaActive').checked = area.active == 1;
        currentAreaId = area.id;
    } else {
        // Modo criação
        title.textContent = 'Adicionar Área';
        form.reset();
        document.getElementById('areaId').value = '';
        currentAreaId = null;
    }
    
    modal.style.display = 'block';
}

function closeAreaModal() {
    document.getElementById('areaModal').style.display = 'none';
}

async function saveArea(event) {
    event.preventDefault();
    
    const formData = {
        code: document.getElementById('areaCode').value,
        name: document.getElementById('areaName').value,
        description: document.getElementById('areaDescription').value,
        active: document.getElementById('areaActive').checked
    };
    
    try {
        let response;
        if (currentAreaId) {
            // Atualizar
            response = await fetch(`/api/areas/${currentAreaId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
        } else {
            // Criar
            response = await fetch('/api/areas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
        }
        
        const result = await response.json();
        
        if (result.success) {
            showSuccess(result.message);
            closeAreaModal();
            loadAreas();
        } else {
            showError('Erro ao salvar área: ' + result.error);
        }
    } catch (error) {
        showError('Erro ao salvar área: ' + error.message);
    }
}

async function editArea(id) {
    try {
        const response = await fetch(`/api/areas/${id}`);
        const result = await response.json();
        
        if (result.success) {
            showAreaModal(result.data);
        } else {
            showError('Erro ao carregar área: ' + result.error);
        }
    } catch (error) {
        showError('Erro ao carregar área: ' + error.message);
    }
}

async function deleteArea(id) {
    if (!confirm('Tem certeza que deseja deletar esta área?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/areas/${id}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
            showSuccess(result.message);
            loadAreas();
        } else {
            showError('Erro ao deletar área: ' + result.error);
        }
    } catch (error) {
        showError('Erro ao deletar área: ' + error.message);
    }
}

// Funções para configurações
async function loadSettings() {
    try {
        const response = await authManager.authenticatedFetch('/api/settings');
        
        if (!response) {
            return; // authManager já redirecionou para login
        }
        
        const result = await response.json();
        
        if (result.success) {
            displaySettings(result.data);
        } else {
            showError('Erro ao carregar configurações: ' + result.error);
        }
    } catch (error) {
        showError('Erro ao carregar configurações: ' + error.message);
    }
}

function displaySettings(settings) {
    const content = document.getElementById('settings-content');
    
    let tableHTML = `
        <table class="table">
            <thead>
                <tr>
                    <th>Chave</th>
                    <th>Valor</th>
                    <th>Descrição</th>
                    <th>Atualizado em</th>
                    <th>Ações</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    settings.forEach(setting => {
        // Ocultar o campo JWT_TOKEN e mostrar informações especiais
        if (setting.key === 'JWT_TOKEN') {
            tableHTML += `
                <tr>
                    <td><strong>${setting.key}</strong></td>
                    <td>
                        <div class="alert alert-info" style="margin: 0; padding: 8px; font-size: 0.9rem;">
                            <strong>🔄 Gerenciamento Automático</strong><br>
                            <small>Token obtido e renovado automaticamente da API</small>
                        </div>
                    </td>
                    <td>${setting.description || '-'}</td>
                    <td>${formatDate(setting.updated_at)}</td>
                    <td>
                        <button class="btn btn-info" onclick="refreshToken()" title="Renovar token manualmente">🔄</button>
                    </td>
                </tr>
            `;
        } else if (setting.key === 'CRON_PATTERN') {
            tableHTML += `
                <tr>
                    <td><strong>${setting.key}</strong></td>
                    <td>
                        <code>${setting.value}</code>
                        <br><small>Execução automática de pedidos</small>
                    </td>
                    <td>${setting.description || '-'}</td>
                    <td>${formatDate(setting.updated_at)}</td>
                    <td>
                        <button class="btn btn-info" style="margin-top: 10px; margin-bottom: 10px;" onclick="showCronModal('${setting.key}', '${setting.value}')" title="Configurar cron">⚙️</button>
                    </td>
                </tr>
            `;
        } else if (setting.key === 'CRON_TIMEZONE') {
            tableHTML += `
                <tr>
                    <td><strong>${setting.key}</strong></td>
                    <td>
                        <code>${setting.value}</code>
                        <br><small>Fuso horário para execução</small>
                    </td>
                    <td>${setting.description || '-'}</td>
                    <td>${formatDate(setting.updated_at)}</td>
                    <td>
                        <button class="btn btn-info" style="margin-top: 10px; margin-bottom: 10px;" onclick="showCronModal('${setting.key}', '${setting.value}')" title="Configurar cron">⚙️</button>
                    </td>
                </tr>
            `;
        } else {
            tableHTML += `
                <tr>
                    <td><strong>${setting.key}</strong></td>
                    <td>${setting.value}</td>
                    <td>${setting.description || '-'}</td>
                    <td>${formatDate(setting.updated_at)}</td>
                    <td>
                        <button class="btn btn-secondary" onclick="editSetting('${setting.key}', '${setting.value}', '${setting.description || ''}')">✏️</button>
                    </td>
                </tr>
            `;
        }
    });
    
    tableHTML += '</tbody></table>';
    content.innerHTML = tableHTML;
}

function editSetting(key, value, description) {
    const newValue = prompt(`Editar valor para ${key}:`, value);
    if (newValue === null) return;
    
    const newDescription = prompt(`Editar descrição para ${key}:`, description);
    if (newDescription === null) return;
    
    updateSetting(key, newValue, newDescription);
}

async function updateSetting(key, value, description) {
  try {
    const response = await fetch(`/api/settings/${key}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value, description })
    });
    
    const result = await response.json();
    
    if (result.success) {
      showSuccess(result.message);
      loadSettings();
    } else {
      showError('Erro ao atualizar configuração: ' + result.error);
    }
  } catch (error) {
    showError('Erro ao atualizar configuração: ' + error.message);
  }
}

// Função para renovar token manualmente
async function refreshToken() {
  try {
    showAlert('🔄 Renovando token...', 'info');
    
    const response = await fetch('/test-token-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    const result = await response.json();
    
    if (result.success) {
      showSuccess('✅ Token renovado com sucesso!');
      loadSettings(); // Recarregar configurações para mostrar nova data
    } else {
      showError('❌ Erro ao renovar token: ' + (result.error?.message || result.message));
    }
  } catch (error) {
    showError('❌ Erro ao renovar token: ' + error.message);
  }
}

// Funções utilitárias
function formatDate(dateString) {
    if (!dateString) return '-';
    try {
        const date = new Date(dateString);
        return date.toLocaleString('pt-BR');
    } catch (e) {
        return dateString;
    }
}

function showSuccess(message) {
    showAlert(message, 'success');
}

function showError(message) {
    showAlert(message, 'error');
}

function showAlert(message, type) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.textContent = message;
    
    // Inserir no topo da página
    document.body.insertBefore(alertDiv, document.body.firstChild);
    
    // Remover após 5 segundos
    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
}

// Event listeners já configurados no início do arquivo

// Funções para o modal do cron
function showCronModal(key, currentValue) {
    // Carregar valores atuais
    if (key === 'CRON_PATTERN') {
        loadCurrentCronPattern(currentValue);
    } else if (key === 'CRON_TIMEZONE') {
        loadCurrentCronTimezone(currentValue);
    }
    
    document.getElementById('cronModal').style.display = 'block';
}

function closeCronModal() {
    document.getElementById('cronModal').style.display = 'none';
    resetCronForm();
}

function resetCronForm() {
    document.getElementById('cronFrequency').value = '';
    document.getElementById('cronInterval').value = '';
    document.getElementById('cronTime').value = '00:00';
    document.getElementById('cronBusinessStart').value = '08:00';
    document.getElementById('cronBusinessEnd').value = '18:00';
    document.getElementById('cronCustomPattern').value = '';
    document.getElementById('cronTimezone').value = 'America/Sao_Paulo';
    document.getElementById('cronDescription').value = '';
    document.getElementById('cronPattern').value = '';
    
    // Ocultar todos os grupos
    hideAllCronGroups();
    
    // Resetar preview
    document.getElementById('cronPreview').innerHTML = '<code>Selecione uma frequência para ver a prévia</code>';
    document.getElementById('cronPreview').className = 'cron-preview';
}

function hideAllCronGroups() {
    document.getElementById('cronIntervalGroup').style.display = 'none';
    document.getElementById('cronTimeGroup').style.display = 'none';
    document.getElementById('cronBusinessGroup').style.display = 'none';
    document.getElementById('cronCustomGroup').style.display = 'none';
}

function loadCurrentCronPattern(pattern) {
    // Tentar identificar o padrão atual
    if (pattern.includes('*/')) {
        const interval = pattern.split('*/')[1].split(' ')[0];
        document.getElementById('cronFrequency').value = 'minutes';
        document.getElementById('cronInterval').value = interval;
        updateCronPreview();
    } else if (pattern.includes('0 */')) {
        const interval = pattern.split('0 */')[1].split(' ')[0];
        document.getElementById('cronFrequency').value = 'hours';
        document.getElementById('cronInterval').value = interval;
        updateCronPreview();
    } else if (pattern.includes('0 0 * * *')) {
        document.getElementById('cronFrequency').value = 'daily';
        updateCronPreview();
    } else if (pattern.includes('0 8-18 * * 1-5')) {
        document.getElementById('cronFrequency').value = 'business';
        updateCronPreview();
    } else {
        document.getElementById('cronFrequency').value = 'custom';
        document.getElementById('cronCustomPattern').value = pattern;
        updateCronPreview();
    }
}

function loadCurrentCronTimezone(timezone) {
    document.getElementById('cronTimezone').value = timezone;
}

function updateCronPreview() {
    const frequency = document.getElementById('cronFrequency').value;
    const preview = document.getElementById('cronPreview');
    const patternInput = document.getElementById('cronPattern');
    
    if (!frequency) {
        preview.innerHTML = '<code>Selecione uma frequência para ver a prévia</code>';
        preview.className = 'cron-preview';
        return;
    }
    
    let cronPattern = '';
    let description = '';
    
    switch (frequency) {
        case 'minutes':
            const minutes = document.getElementById('cronInterval').value;
            if (minutes) {
                cronPattern = `*/${minutes} * * * *`;
                description = `A cada ${minutes} minutos`;
            }
            break;
            
        case 'hours':
            const hours = document.getElementById('cronInterval').value;
            if (hours) {
                cronPattern = `0 */${hours} * * *`;
                description = `A cada ${hours} horas`;
            }
            break;
            
        case 'daily':
            const time = document.getElementById('cronTime').value;
            const [hour, minute] = time.split(':');
            cronPattern = `${minute} ${hour} * * *`;
            description = `Diariamente às ${time}`;
            break;
            
        case 'business':
            const start = document.getElementById('cronBusinessStart').value;
            const end = document.getElementById('cronBusinessEnd').value;
            const [startHour] = start.split(':');
            const [endHour] = end.split(':');
            cronPattern = `0 ${startHour}-${endHour} * * 1-5`;
            description = `Horário comercial (${start} às ${end}, seg-sex)`;
            break;
            
        case 'custom':
            const customPattern = document.getElementById('cronCustomPattern').value;
            if (customPattern) {
                cronPattern = customPattern;
                description = 'Padrão personalizado';
            }
            break;
    }
    
    if (cronPattern) {
        patternInput.value = cronPattern;
        preview.innerHTML = `<code>${cronPattern}</code><br><small>${description}</small>`;
        preview.className = 'cron-preview valid';
    } else {
        preview.innerHTML = '<code>Complete os campos para ver a prévia</code>';
        preview.className = 'cron-preview';
    }
}

// Event listeners para campos do cron
document.addEventListener('DOMContentLoaded', function() {
    const frequencySelect = document.getElementById('cronFrequency');
    if (frequencySelect) {
        frequencySelect.addEventListener('change', function() {
            const frequency = this.value;
            hideAllCronGroups();
            
            switch (frequency) {
                case 'minutes':
                case 'hours':
                    document.getElementById('cronIntervalGroup').style.display = 'block';
                    document.getElementById('cronIntervalHelp').textContent = 
                        frequency === 'minutes' ? 'Intervalo em minutos (1-59)' : 'Intervalo em horas (1-23)';
                    break;
                    
                case 'daily':
                    document.getElementById('cronTimeGroup').style.display = 'block';
                    break;
                    
                case 'business':
                    document.getElementById('cronBusinessGroup').style.display = 'block';
                    break;
                    
                case 'custom':
                    document.getElementById('cronCustomGroup').style.display = 'block';
                    break;
            }
            
            updateCronPreview();
        });
    }
    
    // Event listeners para campos que afetam o preview
    const cronFields = ['cronInterval', 'cronTime', 'cronBusinessStart', 'cronBusinessEnd', 'cronCustomPattern'];
    cronFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.addEventListener('input', updateCronPreview);
        }
    });
});

async function saveCronConfig(event) {
    event.preventDefault();
    
    const pattern = document.getElementById('cronPattern').value;
    const timezone = document.getElementById('cronTimezone').value;
    const description = document.getElementById('cronDescription').value;
    
    if (!pattern) {
        showError('Por favor, configure um padrão cron válido');
        return;
    }
    
    try {
        // Salvar CRON_PATTERN
        await updateSetting('CRON_PATTERN', pattern, description || 'Configuração automática do cron');
        
        // Salvar CRON_TIMEZONE
        await updateSetting('CRON_TIMEZONE', timezone, 'Timezone para execução do cron');
        
        showSuccess('✅ Configuração do cron salva com sucesso!');
        closeCronModal();
        
    } catch (error) {
        showError('❌ Erro ao salvar configuração do cron: ' + error.message);
    }
}

// ===== FUNÇÕES DE MONITORAMENTO =====

// Carregar configurações de monitoramento
async function loadMonitoringConfig() {
    try {
        const response = await authManager.authenticatedFetch('/api/monitoring/queue-config');
        
        if (!response) {
            return; // authManager já redirecionou para login
        }
        
        const result = await response.json();
        
        if (result.success) {
            displayMonitoringConfig(result.data);
        } else {
            showError('Erro ao carregar configurações de monitoramento: ' + result.error);
        }
    } catch (error) {
        showError('Erro ao carregar configurações de monitoramento: ' + error.message);
    }
}

// Exibir configurações de monitoramento
function displayMonitoringConfig(config) {
    const content = document.getElementById('monitoring-content');
    
    content.innerHTML = `
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-number">${config.MAX_ORDERS}</div>
                <div class="stat-label">Limite da Fila</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${config.BATCH_SIZE}</div>
                <div class="stat-label">Pedidos por Lote</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${config.BATCH_DELAY}ms</div>
                <div class="stat-label">Delay entre Lotes</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${config.CRON_SYNC ? '✅' : '❌'}</div>
                <div class="stat-label">Sincronizado com Cron</div>
            </div>
        </div>
        <div style="margin-top: 20px; text-align: center;">
            <button class="btn" onclick="showMonitoringConfigModal()">
                ⚙️ Configurar Monitoramento
            </button>
        </div>
    `;
}

// Abrir modal de configurações de monitoramento
function showMonitoringConfigModal() {
    const modal = document.getElementById('monitoringConfigModal');
    if (modal) {
        modal.style.display = 'block';
        loadCurrentMonitoringConfig();
    }
}

// Fechar modal de configurações de monitoramento
function closeMonitoringConfigModal() {
    const modal = document.getElementById('monitoringConfigModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Carregar configurações atuais no modal
async function loadCurrentMonitoringConfig() {
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
            
                    // Carregar intervalo de monitoramento do banco de dados
        try {
            const intervalResponse = await authManager.authenticatedFetch('/api/settings');
            if (intervalResponse && intervalResponse.ok) {
                const intervalResult = await intervalResponse.json();
                if (intervalResult.success && intervalResult.data) {
                        // Procurar pela configuração MONITORING_INTERVAL
                        const monitoringSetting = intervalResult.data.find(s => s.key === 'MONITORING_INTERVAL');
                        if (monitoringSetting) {
                            const intervalMs = parseInt(monitoringSetting.value);
                            let interval, unit;
                            
                            if (intervalMs >= 60000) { // 1 minuto ou mais
                                interval = Math.floor(intervalMs / 60000);
                                unit = 'minutes';
                            } else {
                                interval = Math.floor(intervalMs / 1000);
                                unit = 'seconds';
                            }
                            
                            document.getElementById('monitoringInterval').value = interval;
                            document.getElementById('monitoringUnit').value = unit;
                            updateMonitoringStatusDisplay(interval, unit);
                        } else {
                            // Usar valor padrão se não encontrar no banco
                            document.getElementById('monitoringInterval').value = 30;
                            document.getElementById('monitoringUnit').value = 'seconds';
                            updateMonitoringStatusDisplay(30, 'seconds');
                        }
                    } else {
                        // Usar valor padrão se não encontrar no banco
                        document.getElementById('monitoringInterval').value = 30;
                        document.getElementById('monitoringUnit').value = 'seconds';
                        updateMonitoringStatusDisplay(30, 'seconds');
                    }
                } else {
                    // Usar valor padrão se erro na requisição
                    document.getElementById('monitoringInterval').value = 30;
                    document.getElementById('monitoringUnit').value = 'seconds';
                    updateMonitoringStatusDisplay(30, 'seconds');
                }
            } catch (error) {
                console.log('Usando valor padrão para intervalo de monitoramento:', error.message);
                document.getElementById('monitoringInterval').value = 30;
                document.getElementById('monitoringUnit').value = 'seconds';
                updateMonitoringStatusDisplay(30, 'seconds');
            }
            
            // Atualizar estatísticas
            document.getElementById('configTotalAdded').textContent = config.currentStats.totalAdded;
            document.getElementById('configTotalProcessed').textContent = config.currentStats.totalProcessed;
            document.getElementById('configTotalRejected').textContent = config.currentStats.totalRejected;
            document.getElementById('configUtilization').textContent = `${config.currentUtilization}%`;
            
            // Atualizar status da fila
            updateQueueStatusDisplay(config.currentUtilization, config.currentStats.totalAdded, config.MAX_ORDERS);
            
            // Atualizar modo de processamento
            updateProcessingModeDisplay(config.CRON_SYNC);
            
            // Carregar informações do cron job
            await loadCronJobInfo();
        }
    } catch (error) {
        console.error('Erro ao carregar configurações:', error);
        showError('❌ Erro ao carregar configurações');
    }
}

// Atualizar display do status de monitoramento
function updateMonitoringStatusDisplay(interval, unit) {
    const statusInterval = document.getElementById('monitoringStatusInterval');
    if (statusInterval) {
        const unitText = unit === 'seconds' ? 'segundos' : 'minutos';
        statusInterval.textContent = `${interval} ${unitText}`;
    }
}

// Atualizar display do status da fila
function updateQueueStatusDisplay(utilization, current, max) {
    const queueFill = document.getElementById('queueStatusFill');
    const queueText = document.getElementById('queueStatusText');
    
    if (queueFill && queueText) {
        queueFill.style.width = `${utilization}%`;
        
        // Aplicar classe de cor baseada na utilização
        queueFill.className = 'queue-fill';
        if (utilization < 50) {
            queueFill.classList.add('low');
        } else if (utilization < 80) {
            queueFill.classList.add('medium');
        } else {
            queueFill.classList.add('high');
        }
        
        queueText.textContent = `${current}/${max} pedidos (${utilization}%)`;
    }
}

// Atualizar display do modo de processamento
function updateProcessingModeDisplay(cronSync) {
    const currentMode = document.getElementById('currentProcessingMode');
    const modeDescription = document.getElementById('processingModeDescription');
    
    if (currentMode && modeDescription) {
        if (cronSync) {
            currentMode.textContent = 'Cron Job';
            modeDescription.textContent = 'Processamento sincronizado com cron job para evitar conflitos';
        } else {
            currentMode.textContent = 'Imediato';
            modeDescription.textContent = 'Processamento imediato da fila quando há pedidos disponíveis';
        }
    }
}

// Salvar configurações de monitoramento
async function saveMonitoringConfig(event) {
    event.preventDefault();
    
    try {
        const maxOrders = parseInt(document.getElementById('maxOrders').value);
        const batchSize = parseInt(document.getElementById('batchSize').value);
        const batchDelay = parseInt(document.getElementById('batchDelay').value);
        const cronSync = document.getElementById('cronSync').value === 'true';
        const monitoringInterval = parseInt(document.getElementById('monitoringInterval').value);
        const monitoringUnit = document.getElementById('monitoringUnit').value;
        
        // Validar campos
        if (!maxOrders || !batchSize || !batchDelay || !monitoringInterval) {
            showError('Por favor, preencha todos os campos obrigatórios');
            return;
        }
        
        // Converter intervalo para milissegundos
        let intervalMs = monitoringInterval;
        if (monitoringUnit === 'minutes') {
            intervalMs = monitoringInterval * 60 * 1000;
        } else {
            intervalMs = monitoringInterval * 1000;
        }
        
        // Atualizar configurações da fila
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
            // Atualizar configuração do intervalo de monitoramento
            await updateSetting('MONITORING_INTERVAL', intervalMs.toString(), 
                `Intervalo de monitoramento: ${monitoringInterval} ${monitoringUnit}`);
            
            // Reconfigurar cron job para aplicar mudanças
            try {
                const cronResponse = await fetch('/api/cron/reconfigure', { method: 'POST' });
                if (cronResponse.ok) {
                    console.log('✅ Cron job reconfigurado com sucesso');
                }
            } catch (error) {
                console.log('⚠️ Erro ao reconfigurar cron job:', error.message);
            }
            
            showSuccess('✅ Configurações de monitoramento salvas com sucesso!');
            closeMonitoringConfigModal();
            
            // Recarregar configurações
            loadMonitoringConfig();
        } else {
            showError(`❌ Erro ao salvar: ${result.error}`);
        }
    } catch (error) {
        console.error('Erro ao salvar configurações:', error);
        showError('❌ Erro ao salvar configurações');
    }
}

// Restaurar configurações padrão
async function resetMonitoringConfig() {
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
            // Restaurar intervalo padrão (30 segundos)
            await updateSetting('MONITORING_INTERVAL', '30000', 'Intervalo padrão: 30 segundos');
            
            // Reconfigurar cron job para aplicar mudanças
            try {
                const cronResponse = await fetch('/api/cron/reconfigure', { method: 'POST' });
                if (cronResponse.ok) {
                    console.log('✅ Cron job reconfigurado com sucesso');
                }
            } catch (error) {
                console.log('⚠️ Erro ao reconfigurar cron job:', error.message);
            }
            
            // Atualizar display do intervalo
            document.getElementById('monitoringInterval').value = 30;
            document.getElementById('monitoringUnit').value = 'seconds';
            updateMonitoringStatusDisplay(30, 'seconds');
            
            showSuccess('🔄 Configurações restauradas para padrão');
            loadCurrentMonitoringConfig();
        } else {
            showError(`❌ Erro ao restaurar: ${result.error}`);
        }
    } catch (error) {
        console.error('Erro ao restaurar configurações:', error);
        showError('❌ Erro ao restaurar configurações');
    }
}

// Event listeners para configurações de monitoramento
document.addEventListener('DOMContentLoaded', function() {
    // Form de configurações de monitoramento
    const monitoringForm = document.getElementById('monitoringConfigForm');
    if (monitoringForm) {
        monitoringForm.addEventListener('submit', saveMonitoringConfig);
    }
    
    // Campos de intervalo de monitoramento
    const monitoringInterval = document.getElementById('monitoringInterval');
    const monitoringUnit = document.getElementById('monitoringUnit');
    
    if (monitoringInterval && monitoringUnit) {
        const updateInterval = () => {
            const interval = monitoringInterval.value;
            const unit = monitoringUnit.value;
            updateMonitoringStatusDisplay(interval, unit);
        };
        
        monitoringInterval.addEventListener('input', updateInterval);
        monitoringUnit.addEventListener('change', updateInterval);
    }
});

// Carregar informações do cron job
async function loadCronJobInfo() {
    try {
        // Carregar todas as configurações de uma vez
        const response = await authManager.authenticatedFetch('/api/settings');
        if (response && response.ok) {
            const result = await response.json();
            if (result.success && result.data) {
                // Procurar pela configuração CRON_PATTERN
                const patternSetting = result.data.find(s => s.key === 'CRON_PATTERN');
                if (patternSetting) {
                    document.getElementById('currentCronPattern').textContent = patternSetting.value;
                }
                
                // Procurar pela configuração CRON_TIMEZONE
                const timezoneSetting = result.data.find(s => s.key === 'CRON_TIMEZONE');
                if (timezoneSetting) {
                    document.getElementById('currentCronTimezone').textContent = timezoneSetting.value;
                }
                
                // Calcular próxima execução (aproximada)
                updateNextCronExecution();
            }
        }
        
    } catch (error) {
        console.log('Erro ao carregar informações do cron job:', error.message);
    }
}

// Atualizar próxima execução do cron
function updateNextCronExecution() {
    try {
        const pattern = document.getElementById('currentCronPattern').textContent;
        const timezone = document.getElementById('currentCronTimezone').textContent;
        
        if (pattern && pattern !== '*/5 * * * *') {
            // Cálculo aproximado para padrões simples
            let nextExecution = 'Calculando...';
            
            if (pattern.includes('*/')) {
                const interval = parseInt(pattern.split('*/')[1].split(' ')[0]);
                if (pattern.startsWith('*/')) {
                    // A cada X minutos
                    const now = new Date();
                    const next = new Date(now.getTime() + (interval * 60 * 1000));
                    nextExecution = next.toLocaleTimeString('pt-BR');
                } else if (pattern.startsWith('0 */')) {
                    // A cada X horas
                    const now = new Date();
                    const next = new Date(now.getTime() + (interval * 60 * 60 * 1000));
                    nextExecution = next.toLocaleTimeString('pt-BR');
                }
            }
            
            document.getElementById('nextCronExecution').textContent = nextExecution;
        } else {
            document.getElementById('nextCronExecution').textContent = 'A cada 5 minutos';
        }
    } catch (error) {
        document.getElementById('nextCronExecution').textContent = 'Erro no cálculo';
    }
}

// Fechar modal ao clicar fora dele
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
}

// ===== FUNÇÕES DE IMPORTAÇÃO DE RESTAURANTES =====

// Variáveis globais para importação
let selectedFile = null;
let importData = null;

// ===== FUNÇÕES DA ABA DE PERFIL =====

// Carregar dados do perfil
async function loadProfile() {
    try {
        // Carregar informações do usuário
        const username = authManager.getUsername();
        document.getElementById('userEmail').textContent = username || 'N/A';
        
        // Calcular tempo de sessão
        updateSessionStats();
        
    } catch (error) {
        console.error('Erro ao carregar perfil:', error);
        showError('Erro ao carregar dados do perfil');
    }
}

// Atualizar estatísticas da sessão
function updateSessionStats() {
    try {
        const token = authManager.getToken();
        if (token) {
            // Decodificar token para obter informações
            const payload = JSON.parse(atob(token.split('.')[1]));
            const now = Math.floor(Date.now() / 1000);
            const exp = payload.exp;
            
            // Calcular tempo restante
            const timeLeft = exp - now;
            if (timeLeft > 0) {
                const hours = Math.floor(timeLeft / 3600);
                const minutes = Math.floor((timeLeft % 3600) / 60);
                document.getElementById('tokenExpiry').textContent = `${hours}h ${minutes}m`;
            } else {
                document.getElementById('tokenExpiry').textContent = 'Expirado';
            }
            
            // Calcular tempo de sessão (aproximado)
            const sessionStart = payload.iat;
            const sessionDuration = now - sessionStart;
            const hours = Math.floor(sessionDuration / 3600);
            const minutes = Math.floor((sessionDuration % 3600) / 60);
            document.getElementById('sessionDuration').textContent = `${hours}h ${minutes}m`;
        }
    } catch (error) {
        console.error('Erro ao calcular estatísticas da sessão:', error);
        document.getElementById('sessionDuration').textContent = 'Erro';
        document.getElementById('tokenExpiry').textContent = 'Erro';
    }
}



// Manipular alteração de senha
async function handlePasswordChange(event) {
    event.preventDefault();
    
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    // Validações
    if (!currentPassword || !newPassword || !confirmPassword) {
        showError('❌ Por favor, preencha todos os campos.');
        return;
    }
    
    if (newPassword !== confirmPassword) {
        showError('❌ As senhas não coincidem.');
        return;
    }
    
    if (newPassword.length < 6) {
        showError('❌ A nova senha deve ter pelo menos 6 caracteres.');
        return;
    }
    
    try {
        const response = await authManager.authenticatedFetch('/api/auth/change-password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                currentPassword,
                newPassword
            })
        });
        
        if (!response) {
            return; // authManager já redirecionou para login
        }
        
        const result = await response.json();
        
        if (result.success) {
            showSuccess('✅ Senha alterada com sucesso!');
            resetPasswordForm();
        } else {
            showError(`❌ ${result.error}`);
        }
    } catch (error) {
        console.error('Erro ao alterar senha:', error);
        showError('❌ Erro de conexão. Tente novamente.');
    }
}

// Resetar formulário de senha
function resetPasswordForm() {
    const form = document.getElementById('changePasswordForm');
    if (form) {
        form.reset();
    }
}

// Mostrar modal de importação
function showImportModal() {
    const modal = document.getElementById('importModal');
    if (modal) {
        modal.style.display = 'block';
        setupFileUpload();
        resetImportModal();
    }
}

// Fechar modal de importação
function closeImportModal() {
    const modal = document.getElementById('importModal');
    if (modal) {
        modal.style.display = 'none';
        selectedFile = null;
        importData = null;
    }
}

// Configurar área de upload de arquivos
function setupFileUpload() {
    const fileUploadArea = document.getElementById('fileUploadArea');
    const fileInput = document.getElementById('fileInput');

    if (fileUploadArea && fileInput) {
        // Clique para selecionar arquivo
        fileUploadArea.addEventListener('click', () => fileInput.click());

        // Drag and drop
        fileUploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            fileUploadArea.classList.add('dragover');
        });

        fileUploadArea.addEventListener('dragleave', () => {
            fileUploadArea.classList.remove('dragover');
        });

        fileUploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            fileUploadArea.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                handleFileSelect(files[0]);
            }
        });

        // Seleção de arquivo via input
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handleFileSelect(e.target.files[0]);
            }
        });
    }
}

// Manipular seleção de arquivo
function handleFileSelect(file) {
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
        showError('❌ Por favor, selecione um arquivo Excel válido (.xlsx ou .xls)');
        return;
    }

    selectedFile = file;
    document.getElementById('fileName').textContent = file.name;
    document.getElementById('fileInfo').style.display = 'block';
    document.getElementById('previewBtn').disabled = false;
    document.getElementById('importBtn').disabled = false;

    // Ler arquivo Excel
    readExcelFile(file);
}

// Remover arquivo selecionado
function removeFile() {
    selectedFile = null;
    importData = null;
    document.getElementById('fileInfo').style.display = 'none';
    document.getElementById('previewBtn').disabled = true;
    document.getElementById('importBtn').disabled = true;
    document.getElementById('importPreview').style.display = 'none';
    document.getElementById('importProgress').style.display = 'none';
}

// Ler arquivo Excel
function readExcelFile(file) {
    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            // Arquivo carregado com sucesso
            console.log('Arquivo selecionado:', file.name);
            showSuccess('✅ Arquivo carregado com sucesso! Clique em "Prévia" para ver os dados.');
            
            // Simular dados carregados para habilitar prévia
            importData = {
                fileName: file.name,
                fileSize: file.size,
                loaded: true
            };
        } catch (error) {
            showError('❌ Erro ao ler arquivo Excel: ' + error.message);
        }
    };
    
    reader.readAsArrayBuffer(file);
}

// Fazer prévia da importação
function previewImport() {
    if (!selectedFile || !importData) {
        showError('❌ Nenhum arquivo selecionado ou dados não carregados');
        return;
    }

    const previewContent = document.getElementById('previewContent');
    const totalRecords = document.getElementById('totalRecords');
    
    // Simular dados de prévia baseados no arquivo
    const previewHtml = `
        <div style="margin-bottom: 10px;">
            <strong>Arquivo: ${selectedFile.name}</strong>
        </div>
        <div style="margin-bottom: 10px;">
            <strong>Estrutura esperada:</strong>
        </div>
        <div style="font-family: monospace; font-size: 0.9rem; background: #fff; padding: 10px; border-radius: 5px;">
            <div style="color: #666; margin-bottom: 5px;">Código | Nome | Descrição | Ativo</div>
            <div style="color: #333;">ARX | Restaurante ARX | Restaurante padrão ARX | Sim</div>
            <div style="color: #333;">BED | Belém Drive | - | Sim</div>
            <div style="color: #333;">PES | PES | - | Sim</div>
        </div>
        <div style="margin-top: 10px; font-size: 0.9rem; color: #666;">
            <strong>Nota:</strong> O arquivo será processado no servidor durante a importação.
        </div>
    `;
    
    previewContent.innerHTML = previewHtml;
    totalRecords.textContent = 'Processando...';
    document.getElementById('importPreview').style.display = 'block';
}

// Iniciar importação
async function startImport() {
    if (!selectedFile) {
        showError('❌ Nenhum arquivo selecionado');
        return;
    }

    const skipExisting = document.getElementById('skipExisting').checked;
    const updateExisting = document.getElementById('updateExisting').checked;

    try {
        // Mostrar progresso
        document.getElementById('importProgress').style.display = 'block';
        document.getElementById('importPreview').style.display = 'none';
        document.getElementById('importProgressText').textContent = 'Enviando arquivo...';
        
        // Preparar dados para envio
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('skipExisting', skipExisting);
        formData.append('updateExisting', updateExisting);
        
        // Fazer chamada para o servidor
        const response = await fetch('/api/restaurants/import', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Mostrar resultados da importação
            const results = result.results;
            const message = `✅ Importação concluída!\n\n` +
                          `📊 Total processado: ${results.total}\n` +
                          `🆕 Novos: ${results.imported}\n` +
                          `🔄 Atualizados: ${results.updated}\n` +
                          `⏭️ Ignorados: ${results.skipped}\n` +
                          `${results.errors.length > 0 ? `\n❌ Erros: ${results.errors.length}` : ''}`;
            
            if (results.errors.length > 0) {
                showError(`⚠️ Importação concluída com erros:\n\n${results.errors.slice(0, 5).join('\n')}${results.errors.length > 5 ? '\n...' : ''}`);
            } else {
                showSuccess(message);
            }
            
            closeImportModal();
            loadRestaurants(); // Recarregar lista
        } else {
            showError('❌ Erro na importação: ' + result.error);
        }
        
    } catch (error) {
        showError('❌ Erro na importação: ' + error.message);
    }
}



// Resetar modal de importação
function resetImportModal() {
    removeFile();
    document.getElementById('skipExisting').checked = true;
    document.getElementById('updateExisting').checked = true;
    document.getElementById('importPreview').style.display = 'none';
    document.getElementById('importProgress').style.display = 'none';
}

// Baixar modelo Excel
function downloadTemplate() {
    try {
        // Criar link para o arquivo Excel existente
        const link = document.createElement('a');
        link.href = '/lojas.xlsx';
        link.download = 'modelo_restaurantes.xlsx';
        link.style.visibility = 'hidden';
        
        // Adicionar ao DOM e clicar
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Notificar usuário
        showSuccess('📥 Modelo Excel baixado com sucesso! Use-o como base para sua planilha.');
        
    } catch (error) {
        console.error('Erro ao baixar modelo:', error);
        showError('❌ Erro ao baixar modelo Excel');
    }
}

// ===== FUNÇÕES DO SIDEBAR =====

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

// Função para fazer logout
function logout() {
    authManager.logout();
}

// Função para atualizar item ativo no sidebar
function updateSidebarActiveItem(tabName) {
    // Remover classe active de todos os itens
    document.querySelectorAll('.sidebar-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Adicionar classe active ao item correspondente
    const activeItem = document.querySelector(`[onclick="showTab('${tabName}')"]`);
    if (activeItem) {
        activeItem.classList.add('active');
    }
}
