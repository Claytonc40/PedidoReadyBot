// Utilitário de autenticação para o PedidoReadyBot
class AuthManager {
    constructor() {
        this.tokenKey = 'authToken';
        this.usernameKey = 'username';
        this.loginUrl = '/login';
        this.dashboardUrl = '/';
    }

    // Verificar se o usuário está autenticado
    isAuthenticated() {
        const token = this.getToken();
        return token && token !== 'null' && token !== 'undefined';
    }

    // Obter token do localStorage
    getToken() {
        return localStorage.getItem(this.tokenKey);
    }

    // Obter username do localStorage
    getUsername() {
        return localStorage.getItem(this.usernameKey);
    }

    // Salvar dados de autenticação
    saveAuth(token, username) {
        localStorage.setItem(this.tokenKey, token);
        localStorage.setItem(this.usernameKey, username);
    }

    // Limpar dados de autenticação
    clearAuth() {
        localStorage.removeItem(this.tokenKey);
        localStorage.removeItem(this.usernameKey);
    }

    // Verificar se o token ainda é válido
    async verifyToken() {
        try {
            const token = this.getToken();
            if (!token) {
                return false;
            }

            const response = await fetch('/api/auth/verify', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                this.clearAuth();
                return false;
            }

            return true;
        } catch (error) {
            console.error('Erro ao verificar token:', error);
            this.clearAuth();
            return false;
        }
    }

    // Redirecionar para login
    redirectToLogin() {
        this.clearAuth();
        window.location.href = this.loginUrl;
    }

    // Redirecionar para dashboard
    redirectToDashboard() {
        window.location.href = this.dashboardUrl;
    }

    // Verificar autenticação e redirecionar se necessário
    async checkAuthAndRedirect() {
        if (!this.isAuthenticated()) {
            this.redirectToLogin();
            return false;
        }

        const isValid = await this.verifyToken();
        if (!isValid) {
            this.redirectToLogin();
            return false;
        }

        return true;
    }

    // Função para fazer requisições autenticadas
    async authenticatedFetch(url, options = {}) {
        const token = this.getToken();
        
        if (!token) {
            this.redirectToLogin();
            return null;
        }

        const authOptions = {
            ...options,
            headers: {
                ...options.headers,
                'Authorization': `Bearer ${token}`
            }
        };

        try {
            const response = await fetch(url, authOptions);
            
            // Se a resposta for 401 ou 403, redirecionar para login
            if (response.status === 401 || response.status === 403) {
                const errorData = await response.json();
                console.warn('Erro de autenticação:', errorData.error);
                this.redirectToLogin();
                return null;
            }

            return response;
        } catch (error) {
            console.error('Erro na requisição autenticada:', error);
            return null;
        }
    }

    // Função para fazer logout
    logout() {
        if (confirm('Tem certeza que deseja sair do sistema?')) {
            this.clearAuth();
            window.location.href = this.loginUrl;
        }
    }

    // Função para verificar se está na página de login
    isOnLoginPage() {
        return window.location.pathname === this.loginUrl;
    }

    // Função para verificar se está na página de dashboard
    isOnDashboardPage() {
        return window.location.pathname === this.dashboardUrl;
    }

    // Função para verificar se está na página de admin
    isOnAdminPage() {
        return window.location.pathname === '/admin';
    }

    // Função para inicializar verificação de autenticação
    async init() {
        // Se estiver na página de login, verificar se já está logado
        if (this.isOnLoginPage()) {
            if (this.isAuthenticated()) {
                const isValid = await this.verifyToken();
                if (isValid) {
                    this.redirectToDashboard();
                    return;
                }
            }
            return;
        }

        // Se estiver em página protegida, verificar autenticação
        if (this.isOnDashboardPage() || this.isOnAdminPage()) {
            await this.checkAuthAndRedirect();
        }
    }
}

// Criar instância global
const authManager = new AuthManager();

// Função global para logout (para uso em onclick)
function logout() {
    authManager.logout();
}

// Função global para verificar autenticação
function checkAuth() {
    return authManager.checkAuthAndRedirect();
}

// Exportar para uso em outros módulos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AuthManager;
}
