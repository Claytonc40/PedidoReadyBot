# 🚀 PedidoReadyBot - Guia PM2

Este guia explica como usar o PM2 para gerenciar a aplicação PedidoReadyBot em produção.

## 📋 Pré-requisitos

1. **Node.js** instalado (versão 16 ou superior)
2. **PM2** instalado globalmente:
   ```bash
   npm install -g pm2
   ```

## 🎯 Configuração do Ecosystem

O arquivo `ecosystem.config.js` contém todas as configurações necessárias:

### ✨ Características Principais

- **Nome da aplicação**: `PedidoReadyBot`
- **Script principal**: `server.js`
- **Porta**: `3001`
- **Modo de execução**: `fork` (processo único)
- **Auto-restart**: Habilitado
- **Logs**: Separados por tipo (erro, saída, combinado)
- **Monitoramento de memória**: Restart automático se exceder 500MB
- **Reinicialização diária**: Todos os dias às 2h da manhã

## 🚀 Comandos Básicos

### Iniciar a aplicação
```bash
# Iniciar em modo produção
pm2 start ecosystem.config.js --env production

# Iniciar em modo desenvolvimento
pm2 start ecosystem.config.js --env development
```

### Gerenciar a aplicação
```bash
# Ver status
pm2 status

# Parar
pm2 stop PedidoReadyBot

# Reiniciar
pm2 restart PedidoReadyBot

# Parar e remover
pm2 delete PedidoReadyBot
```

### Monitoramento
```bash
# Ver logs em tempo real
pm2 logs PedidoReadyBot

# Ver logs de erro
pm2 logs PedidoReadyBot --err

# Ver logs de saída
pm2 logs PedidoReadyBot --out

# Monitorar recursos (CPU, memória, etc.)
pm2 monit
```

## 🎮 Script de Gerenciamento (Windows)

Use o arquivo `pm2-manager.bat` para uma interface amigável:

1. **Duplo-clique** no arquivo `pm2-manager.bat`
2. **Escolha a opção** desejada do menu
3. **Siga as instruções** na tela

### Opções disponíveis:
- 🚀 **Iniciar aplicação**
- ⏹️ **Parar aplicação**
- 🔄 **Reiniciar aplicação**
- 📊 **Ver status**
- 📋 **Ver logs**
- ❌ **Ver logs de erro**
- ✅ **Ver logs de saída**
- 📺 **Monitorar em tempo real**
- 🗑️ **Parar e remover do PM2**

## 📁 Estrutura de Logs

Os logs são salvos no diretório `./logs/`:

- **`err.log`**: Logs de erro
- **`out.log`**: Logs de saída
- **`combined.log`**: Logs combinados

### Visualizar logs específicos:
```bash
# Últimas 100 linhas de erro
pm2 logs PedidoReadyBot --err --lines 100

# Últimas 50 linhas de saída
pm2 logs PedidoReadyBot --out --lines 50

# Logs combinados com timestamp
pm2 logs PedidoReadyBot --timestamp
```

## 🔧 Configurações Avançadas

### Variáveis de Ambiente
O ecosystem carrega automaticamente o arquivo `config.env` se existir.

### Reinicialização Automática
- **Auto-restart**: Habilitado para falhas
- **Reinicialização diária**: Às 2h da manhã
- **Delay entre restarts**: 4 segundos
- **Máximo de restarts**: 10 tentativas

### Monitoramento de Recursos
- **Limite de memória**: 500MB
- **Tempo mínimo de uptime**: 10 segundos
- **Timeout de kill**: 5 segundos

## 🚨 Solução de Problemas

### Aplicação não inicia
```bash
# Verificar logs de erro
pm2 logs PedidoReadyBot --err

# Verificar status
pm2 status

# Reiniciar com logs detalhados
pm2 restart PedidoReadyBot
pm2 logs PedidoReadyBot --lines 200
```

### Problemas de memória
```bash
# Ver uso de memória
pm2 monit

# Ver estatísticas detalhadas
pm2 show PedidoReadyBot
```

### Logs não aparecem
```bash
# Verificar se o diretório logs existe
ls -la logs/

# Verificar permissões
chmod 755 logs/
```

## 📊 Monitoramento em Produção

### Comandos úteis para produção:
```bash
# Ver estatísticas em tempo real
pm2 monit

# Ver informações detalhadas
pm2 show PedidoReadyBot

# Ver histórico de restarts
pm2 show PedidoReadyBot | grep "restart time"

# Ver uso de recursos
pm2 show PedidoReadyBot | grep -E "(memory|cpu|uptime)"
```

### Configuração de startup automático:
```bash
# Salvar configuração atual
pm2 save

# Configurar para iniciar com o sistema
pm2 startup

# Restaurar aplicações salvas
pm2 resurrect
```

## 🔄 Deploy Automático

O ecosystem inclui configuração para deploy automático (opcional):

```bash
# Configurar deploy
pm2 deploy ecosystem.config.js production setup

# Fazer deploy
pm2 deploy ecosystem.config.js production

# Rollback
pm2 deploy ecosystem.config.js production revert 1
```

## 📝 Notas Importantes

1. **Porta 3001**: Certifique-se de que a porta está disponível
2. **Arquivo config.env**: Configure o token JWT antes de iniciar
3. **Banco de dados**: O SQLite será criado automaticamente em `./data/`
4. **Logs**: Verifique regularmente os logs para monitorar a saúde da aplicação
5. **Reinicialização**: A aplicação reinicia automaticamente às 2h da manhã

## 🆘 Suporte

Para problemas específicos:

1. **Verifique os logs**: `pm2 logs PedidoReadyBot`
2. **Verifique o status**: `pm2 status`
3. **Reinicie a aplicação**: `pm2 restart PedidoReadyBot`
4. **Verifique a configuração**: `pm2 show PedidoReadyBot`

---

**🎯 Dica**: Use o script `pm2-manager.bat` para uma experiência mais amigável no Windows!
