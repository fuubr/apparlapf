const express = require('express');
const cors = require('cors');
const { initDb, dbRun, dbAll, dbGet } = require('./database');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Initialize Database
initDb().then(() => {
  console.log('Banco de dados inicializado com sucesso.');
}).catch((err) => {
  console.error('Falha ao inicializar o banco de dados:', err);
});

// API STATUS
app.get('/api/status', (req, res) => {
  res.json({ status: 'online', timestamp: new Date().toISOString() });
});

/* ==========================================================================
   VEÍCULOS ENDPOINTS (Cadastro de Veículos)
   ========================================================================== */

// Get all vehicles
app.get('/api/veiculos', async (req, res) => {
  try {
    const veiculos = await dbAll('SELECT * FROM veiculos ORDER BY placa ASC');
    res.json(veiculos);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar veículos: ' + err.message });
  }
});

// Create vehicle
app.post('/api/veiculos', async (req, res) => {
  const { placa, frota, empresa } = req.body;
  if (!placa || !frota || !empresa) {
    return res.status(400).json({ error: 'Campos placa, frota e empresa são obrigatórios.' });
  }
  try {
    const result = await dbRun(
      'INSERT INTO veiculos (placa, frota, empresa) VALUES (?, ?, ?)',
      [placa.toUpperCase().trim(), frota.toUpperCase().trim(), empresa.trim()]
    );
    res.status(201).json({ id: result.lastID, placa, frota, empresa });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'Veículo com esta placa já está cadastrado.' });
    }
    res.status(500).json({ error: 'Erro ao cadastrar veículo: ' + err.message });
  }
});

// Update vehicle
app.put('/api/veiculos/:id', async (req, res) => {
  const { id } = req.params;
  const { placa, frota, empresa } = req.body;
  if (!placa || !frota || !empresa) {
    return res.status(400).json({ error: 'Campos placa, frota e empresa são obrigatórios.' });
  }
  try {
    await dbRun(
      'UPDATE veiculos SET placa = ?, frota = ?, empresa = ? WHERE id = ?',
      [placa.toUpperCase().trim(), frota.toUpperCase().trim(), empresa.trim(), id]
    );
    res.json({ id, placa, frota, empresa });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar veículo: ' + err.message });
  }
});

// Delete vehicle
app.delete('/api/veiculos/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await dbRun('DELETE FROM veiculos WHERE id = ?', [id]);
    res.json({ message: 'Veículo excluído com sucesso.' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao excluir veículo: ' + err.message });
  }
});


/* ==========================================================================
   ABASTECIMENTOS ENDPOINTS
   ========================================================================== */

// Sync fueling records (from offline app)
app.post('/api/sync', async (req, res) => {
  const items = req.body;
  if (!Array.isArray(items)) {
    return res.status(400).json({ error: 'Payload deve ser uma lista de abastecimentos.' });
  }

  console.log(`Recebendo lote de sincronização com ${items.length} itens...`);
  const results = { synced: [], errors: [] };

  for (const item of items) {
    const { id, data_hora, upb, motorista, placa, frota, empresa, quantidade_arla, observacoes } = item;
    if (!id || !data_hora || !upb || !motorista || !placa || !quantidade_arla) {
      results.errors.push({ id, error: 'Campos obrigatórios ausentes.' });
      continue;
    }

    try {
      // Check if entry already exists to avoid duplicates
      const existing = await dbGet('SELECT id FROM abastecimentos WHERE id = ?', [id]);
      if (existing) {
        results.synced.push(id); // Already exists, count as synced
        continue;
      }

      await dbRun(
        `INSERT INTO abastecimentos 
        (id, data_hora, upb, motorista, placa, frota, empresa, quantidade_arla, observacoes, sincronizado) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          id,
          data_hora,
          upb,
          motorista.trim(),
          placa.toUpperCase().trim(),
          frota.toUpperCase().trim(),
          empresa.trim(),
          parseFloat(quantidade_arla),
          observacoes ? observacoes.trim() : null
        ]
      );
      results.synced.push(id);
    } catch (err) {
      console.error(`Erro ao sincronizar item ${id}:`, err);
      results.errors.push({ id, error: err.message });
    }
  }

  res.json({
    message: 'Processamento de sincronização concluído.',
    syncedCount: results.synced.length,
    errorCount: results.errors.length,
    syncedIds: results.synced,
    errors: results.errors
  });
});

// Get fueling records with admin filters
app.get('/api/abastecimentos', async (req, res) => {
  const { data_inicio, data_fim, placa, motorista, frota, empresa, upb } = req.query;

  let queryStr = 'SELECT * FROM abastecimentos WHERE 1=1';
  let params = [];

  if (data_inicio) {
    queryStr += ' AND substr(data_hora, 1, 10) >= ?';
    params.push(data_inicio);
  }
  if (data_fim) {
    queryStr += ' AND substr(data_hora, 1, 10) <= ?';
    params.push(data_fim);
  }
  if (placa) {
    queryStr += ' AND placa LIKE ?';
    params.push(`%${placa}%`);
  }
  if (motorista) {
    queryStr += ' AND motorista LIKE ?';
    params.push(`%${motorista}%`);
  }
  if (frota) {
    queryStr += ' AND frota LIKE ?';
    params.push(`%${frota}%`);
  }
  if (empresa) {
    queryStr += ' AND empresa LIKE ?';
    params.push(`%${empresa}%`);
  }
  if (upb) {
    queryStr += ' AND upb = ?';
    params.push(upb);
  }

  queryStr += ' ORDER BY data_hora DESC';

  try {
    const rows = await dbAll(queryStr, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar abastecimentos: ' + err.message });
  }
});

// Create fueling record directly (Admin or standard)
app.post('/api/abastecimentos', async (req, res) => {
  const { id, data_hora, upb, motorista, placa, frota, empresa, quantidade_arla, observacoes } = req.body;
  
  if (!upb || !motorista || !placa || !quantidade_arla) {
    return res.status(400).json({ error: 'Campos obrigatórios ausentes.' });
  }

  const recordId = id || 'AB-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  const timestamp = data_hora || new Date().toISOString();

  try {
    await dbRun(
      `INSERT INTO abastecimentos 
      (id, data_hora, upb, motorista, placa, frota, empresa, quantidade_arla, observacoes, sincronizado) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        recordId,
        timestamp,
        upb,
        motorista.trim(),
        placa.toUpperCase().trim(),
        frota.toUpperCase().trim(),
        empresa.trim(),
        parseFloat(quantidade_arla),
        observacoes ? observacoes.trim() : null
      ]
    );
    res.status(201).json({ id: recordId, data_hora: timestamp, upb, motorista, placa, frota, empresa, quantidade_arla, observacoes });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao criar abastecimento: ' + err.message });
  }
});

