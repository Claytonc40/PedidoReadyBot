# 🗄️ Sistema de Banco de Dados - PedidoReadyBot

Sistema de banco de dados local SQLite para gerenciar configurações de restaurantes, áreas de processamento e parâmetros do sistema.

## 🚀 Visão Geral

O PedidoReadyBot agora utiliza um banco de dados SQLite local para persistir todas as configurações, substituindo as variáveis de ambiente estáticas. Isso permite:

- **Gerenciamento dinâmico** de restaurantes e áreas
- **Interface web** para administração
- **Persistência** de configurações entre reinicializações
- **Flexibilidade** para adicionar/remover recursos sem editar arquivos

## 🏗️ Arquitetura

### Tecnologias
- **SQLite3**: Banco de dados local leve e rápido
- **Better-SQLite3**: Driver Node.js otimizado para SQLite
- **Arquitetura Singleton**: Uma única instância do serviço de banco

### Estrutura de Arquivos
```
PedidoReadyBot/
├── services/
│   └── databaseService.js    # Serviço principal do banco
├── data/
│   └── pedidoreadybot.db     # Arquivo do banco SQLite
└── public/
    ├── admin.html             # Interface de administração
    └── admin.js               # Lógica da interface
```

## 📊 Esquema do Banco

### Tabela: `restaurants`
Gerencia os restaurantes disponíveis para busca de pedidos.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | INTEGER | Chave primária auto-incrementada |
| `code` | TEXT | Código único do restaurante (ex: BED, ARX) |
| `name` | TEXT | Nome descritivo do restaurante |
| `description` | TEXT | Descrição opcional |
| `active` | BOOLEAN | Status ativo/inativo (1/0) |
| `created_at` | DATETIME | Data de criação |
| `updated_at` | DATETIME | Data da última atualização |

### Tabela: `processing_areas`
Gerencia as áreas de processamento disponíveis.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | INTEGER | Chave primária auto-incrementada |
| `code` | TEXT | Código único da área (ex: MCC, CDP) |
| `name` | TEXT | Nome descritivo da área |
| `description` | TEXT | Descrição opcional |
| `active` | BOOLEAN | Status ativo/inativo (1/0) |
| `created_at` | DATETIME | Data de criação |
| `updated_at` | DATETIME | Data da última atualização |

### Tabela: `settings`
Gerencia as configurações gerais do sistema.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | INTEGER | Chave primária auto-incrementada |
| `key` | TEXT | Chave da configuração (ex: CRON_PATTERN) |
| `value` | TEXT | Valor da configuração |
| `description` | TEXT | Descrição da configuração |
| `updated_at` | DATETIME | Data da última atualização |

## 🔧 Serviço de Banco de Dados

### Classe: `DatabaseService`

#### Métodos Principais

##### Restaurantes
- `getAllRestaurants()` - Lista todos os restaurantes
- `getActiveRestaurants()` - Lista apenas restaurantes ativos
- `getRestaurantByCode(code)` - Busca restaurante por código
- `addRestaurant(code, name, description)` - Adiciona novo restaurante
- `updateRestaurant(id, code, name, description, active)` - Atualiza restaurante
- `deleteRestaurant(id)` - Remove restaurante

##### Áreas de Processamento
- `getAllAreas()` - Lista todas as áreas
- `getActiveAreas()` - Lista apenas áreas ativas
- `getAreaByCode(code)` - Busca área por código
- `addArea(code, name, description)` - Adiciona nova área
- `updateArea(id, code, name, description, active)` - Atualiza área
- `deleteArea(id)` - Remove área

##### Configurações
- `getAllSettings()` - Lista todas as configurações
- `getSetting(key)` - Obtém valor de uma configuração
- `updateSetting(key, value, description)` - Atualiza configuração

##### Métodos de Compatibilidade
- `getStoresString()` - Retorna string de restaurantes ativos (formato: "BED,ARX")
- `getAreasString()` - Retorna string de áreas ativas (formato: "MCC,CDP,CHK")

##### Estatísticas
- `getDatabaseStats()` - Retorna estatísticas gerais do banco

## 🌐 APIs REST

### Endpoints de Restaurantes

#### `GET /api/restaurants`
Lista todos os restaurantes.

**Resposta:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "code": "BED",
      "name": "Restaurante BED",
      "description": "Restaurante principal",
      "active": 1,
      "created_at": "2025-01-23T00:00:00.000Z",
      "updated_at": "2025-01-23T00:00:00.000Z"
    }
  ]
}
```

#### `POST /api/restaurants`
Adiciona novo restaurante.

**Corpo da requisição:**
```json
{
  "code": "MCC",
  "name": "McDonald's",
  "description": "McDonald's local"
}
```

#### `PUT /api/restaurants/:id`
Atualiza restaurante existente.

**Corpo da requisição:**
```json
{
  "code": "MCC",
  "name": "McDonald's Atualizado",
  "description": "Nova descrição",
  "active": true
}
```

#### `DELETE /api/restaurants/:id`
Remove restaurante.

### Endpoints de Áreas

#### `GET /api/areas`
Lista todas as áreas de processamento.

#### `POST /api/areas`
Adiciona nova área.

#### `PUT /api/areas/:id`
Atualiza área existente.

#### `DELETE /api/areas/:id`
Remove área.

### Endpoints de Configurações

#### `GET /api/settings`
Lista todas as configurações.

#### `PUT /api/settings/:key`
Atualiza configuração específica.

### Endpoints de Estatísticas

#### `GET /api/database/stats`
Retorna estatísticas do banco de dados.

**Resposta:**
```json
{
  "success": true,
  "data": {
    "totalRestaurants": 3,
    "totalAreas": 5,
    "activeRestaurants": 2,
    "activeAreas": 4
  }
}
```

## 🖥️ Interface de Administração

### Acesso
- **URL**: `http://localhost:3001/admin`
- **Funcionalidade**: Interface web completa para gerenciar o banco

