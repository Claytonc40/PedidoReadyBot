// Verificar se já está logado
document.addEventListener('DOMContentLoaded', function() {
    // Inicializar o sistema de autenticação
    authManager.init();
});

// Função para alternar visibilidade da senha
function togglePassword() {
    const passwordInput = document.getElementById('password');
    const toggleBtn = document.querySelector('.toggle-password');
    
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        toggleBtn.textContent = '🙈';
    } else {
        passwordInput.type = 'password';
        toggleBtn.textContent = '👁️';
    }
}

// Função para mostrar mensagens
function showMessage(message, type) {
    const errorDiv = document.getElementById('errorMessage');
    const successDiv = document.getElementById('successMessage');
    
    // Limpar mensagens anteriores
    errorDiv.style.display = 'none';
    successDiv.style.display = 'none';
    
    if (type === 'error') {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
    } else if (type === 'success') {
        successDiv.textContent = message;
        successDiv.style.display = 'block';
    }
}

// Função para mostrar/ocultar loading
function setLoading(show) {
    const loginForm = document.getElementById('loginForm');
    const loading = document.getElementById('loading');
    const loginBtn = document.getElementById('loginBtn');
    
    if (show) {
        loginForm.style.display = 'none';
        loading.style.display = 'block';
        loginBtn.disabled = true;
    } else {
        loginForm.style.display = 'block';
        loading.style.display = 'none';
        loginBtn.disabled = false;
    }
}

// Função para fazer login
async function performLogin(username, password) {
    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Login bem-sucedido
            authManager.saveAuth(result.token, username);
            
            showMessage('✅ Login realizado com sucesso! Redirecionando...', 'success');
            
            // Redirecionar para dashboard após 1 segundo
            setTimeout(() => {
                authManager.redirectToDashboard();
            }, 1000);
        } else {
            // Login falhou
            showMessage(`❌ ${result.error}`, 'error');
            setLoading(false);
        }
    } catch (error) {
        console.error('Erro no login:', error);
        showMessage('❌ Erro de conexão. Tente novamente.', 'error');
        setLoading(false);
    }
}

// Event listener para o formulário de login
document.getElementById('loginForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    
    // Validações básicas
    if (!username) {
        showMessage('❌ Por favor, digite o email.', 'error');
        return;
    }
    
    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(username)) {
        showMessage('❌ Por favor, digite um email válido.', 'error');
        return;
    }
    
    if (!password) {
        showMessage('❌ Por favor, digite a senha.', 'error');
        return;
    }
    
    // Mostrar loading e fazer login
    setLoading(true);
    await performLogin(username, password);
});

// Funções de alterar senha movidas para dentro da aplicação

// Prevenir envio do formulário ao pressionar Enter
document.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
    }
});