// Update fueling record
app.put('/api/abastecimentos/:id', async (req, res) => {
  const { id } = req.params;
  const { data_hora, upb, motorista, placa, frota, empresa, quantidade_arla, observacoes } = req.body;

  if (!upb || !motorista || !placa || !quantidade_arla) {
    return res.status(400).json({ error: 'Campos obrigatórios ausentes.' });
  }

  try {
    await dbRun(
      `UPDATE abastecimentos SET 
        data_hora = ?, 
        upb = ?, 
        motorista = ?, 
        placa = ?, 
        frota = ?, 
        empresa = ?, 
        quantidade_arla = ?, 
        observacoes = ? 
      WHERE id = ?`,
      [
        data_hora,
        upb,
        motorista.trim(),
        placa.toUpperCase().trim(),
        frota.toUpperCase().trim(),
        empresa.trim(),
        parseFloat(quantidade_arla),
        observacoes ? observacoes.trim() : null,
        id
      ]
    );
    res.json({ id, data_hora, upb, motorista, placa, frota, empresa, quantidade_arla, observacoes });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar abastecimento: ' + err.message });
  }
});

// Delete fueling record
app.delete('/api/abastecimentos/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await dbRun('DELETE FROM abastecimentos WHERE id = ?', [id]);
    res.json({ message: 'Abastecimento excluído com sucesso.' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao excluir abastecimento: ' + err.message });
  }
});


/* ==========================================================================
   DASHBOARD STATS
   ========================================================================== */

app.get('/api/dashboard', async (req, res) => {
  try {
    // Dates relative to local time zone of Brazil/Server
    const tzOffset = -3; // UTC-3 (Brazil standard time)
    const localDate = new Date(new Date().getTime() + tzOffset * 3600 * 1000);
    const todayStr = localDate.toISOString().substring(0, 10);
    const thisMonthStr = localDate.toISOString().substring(0, 7);

    // 1. Today's total liters
    const todayTotal = await dbGet(
      'SELECT SUM(quantidade_arla) as total FROM abastecimentos WHERE substr(data_hora, 1, 10) = ?',
      [todayStr]
    );

    // 2. This month's total liters
    const monthTotal = await dbGet(
      'SELECT SUM(quantidade_arla) as total FROM abastecimentos WHERE substr(data_hora, 1, 7) = ?',
      [thisMonthStr]
    );

    // 3. Liters by vehicle (top 5)
    const byVehicle = await dbAll(
      'SELECT placa, SUM(quantidade_arla) as total FROM abastecimentos GROUP BY placa ORDER BY total DESC LIMIT 5'
    );

    // 4. Liters by fleet (top 5)
    const byFleet = await dbAll(
      'SELECT frota, SUM(quantidade_arla) as total FROM abastecimentos GROUP BY frota ORDER BY total DESC LIMIT 5'
    );

    // 5. Liters by company (top 5)
    const byCompany = await dbAll(
      'SELECT empresa, SUM(quantidade_arla) as total FROM abastecimentos GROUP BY empresa ORDER BY total DESC LIMIT 5'
    );

    // 6. Liters by UPB
    const byUpb = await dbAll(
      'SELECT upb, SUM(quantidade_arla) as total FROM abastecimentos GROUP BY upb'
    );

    res.json({
      today: todayTotal.total || 0,
      month: monthTotal.total || 0,
      byVehicle,
      byFleet,
      byCompany,
      byUpb
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao calcular métricas do dashboard: ' + err.message });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`Servidor Express rodando na porta ${PORT}`);
});
