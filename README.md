# PedidoReadyBot 🚀

Bot automatizado para processar pedidos usando Express.js e cron jobs. A aplicação executa em background e processa pedidos automaticamente em intervalos configuráveis.

## ✨ Funcionalidades

- 🔐 Autenticação automática com JWT
- 📋 Busca automática de pedidos pendentes
- ⚡ Processamento automático com ação FULL_READY
- ⏰ Agendamento configurável com cron jobs
- 🌐 API REST para controle manual
- 📊 Monitoramento e estatísticas em tempo real
- 🛡️ Middleware de segurança (Helmet, CORS)
- 📝 Logs detalhados com Morgan

## 🚀 Instalação

1. **Clone o repositório:**
```bash
git clone <seu-repositorio>
cd PedidoReadyBot
```

2. **Instale as dependências:**
```bash
npm install
```

3. **Configure o token JWT:**
```bash
# Obter token automaticamente
npm run get-token

# OU configure manualmente no arquivo config.env
JWT_TOKEN=seu_token_jwt_aqui
```

## 🎯 Como usar

### Desenvolvimento (com nodemon)
```bash
npm run dev
```

**Nota:** Se você encontrar o erro "nodemon não é reconhecido", use:
```bash
npx nodemon server.js
```

### Produção
```bash
npm start
```

### Processamento manual via API
```bash
# Processar pedidos manualmente
curl -X POST http://localhost:3001/process-orders

# Verificar status
curl http://localhost:3001/status

# Verificar saúde da aplicação
curl http://localhost:3001/health
```

## 📅 Configuração do Cron

A aplicação vem configurada para executar automaticamente usando as configurações do arquivo `config.env`:

- **Padrão padrão**: A cada 5 minutos (`*/5 * * * *`)
- **Timezone**: America/Sao_Paulo

### Personalizar agendamento

Edite o arquivo `config.env`:

```bash
# Executar a cada 10 minutos
CRON_PATTERN=*/10 * * * *

# Executar a cada 2 horas
CRON_PATTERN=0 */2 * * *

# Executar diariamente à meia-noite
CRON_PATTERN=0 0 * * *

# Executar apenas em horário comercial (8h-18h, seg-sex)
CRON_PATTERN=0 8-18 * * 1-5

# Timezone personalizado
CRON_TIMEZONE=America/New_York
```

**💡 Dica:** Veja os arquivos `cron-examples.env` e `stores-examples.env` para mais exemplos de configurações.

## 🌐 Endpoints da API

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/` | Informações da API |
| GET | `/health` | Status de saúde |
| GET | `/status` | Status do processamento |
| GET | `/checkpoint` | Status do sistema de checkpoint |
| GET | `/dashboard` | Dashboard web de monitoramento |
| GET | `/dashboard-data` | Dados JSON para o dashboard |
| GET | `/admin` | Painel de administração |
| POST | `/process-orders` | Processar pedidos manualmente |

### 🔧 APIs de Administração

#### Restaurantes
- `GET /api/restaurants` - Listar todos os restaurantes
- `GET /api/restaurants/:id` - Obter restaurante por ID
- `POST /api/restaurants` - Adicionar novo restaurante
- `PUT /api/restaurants/:id` - Atualizar restaurante
- `DELETE /api/restaurants/:id` - Deletar restaurante

#### Áreas de Processamento
- `GET /api/areas` - Listar todas as áreas
- `GET /api/areas/:id` - Obter área por ID
- `POST /api/areas` - Adicionar nova área
- `PUT /api/areas/:id` - Atualizar área
- `DELETE /api/areas/:id` - Deletar área

#### Configurações
- `GET /api/settings` - Listar todas as configurações
- `PUT /api/settings/:key` - Atualizar configuração

#### Estatísticas
- `GET /api/database/stats` - Estatísticas do banco de dados

## 📊 Monitoramento

A aplicação mantém estatísticas globais:

- `lastProcessed`: Última execução
- `totalProcessed`: Total de pedidos processados
- `totalStores`: Total de restaurantes configurados
- `successfulStores`: Restaurantes com sucesso na última execução
- `failedStores`: Restaurantes com falha na última execução
- `uptime`: Tempo de execução

### 🗄️ Estatísticas do Banco de Dados

O sistema também fornece estatísticas em tempo real do banco de dados:

- **Total de restaurantes**: Contagem de todos os restaurantes cadastrados
- **Restaurantes ativos**: Contagem de restaurantes atualmente ativos
- **Total de áreas**: Contagem de todas as áreas de processamento
- **Áreas ativas**: Contagem de áreas atualmente ativas

**Endpoint**: `GET /api/database/stats`

**Interface**: Disponível na aba "Visão Geral" do painel de administração (`/admin`)

## 🖥️ Dashboard Web

A aplicação inclui um dashboard web moderno e responsivo para monitoramento em tempo real:

- **URL**: `http://localhost:3001/dashboard`
- **Funcionalidades**: Métricas visuais, estatísticas por restaurante, atualização automática
- **Responsivo**: Funciona em desktop e dispositivos móveis
- **Tempo Real**: Dados atualizados automaticamente a cada 30 segundos

