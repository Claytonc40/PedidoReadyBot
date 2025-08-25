const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const databaseService = require('./databaseService');
const { JWT_SECRET } = require('../middleware/auth');

class AuthService {
    constructor() {
        this.saltRounds = 12; // Para hash de senha
    }

    // Função para fazer hash de uma senha
    async hashPassword(password) {
        return await bcrypt.hash(password, this.saltRounds);
    }

    // Função para verificar se uma senha está correta
    async verifyPassword(password, hashedPassword) {
        return await bcrypt.compare(password, hashedPassword);
    }

    // Função para fazer login
    async login(username, password) {
        try {
            // Buscar credenciais do banco
            const storedUsername = databaseService.getSetting('ADMIN_USERNAME');
            const storedPassword = databaseService.getSetting('ADMIN_PASSWORD');

            // Verificar se o usuário existe
            if (!storedUsername || !storedPassword) {
                throw new Error('Credenciais não configuradas no sistema');
            }

            // Verificar username (email)
            if (username !== storedUsername) {
                throw new Error('Email ou senha incorretos');
            }

            // Verificar senha
            const isPasswordValid = await this.verifyPassword(password, storedPassword);
            if (!isPasswordValid) {
                throw new Error('Email ou senha incorretos');
            }

            // Gerar token JWT
            const token = jwt.sign(
                { 
                    username: username, 
                    role: 'admin',
                    iat: Math.floor(Date.now() / 1000),
                    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 horas
                },
                JWT_SECRET
            );

            return {
                success: true,
                token: token,
                user: {
                    username: username,
                    role: 'admin'
                }
            };

        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Função para verificar token
    async verifyToken(token) {
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            return {
                success: true,
                user: decoded
            };
        } catch (error) {
            return {
                success: false,
                error: 'Token inválido'
            };
        }
    }

    // Função para alterar senha
    async changePassword(currentPassword, newPassword) {
        try {
            // Verificar senha atual
            const storedPassword = databaseService.getSetting('ADMIN_PASSWORD');
            if (!storedPassword) {
                throw new Error('Senha atual não configurada no sistema');
            }

            const isCurrentPasswordValid = await this.verifyPassword(currentPassword, storedPassword);
            if (!isCurrentPasswordValid) {
                throw new Error('Senha atual incorreta');
            }

            // Validar nova senha
            if (newPassword.length < 6) {
                throw new Error('A nova senha deve ter pelo menos 6 caracteres');
            }

            // Fazer hash da nova senha
            const newHashedPassword = await this.hashPassword(newPassword);

            // Atualizar senha no banco
            databaseService.updateSetting('ADMIN_PASSWORD', newHashedPassword, 'Senha do administrador (hash bcrypt)');

            return {
                success: true,
                message: 'Senha alterada com sucesso'
            };

        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Função para inicializar senha padrão se não existir
    async initializeDefaultPassword() {
        try {
            const storedUsername = databaseService.getSetting('ADMIN_USERNAME');
            const storedPassword = databaseService.getSetting('ADMIN_PASSWORD');
            
            // Atualizar username para o novo padrão se necessário
            if (!storedUsername || storedUsername !== 'auditoria@br.mcd.com') {
                databaseService.updateSetting('ADMIN_USERNAME', 'auditoria@br.mcd.com', 'Email do usuário administrador');
                console.log('✅ Username atualizado para auditoria@br.mcd.com');
            }
            
            // Se a senha não existir ou for a senha padrão não hasheada
            if (!storedPassword || storedPassword === 'Arcos@22') {
                const hashedPassword = await this.hashPassword('Arcos@22');
                databaseService.updateSetting('ADMIN_PASSWORD', hashedPassword, 'Senha do administrador (hash bcrypt)');
                console.log('✅ Senha padrão inicializada com hash bcrypt');
            }
        } catch (error) {
            console.error('❌ Erro ao inicializar senha padrão:', error.message);
        }
    }
}

module.exports = new AuthService();
