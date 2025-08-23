// Variáveis globais
let currentRestaurantId = null;
let currentAreaId = null;

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
        case 'settings':
            loadSettings();
            break;
    }
}

// Funções para estatísticas
async function loadStats() {
    try {
        const response = await fetch('/api/database/stats');
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
        const response = await fetch('/api/restaurants');
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
        const response = await fetch('/api/areas');
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
        const response = await fetch('/api/settings');
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

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Carregar dados iniciais
    loadStats();
    
    // Configurar formulários
    document.getElementById('restaurantForm').addEventListener('submit', saveRestaurant);
    document.getElementById('areaForm').addEventListener('submit', saveArea);
    document.getElementById('cronForm').addEventListener('submit', saveCronConfig);
    
    // Fechar modais ao clicar fora
    window.addEventListener('click', function(event) {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = 'none';
        }
    });
});

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
