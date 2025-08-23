# 🚀 Dashboard PedidoReadyBot

Dashboard web moderno e responsivo para monitorar o status do PedidoReadyBot em tempo real.

## ✨ Funcionalidades

- 📊 **Resumo Geral**: Total de sucessos, erros e taxa de sucesso
- ⏱️ **Performance**: Tempo de execução e horários
- 🔍 **Checkpoint**: Status do sistema de checkpoint e uptime
- 🏪 **Restaurantes**: Resumo por restaurante com estatísticas
- 🔄 **Atualização Automática**: Dados atualizados a cada 30 segundos
- 📱 **Responsivo**: Funciona em desktop e dispositivos móveis

## 🌐 Acesso

### URL Principal
```
http://localhost:3001/dashboard
```

### Endpoints da API
- **Dashboard**: `/dashboard` - Interface web
- **Dados**: `/dashboard-data` - Dados JSON para o dashboard
- **Status**: `/status` - Status geral da aplicação
- **Checkpoint**: `/checkpoint` - Status do sistema de checkpoint

### Arquivos do Dashboard
- **HTML**: `public/index.html` - Interface principal
- **JavaScript**: `public/dashboard.js` - Lógica e funcionalidades
- **CSS**: Inline no HTML para melhor performance

## 🎨 Interface

### Cards de Status

#### 📊 Resumo Geral
- ✅ Total de Sucessos
- ❌ Total de Erros  
- 📦 Total Processado
- 🏪 Restaurantes Envolvidos
- 📈 Taxa de Sucesso (barra de progresso)

#### ⏱️ Performance
- Tempo Total de Execução
- Hora de Início
- Hora de Conclusão
- Última Execução

#### 🔍 Checkpoint
- Checkpoint Atual
- Status do Sistema
- Uptime da Aplicação

### 🏪 Resumo por Restaurante
- Cards individuais para cada restaurante
- Contadores de sucessos e erros
- Indicadores visuais de status
- Bordas coloridas (verde = funcionando, vermelho = com problemas)

## 🔧 Tecnologias

- **Frontend**: HTML5, CSS3, JavaScript ES6+
- **Design**: CSS Grid, Flexbox, Gradientes
- **Responsividade**: Media Queries
- **Animações**: CSS Transitions, Keyframes
- **API**: Fetch API, JSON
- **Arquitetura**: JavaScript externo para melhor segurança

## 📱 Responsividade

O dashboard se adapta automaticamente a diferentes tamanhos de tela:

- **Desktop**: Layout em grid com 3 colunas
- **Tablet**: Layout adaptativo com 2 colunas
- **Mobile**: Layout em coluna única

## 🔄 Atualizações

### Automática
- Dados atualizados a cada 30 segundos
- Indicador de loading durante atualizações
- Timestamp da última atualização

### Manual
- Botão "🔄 Atualizar Dados" para atualização imediata
- Feedback visual durante o processo

## 🎯 Métricas Exibidas

### Dados em Tempo Real
```json
{
  "status": "running",
  "lastProcessed": "2025-08-23T00:30:12.865Z",
  "totalProcessed": 29,
  "totalStores": 2,
  "successfulStores": 1,
  "failedStores": 1,
  "currentCheckpoint": "1755906612865",
  "uptime": 12425.5,
  "timestamp": "2025-08-23T00:30:12.865Z"
}
```

### Cálculos Automáticos
- **Taxa de Sucesso**: `(sucessos / total) * 100`
- **Formatação de Tempo**: Conversão automática de ms para formato legível
- **Formatação de Timestamp**: Conversão para formato brasileiro
- **Formatação de Uptime**: Conversão de segundos para horas:minutos:segundos

## 🚀 Como Usar

### 1. Acessar o Dashboard
```
http://localhost:3001/dashboard
```

### 2. Visualizar Métricas
- Os dados são carregados automaticamente
- Cada card mostra informações específicas
- As cores indicam o status (verde = sucesso, vermelho = erro)

### 3. Atualizar Dados
- **Automático**: A cada 30 segundos
- **Manual**: Clicar no botão "🔄 Atualizar Dados"

### 4. Monitorar Restaurantes
- Cards individuais para cada restaurante
- Status visual claro (funcionando/com problemas)
- Contadores de sucessos e erros

## 🔍 Troubleshooting

### Dashboard não carrega
- Verificar se o servidor está rodando
- Verificar se a porta 3001 está acessível
- Verificar console do navegador para erros

### Dados não atualizam
- Verificar se o endpoint `/dashboard-data` está funcionando
- Verificar se há erros na API
- Tentar atualização manual

### Layout quebrado
- Verificar se o CSS está sendo carregado
- Verificar se há conflitos de JavaScript
- Testar em diferentes navegadores

## 📊 Exemplo de Saída

```
🎯 ==========================================
🎯 PROCESSAMENTO CONCLUÍDO
🎯 ==========================================
⏱️ Tempo total: 12425ms
⏰ Hora de conclusão: 2025-08-23T00:30:12.865Z

📊 RESUMO GERAL:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Total de sucessos: 29
❌ Total de erros: 3
📦 Total processado: 32
🏪 Restaurantes envolvidos: 2
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🏪 RESUMO POR RESTAURANTE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏪 BED: ✅ 29 | ❌ 2
🏪 ARX: ❌ 1 (apenas erros)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## 🌟 Recursos Avançados

- **Animações CSS**: Hover effects e transições suaves
- **Gradientes**: Background moderno com gradiente
- **Sombras**: Cards com sombras dinâmicas
- **Ícones**: Emojis para melhor visualização
- **Loading States**: Indicadores visuais durante carregamento
- **Error Handling**: Tratamento de erros com feedback visual

---

**Desenvolvido com ❤️ para monitoramento em tempo real do PedidoReadyBot**
