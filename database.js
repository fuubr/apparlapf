const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Erro ao conectar ao banco SQLite:', err.message);
  } else {
    console.log('Conectado ao banco de dados SQLite.');
  }
});

// Helper functions for promise-based queries
const dbRun = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(query, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

const dbAll = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const dbGet = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

// Initialize database schema and seeds
const initDb = async () => {
  try {
    // Table: veiculos
    await dbRun(`
      CREATE TABLE IF NOT EXISTS veiculos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        placa TEXT UNIQUE NOT NULL,
        frota TEXT NOT NULL,
        empresa TEXT NOT NULL
      )
    `);

    // Table: abastecimentos
    await dbRun(`
      CREATE TABLE IF NOT EXISTS abastecimentos (
        id TEXT PRIMARY KEY,
        data_hora TEXT NOT NULL,
        upb TEXT NOT NULL,
        motorista TEXT NOT NULL,
        placa TEXT NOT NULL,
        frota TEXT NOT NULL,
        empresa TEXT NOT NULL,
        quantidade_arla REAL NOT NULL,
        observacoes TEXT,
        sincronizado INTEGER DEFAULT 1
      )
    `);

    // Seed initial vehicles if table is empty
    const countRow = await dbGet('SELECT COUNT(*) as count FROM veiculos');
    if (countRow.count === 0) {
      const initialVehicles = [
        { placa: 'ABC1C34', frota: 'F-001', empresa: 'Potencial Florestal' },
        { placa: 'XYZ5E78', frota: 'F-002', empresa: 'Potencial Florestal' },
        { placa: 'MNO9G12', frota: 'F-015', empresa: 'Potencial Logística' },
        { placa: 'TAT2I26', frota: 'F-020', empresa: 'Transportes Tatuí' },
        { placa: 'LIM9J88', frota: 'F-008', empresa: 'Limeira Empreendimentos' },
        { placa: 'POT1A11', frota: 'F-050', empresa: 'Potencial Florestal' }
      ];

      for (const vehicle of initialVehicles) {
        await dbRun(
          'INSERT OR IGNORE INTO veiculos (placa, frota, empresa) VALUES (?, ?, ?)',
          [vehicle.placa.toUpperCase(), vehicle.frota.toUpperCase(), vehicle.empresa]
        );
      }
      console.log('Seed: Veículos cadastrados com sucesso!');
    }
  } catch (err) {
    console.error('Erro na migração/seed do banco de dados:', err);
  }
};

module.exports = {
  db,
  dbRun,
  dbAll,
  dbGet,
  initDb
};