### Abas Disponíveis

#### 📊 Visão Geral
- Estatísticas em tempo real
- Contadores de restaurantes e áreas
- Status ativo/inativo

#### 🏪 Restaurantes
- Lista todos os restaurantes
- Adicionar novos restaurantes
- Editar restaurantes existentes
- Ativar/desativar restaurantes
- Remover restaurantes

#### 🔧 Áreas
- Lista todas as áreas
- Adicionar novas áreas
- Editar áreas existentes
- Ativar/desativar áreas
- Remover áreas

#### ⚙️ Configurações
- Lista todas as configurações
- Editar valores e descrições
- Configurações do cron
- Token JWT

## 🔄 Migração do Sistema Anterior

### O que Mudou
1. **Variáveis de ambiente** → **Banco de dados SQLite**
2. **Arquivo config.env** → **Painel web de administração**
3. **Configuração estática** → **Configuração dinâmica**

### Compatibilidade
- O sistema mantém compatibilidade com o código existente
- Métodos `getStoresString()` e `getAreasString()` retornam o mesmo formato
- Todas as funcionalidades existentes continuam funcionando

### Dados Padrão
Na primeira execução, o sistema cria automaticamente:

#### Restaurantes Padrão
- `BED` - Restaurante BED
- `ARX` - Restaurante ARX

#### Áreas Padrão
- `MCC` - McDonald's
- `CDP` - Cardápio Digital
- `CHK` - Checkout
- `BKF` - Breakfast
- `DLV` - Delivery

#### Configurações Padrão
- `CRON_PATTERN` - `*/5 * * * *`
- `CRON_TIMEZONE` - `America/Sao_Paulo`
- `JWT_TOKEN` - `seu_token_jwt_aqui`

## 🚀 Como Usar

### 1. Primeira Execução
```bash
# O banco é criado automaticamente
npm start
```

### 2. Acessar Painel de Administração
```
http://localhost:3001/admin
```

### 3. Configurar Token JWT
1. Vá para a aba "Configurações"
2. Clique em editar na linha "JWT_TOKEN"
3. Insira seu token real
4. Salve a configuração

### 4. Gerenciar Restaurantes
1. Vá para a aba "Restaurantes"
2. Clique em "Adicionar Restaurante"
3. Preencha código, nome e descrição
4. Salve

### 5. Gerenciar Áreas
1. Vá para a aba "Áreas"
2. Clique em "Adicionar Área"
3. Preencha código, nome e descrição
4. Salve

## 🔍 Troubleshooting

### Banco não é criado
- Verifique permissões de escrita no diretório
- Verifique se o SQLite3 está instalado
- Verifique logs do servidor

### Erro de conexão
- Verifique se o arquivo do banco existe em `data/pedidoreadybot.db`
- Verifique se o servidor está rodando
- Verifique permissões do arquivo

### Configurações não são aplicadas
- Verifique se as configurações estão ativas (active = 1)
- Reinicie o servidor após mudanças críticas
- Verifique logs do servidor

### Interface não carrega
- Verifique se a rota `/admin` está funcionando
- Verifique console do navegador para erros
- Verifique se os arquivos HTML/JS estão na pasta `public`

## 📝 Exemplos de Uso

### Adicionar Restaurante via API
```bash
curl -X POST http://localhost:3001/api/restaurants \
  -H "Content-Type: application/json" \
  -d '{
    "code": "MCC",
    "name": "McDonald's",
    "description": "McDonald's local"
  }'
```

### Atualizar Configuração via API
```bash
curl -X PUT http://localhost:3001/api/settings/CRON_PATTERN \
  -H "Content-Type: application/json" \
  -d '{
    "value": "*/10 * * * *",
    "description": "Executar a cada 10 minutos"
  }'
```

### Obter Estatísticas via API
```bash
curl http://localhost:3001/api/database/stats
```

## 🌟 Recursos Avançados

### Validações
- Códigos únicos para restaurantes e áreas
- Verificação de integridade referencial
- Tratamento de erros robusto

### Performance
- Queries preparadas para melhor performance
- Índices automáticos nas chaves primárias
- Conexão única mantida durante a execução

### Segurança
- Validação de entrada em todas as APIs
- Sanitização de dados SQL
- Tratamento de erros sem exposição de informações sensíveis

### Monitoramento
- Estatísticas em tempo real
- Logs de todas as operações
- Métricas de uso do banco

---

**Desenvolvido com ❤️ para gerenciamento dinâmico do PedidoReadyBot**
