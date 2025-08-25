const jwt = require('jsonwebtoken');

// Chave secreta para JWT (em produção, deve estar em variável de ambiente)
const JWT_SECRET = process.env.JWT_SECRET || 'pedidoreadybot-secret-key-2025';

// Middleware para verificar token JWT
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({
            success: false,
            error: 'Token de acesso não fornecido',
            redirect: '/login'
        });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({
                success: false,
                error: 'Token inválido ou expirado',
                redirect: '/login'
            });
        }

        req.user = user;
        next();
    });
}

// Middleware para verificar se é admin
function requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            error: 'Acesso negado. Apenas administradores.'
        });
    }
    next();
}

module.exports = {
    authenticateToken,
    requireAdmin,
    JWT_SECRET
};