### ⚙️ Painel de Administração

A aplicação também inclui um painel de administração completo para gerenciar configurações:

- **URL**: `http://localhost:3001/admin`
- **Funcionalidades**: 
  - Gerenciar restaurantes (adicionar, editar, remover, ativar/desativar)
  - Gerenciar áreas de processamento (adicionar, editar, remover, ativar/desativar)
  - Configurar parâmetros do sistema (cron, timezone, token JWT)
  - Estatísticas em tempo real do banco de dados
- **Interface**: Interface web moderna com modais, tabelas e formulários
- **Banco de Dados**: SQLite local para persistência das configurações

### 📊 Métricas Exibidas
- Total de sucessos e erros
- Taxa de sucesso com barra de progresso
- Performance e tempos de execução
- Status do sistema de checkpoint
- Resumo detalhado por restaurante

Para mais detalhes, consulte o arquivo `DASHBOARD.md`.

## 🏪 Sistema de Múltiplos Restaurantes

O sistema agora suporta busca de pedidos de múltiplos restaurantes simultaneamente:

- **Configuração**: Gerencie restaurantes através do painel de administração (`/admin`)
- **Processamento paralelo**: Cada restaurante é consultado sequencialmente com delay de 100ms
- **Consolidação**: Todos os pedidos são consolidados em uma única lista para processamento
- **Checkpoint único**: O checkpoint mais recente é usado para a próxima execução
- **Monitoramento**: Estatísticas por restaurante são mantidas e exibidas nos endpoints
- **Persistência**: Configurações salvas em banco de dados SQLite local

### Gerenciamento via Painel Web:
1. Acesse `http://localhost:3001/admin`
2. Vá para a aba "Restaurantes"
3. Adicione, edite ou remova restaurantes conforme necessário
4. Ative/desative restaurantes individualmente
5. As mudanças são aplicadas automaticamente

### Exemplo de configuração via banco de dados:
```sql
-- Restaurantes ativos
INSERT INTO restaurants (code, name, description, active) VALUES 
('BED', 'Restaurante BED', 'Restaurante principal', 1),
('ARX', 'Restaurante ARX', 'Restaurante secundário', 1),
('MCC', 'McDonald\'s', 'McDonald\'s local', 1);

-- Áreas de processamento
INSERT INTO processing_areas (code, name, description, active) VALUES 
('MCC', 'McDonald\'s', 'Área McDonald\'s', 1),
('CDP', 'Cardápio Digital', 'Área de Cardápio Digital', 1),
('CHK', 'Checkout', 'Área de Checkout', 1);
```

## 🔄 Sistema de Checkpoint

O sistema de checkpoint garante que apenas pedidos novos sejam processados:

- **Funcionamento**: A API retorna um timestamp (`checkpoint`) que é usado na próxima requisição
- **Persistência**: O checkpoint é mantido em memória durante a execução da aplicação
- **Inicialização**: Na primeira execução, usa o timestamp atual
- **Endpoint**: `/checkpoint` mostra o status atual do sistema

### Como funciona:
1. Primeira execução: usa timestamp atual
2. API retorna novos pedidos + novo checkpoint
3. Próxima execução: usa o checkpoint anterior
4. Apenas pedidos criados após o checkpoint são processados

### Exemplo de uso:
```bash
# Verificar checkpoint atual
curl http://localhost:3001/checkpoint

# Processar pedidos (usa checkpoint automático)
curl -X POST http://localhost:3001/process-orders
```

## 🛠️ Estrutura do Projeto

