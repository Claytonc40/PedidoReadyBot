const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

class DatabaseService {
  constructor() {
    this.dbPath = path.join(__dirname, '..', 'data', 'pedidoreadybot.db');
    this.ensureDataDirectory();
    this.init();
  }

  ensureDataDirectory() {
    const dataDir = path.dirname(this.dbPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  }

  init() {
    this.db = new Database(this.dbPath);
    this.createTables();
    this.insertDefaultData();
  }

  createTables() {
    // Tabela de restaurantes
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS restaurants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabela de áreas de processamento
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS processing_areas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabela de configurações gerais
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE NOT NULL,
        value TEXT NOT NULL,
        description TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✅ Tabelas do banco de dados criadas/verificadas');
  }

  insertDefaultData() {
    // Inserir restaurantes padrão se não existirem
    const defaultRestaurants = [
      { code: 'BED', name: 'Restaurante BED', description: 'Restaurante padrão BED' },
      { code: 'ARX', name: 'Restaurante ARX', description: 'Restaurante padrão ARX' }
    ];

    defaultRestaurants.forEach(restaurant => {
      const exists = this.db.prepare('SELECT id FROM restaurants WHERE code = ?').get(restaurant.code);
      if (!exists) {
        this.db.prepare(`
          INSERT INTO restaurants (code, name, description) 
          VALUES (?, ?, ?)
        `).run(restaurant.code, restaurant.name, restaurant.description);
      }
    });

    // Inserir áreas de processamento padrão se não existirem
    const defaultAreas = [
      { code: 'MCC', name: 'McDonald\'s', description: 'Área McDonald\'s' },
      { code: 'CDP', name: 'Cardápio Digital', description: 'Área de Cardápio Digital' },
      { code: 'CHK', name: 'Checkout', description: 'Área de Checkout' },
      { code: 'BKF', name: 'Breakfast', description: 'Área de Café da Manhã' },
      { code: 'DLV', name: 'Delivery', description: 'Área de Delivery' }
    ];

    defaultAreas.forEach(area => {
      const exists = this.db.prepare('SELECT id FROM processing_areas WHERE code = ?').get(area.code);
      if (!exists) {
        this.db.prepare(`
          INSERT INTO processing_areas (code, name, description) 
          VALUES (?, ?, ?)
        `).run(area.code, area.name, area.description);
      }
    });

    // Inserir configurações padrão
    const defaultSettings = [
      { key: 'CRON_PATTERN', value: '*/5 * * * *', description: 'Padrão do cron job' },
      { key: 'CRON_TIMEZONE', value: 'America/Sao_Paulo', description: 'Timezone do cron' },
      { key: 'JWT_TOKEN', value: 'seu_token_jwt_aqui', description: 'Token JWT para autenticação' }
    ];

    defaultSettings.forEach(setting => {
      const exists = this.db.prepare('SELECT id FROM settings WHERE key = ?').get(setting.key);
      if (!exists) {
        this.db.prepare(`
          INSERT INTO settings (key, value, description) 
          VALUES (?, ?, ?)
        `).run(setting.key, setting.value, setting.description);
      }
    });

    console.log('✅ Dados padrão inseridos/verificados');
  }

  // Métodos para restaurantes
  getAllRestaurants() {
    return this.db.prepare('SELECT * FROM restaurants ORDER BY code').all();
  }

  getActiveRestaurants() {
    return this.db.prepare('SELECT * FROM restaurants WHERE active = 1 ORDER BY code').all();
  }

  getRestaurantByCode(code) {
    return this.db.prepare('SELECT * FROM restaurants WHERE code = ?').get(code);
  }

  addRestaurant(code, name, description = '') {
    try {
      const result = this.db.prepare(`
        INSERT INTO restaurants (code, name, description) 
        VALUES (?, ?, ?)
      `).run(code, name, description);
      
      return { success: true, id: result.lastInsertRowid };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  updateRestaurant(id, code, name, description, active) {
    try {
      this.db.prepare(`
        UPDATE restaurants 
        SET code = ?, name = ?, description = ?, active = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(code, name, description, active ? 1 : 0, id);
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  deleteRestaurant(id) {
    try {
      this.db.prepare('DELETE FROM restaurants WHERE id = ?').run(id);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Métodos para áreas de processamento
  getAllAreas() {
    return this.db.prepare('SELECT * FROM processing_areas ORDER BY code').all();
  }

  getActiveAreas() {
    return this.db.prepare('SELECT * FROM processing_areas WHERE active = 1 ORDER BY code').all();
  }

  getAreaByCode(code) {
    return this.db.prepare('SELECT * FROM processing_areas WHERE code = ?').get(code);
  }

  addArea(code, name, description = '') {
    try {
      const result = this.db.prepare(`
        INSERT INTO processing_areas (code, name, description) 
        VALUES (?, ?, ?)
      `).run(code, name, description);
      
      return { success: true, id: result.lastInsertRowid };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  updateArea(id, code, name, description, active) {
    try {
      this.db.prepare(`
        UPDATE processing_areas 
        SET code = ?, name = ?, description = ?, active = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(code, name, description, active ? 1 : 0, id);
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  deleteArea(id) {
    try {
      this.db.prepare('DELETE FROM processing_areas WHERE id = ?').run(id);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Métodos para configurações
  getAllSettings() {
    return this.db.prepare('SELECT * FROM settings ORDER BY key').all();
  }

  getSetting(key) {
    const setting = this.db.prepare('SELECT * FROM settings WHERE key = ?').get(key);
    return setting ? setting.value : null;
  }

  updateSetting(key, value, description = '') {
    try {
      this.db.prepare(`
        UPDATE settings 
        SET value = ?, description = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE key = ?
      `).run(value, description, key);
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Métodos para compatibilidade com o sistema existente
  getStoresString() {
    const restaurants = this.getActiveRestaurants();
    return restaurants.map(r => r.code).join(',');
  }

  getAreasString() {
    const areas = this.getActiveAreas();
    return areas.map(a => a.code).join(',');
  }

    // Métodos de utilidade
  getDatabaseStats() {
    const restaurantCount = this.db.prepare('SELECT COUNT(*) as count FROM restaurants').get().count;
    const areaCount = this.db.prepare('SELECT COUNT(*) as count FROM processing_areas').get().count;
    const activeRestaurantCount = this.db.prepare('SELECT COUNT(*) as count FROM restaurants WHERE active = 1').get().count;
    const activeAreaCount = this.db.prepare('SELECT COUNT(*) as count FROM processing_areas WHERE active = 1').get().count;
    
    // Contar pedidos cancelados
    let cancelledCount = 0;
    try {
      cancelledCount = this.db.prepare('SELECT COUNT(*) as count FROM cancelled_orders').get().count;
    } catch (error) {
      // Tabela pode não existir ainda
      cancelledCount = 0;
    }

    return {
      totalRestaurants: restaurantCount,
      totalAreas: areaCount,
      activeRestaurants: activeRestaurantCount,
      activeAreas: activeAreaCount,
      totalCancelledOrders: cancelledCount
    };
  }
  
  // Métodos para pedidos cancelados
  recordCancelledOrders(cancelledOrders) {
    try {
      // Criar tabela se não existir
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS cancelled_orders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          order_id TEXT UNIQUE NOT NULL,
          store TEXT NOT NULL,
          state TEXT NOT NULL,
          reason TEXT NOT NULL,
          timestamp TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      // Inserir pedidos cancelados
      const stmt = this.db.prepare(`
        INSERT OR IGNORE INTO cancelled_orders (order_id, store, state, reason, timestamp) 
        VALUES (?, ?, ?, ?, ?)
      `);
      
      const transaction = this.db.transaction((orders) => {
        let inserted = 0;
        for (const order of orders) {
          const result = stmt.run(order.id, order.store, order.state, order.reason, order.timestamp);
          if (result.changes > 0) inserted++;
        }
        return inserted;
      });
      
      const inserted = transaction(cancelledOrders);
      console.log(`📝 ${inserted} novos pedidos cancelados registrados no banco de dados`);
      return { success: true, inserted };
    } catch (error) {
      console.error('Erro ao registrar pedidos cancelados:', error);
      throw error;
    }
  }
  
  getCancelledOrders(limit = 100) {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM cancelled_orders 
        ORDER BY created_at DESC 
        LIMIT ?
      `);
      return stmt.all(limit);
    } catch (error) {
      console.error('Erro ao buscar pedidos cancelados:', error);
      return [];
    }
  }
  
  getCancelledOrdersByStore(store, limit = 100) {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM cancelled_orders 
        WHERE store = ? 
        ORDER BY created_at DESC 
        LIMIT ?
      `);
      return stmt.all(store, limit);
    } catch (error) {
      console.error(`Erro ao buscar pedidos cancelados da loja ${store}:`, error);
      return [];
    }
  }
  
  close() {
    if (this.db) {
      this.db.close();
    }
  }
}

// Criar instância singleton
const databaseService = new DatabaseService();

// Tratamento de erros não capturados
process.on('exit', () => {
  databaseService.close();
});

process.on('SIGINT', () => {
  databaseService.close();
  process.exit(0);
});

module.exports = databaseService;