```
PedidoReadyBot/
├── server.js              # Servidor Express principal
├── services/
│   ├── orderService.js    # Lógica de processamento
│   └── databaseService.js # Serviço de banco de dados SQLite
├── public/
│   ├── index.html         # Dashboard web (HTML)
│   ├── dashboard.js       # Dashboard web (JavaScript)
│   ├── admin.html         # Painel de administração (HTML)
│   └── admin.js           # Painel de administração (JavaScript)
├── data/                  # Diretório do banco de dados SQLite
├── config.env             # Configurações de ambiente e cron
├── cron-examples.env      # Exemplos de configurações de cron
├── stores-examples.env    # Exemplos de configurações de restaurantes
├── package.json
├── README.md
├── DASHBOARD.md           # Documentação do dashboard
└── DATABASE.md            # Documentação do sistema de banco de dados
```

## 🔧 Configurações

### Variáveis de ambiente

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| PORT | 3001 | Porta do servidor |
| NODE_ENV | development | Ambiente de execução |

### Configurações via Banco de Dados

As seguintes configurações agora são gerenciadas através do painel de administração (`/admin`):

| Configuração | Padrão | Descrição |
|--------------|--------|-----------|
| CRON_PATTERN | `*/5 * * * *` | Padrão do cron (a cada 5 minutos) |
| CRON_TIMEZONE | `America/Sao_Paulo` | Timezone para execução do cron |
| JWT_TOKEN | `seu_token_jwt_aqui` | Token JWT para autenticação com a API |
| Restaurantes | `BED, ARX` | Lista de restaurantes para buscar pedidos |
| Áreas | `MCC, CDP, CHK, BKF, DLV` | Áreas de processamento disponíveis |

### Padrões Cron Comuns

| Padrão | Descrição |
|--------|-----------|
| `*/5 * * * *` | A cada 5 minutos |
| `*/1 * * * *` | A cada 1 minuto |
| `0 */2 * * *` | A cada 2 horas |
| `0 0 * * *` | Diariamente à meia-noite |
| `0 8-18 * * 1-5` | Horário comercial (8h-18h, seg-sex) |
| `0 9-17 * * 1-5` | Horário comercial (9h-17h, seg-sex) |

## 🚨 Tratamento de Erros

- Logs detalhados de todas as operações
- Tratamento de erros de rede e API
- Continuação do processamento mesmo com falhas individuais
- Estatísticas de sucesso e erro

## 📝 Logs

A aplicação usa Morgan para logging HTTP e console.log para operações de negócio:

- 🚀 Inicialização do servidor
- 🔄 Início do processamento
- ✅ Sucessos de operações
- ❌ Erros e falhas
- 📊 Estatísticas de execução

## 🔒 Segurança

- Helmet para headers de segurança
- CORS configurado
- Validação de entrada
- Tratamento de erros não capturados

## 🚀 Deploy

### Docker (recomendado)
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3001
CMD ["npm", "start"]
```

### PM2
```bash
npm install -g pm2
pm2 start server.js --name "pedido-ready-bot"
pm2 startup
pm2 save
```

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature
3. Commit suas mudanças
4. Push para a branch
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo `LICENSE` para mais detalhes.

## 🆘 Suporte

Para suporte ou dúvidas, abra uma issue no repositório ou entre em contato com a equipe de desenvolvimento.

## 🔐 Configuração do Token JWT

### Obter Token Automaticamente
```bash
npm run get-token
```

Este comando irá:
1. Fazer login na API automaticamente
2. Obter o token JWT
3. Atualizar o arquivo `config.env` com o token

### Configurar Token Manualmente
1. Edite o arquivo `config.env`
2. Substitua `JWT_TOKEN=seu_token_jwt_aqui` pelo seu token real
3. Salve o arquivo

### Renovar Token
Se o token expirar, execute novamente:
```bash
npm run get-token
```

## 🔧 Troubleshooting

### Erro: "nodemon não é reconhecido"
```bash
# Solução 1: Instalar globalmente
npm install -g nodemon

# Solução 2: Usar npx
npx nodemon server.js

# Solução 3: Usar o script npm
npm run dev
```

### Erro 401 (Não Autorizado)
- O token JWT pode ter expirado
- Acesse o painel de administração (`/admin`) e atualize o token JWT
- Verifique se a configuração está ativa no banco de dados
- A aplicação agora usa token do banco de dados SQLite

### Erro de Porta em Uso
- A aplicação usa a porta 3001 por padrão
- Se a porta estiver ocupada, configure outra porta via variável de ambiente:
```bash
PORT=3002 npm start
```

### Testar a API
```bash
# Executar testes automatizados
node test-api.js
```

---

**Desenvolvido com ❤️ para automatizar o processamento de pedidos**
