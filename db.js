const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('supabase')
    ? { rejectUnauthorized: false }
    : false,
});

// ── Inicializa tabelas se não existirem ──────────────────────────
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gifts (
      id          INTEGER PRIMARY KEY,
      name        TEXT NOT NULL,
      cat         TEXT NOT NULL,
      emoji       TEXT,
      description TEXT,
      total       INTEGER NOT NULL,
      quotas      INTEGER NOT NULL,
      vpq         INTEGER NOT NULL,
      res_quotas  INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS contributors (
      id         SERIAL PRIMARY KEY,
      gift_id    INTEGER REFERENCES gifts(id),
      name       TEXT NOT NULL,
      qty        INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS messages (
      id         SERIAL PRIMARY KEY,
      name       TEXT NOT NULL,
      text       TEXT NOT NULL,
      gift_name  TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS payments (
      id           SERIAL PRIMARY KEY,
      external_ref TEXT UNIQUE NOT NULL,
      mp_id        TEXT,
      gift_id      INTEGER REFERENCES gifts(id),
      qty          INTEGER NOT NULL,
      amount       NUMERIC(10,2) NOT NULL,
      payer_name   TEXT,
      payer_email  TEXT,
      status       TEXT DEFAULT 'pending',
      created_at   TIMESTAMP DEFAULT NOW(),
      confirmed_at TIMESTAMP
    );
  `);

  // Seed presentes se tabela estiver vazia
  const { rows } = await pool.query('SELECT COUNT(*) FROM gifts');
  if (parseInt(rows[0].count) === 0) {
    await seedGifts();
  }

  console.log('✅ Banco de dados iniciado');
}

async function seedGifts() {
  const gifts = [
    [1,  'Geladeira Frost Free 460L',       'casa',        '🧊', 'Duplex inverter 460L, inox escovado, eficiência A+++.',         4000, 100, 40 ],
    [2,  'Máquina de Lavar 12kg',            'casa',        '🌀', 'Direct Drive, 12 programas, baixo consumo de água.',           2800,  70, 40 ],
    [3,  'Air Fryer Digital 5,5L',           'cozinha',     '🥘', '12 funções, display touchscreen, capacidade família.',         350,   10, 35 ],
    [4,  'Jogo de Panelas Premium 5 Peças',  'cozinha',     '🍳', 'Antiaderente cerâmico, livre de PFOA, alças ergonômicas.',     480,   10, 48 ],
    [5,  'Cafeteira Expresso',               'cozinha',     '☕', '15 bar de pressão, vaporizador de leite, corpo em inox.',      620,   10, 62 ],
    [6,  'Liquidificador de Alta Potência',  'cozinha',     '🥤', '1500W, copo de vidro 2L, 6 velocidades + pulsar.',             290,   10, 29 ],
    [7,  'Home Theater 5.1 Surround',        'casa',        '🔊', 'Sistema imersivo com subwoofer ativo e Bluetooth.',            1800,  50, 36 ],
    [8,  'Jogo de Cama Queen 400 Fios',      'cama-banho',  '🛏️', '100% algodão egípcio, 4 peças, cor lavanda.',                 520,   10, 52 ],
    [9,  'Jogo de Toalhas 8 Peças',          'cama-banho',  '🛁', 'Algodão penteado 600g/m², super absorvente, cor areia.',       340,   10, 34 ],
    [10, 'Fundo para a Lua de Mel',          'experiencia', '✈️', 'Contribua para a viagem dos sonhos de Luciana e Wellington!',  8000, 100, 80 ],
    [11, 'Jantar Romântico a Dois',          'experiencia', '🍽️', 'Voucher para jantar a dois em restaurante italiano premiado.',  400,   10, 40 ],
    [12, 'Spa Day para o Casal',             'experiencia', '💆', 'Massagem, hidratação e piscina termal para dois.',              580,   10, 58 ],
    [13, 'Tapete Sala 2×3m',                'casa',        '🏠', 'Fibra natural trançada, estilo escandinavo, tons neutros.',     480,   10, 48 ],
    [14, 'Kit Aromaterapia',                 'casa',        '🕯️', 'Difusor elétrico + 10 óleos essenciais + 3 velas.',            260,   10, 26 ],
    [15, 'Curso de Culinária a Dois',        'experiencia', '👨‍🍳', 'Aula hands-on de 3h com chef, inclui jantar ao final.',        320,   10, 32 ],
  ];

  for (const g of gifts) {
    await pool.query(
      `INSERT INTO gifts (id, name, cat, emoji, description, total, quotas, vpq)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`,
      g
    );
  }
  console.log('🎁 Presentes inseridos no banco');
}

// ── Queries ──────────────────────────────────────────────────────
async function getGifts() {
  const { rows } = await pool.query(`
    SELECT g.*, COALESCE(
      json_agg(json_build_object('name', c.name, 'qty', c.qty) ORDER BY c.created_at)
      FILTER (WHERE c.id IS NOT NULL), '[]'
    ) AS contributors
    FROM gifts g
    LEFT JOIN contributors c ON c.gift_id = g.id
    GROUP BY g.id ORDER BY g.id
  `);
  return rows.map(r => ({
    id: r.id, name: r.name, cat: r.cat, emoji: r.emoji,
    desc: r.description, total: r.total, quotas: r.quotas,
    vpq: r.vpq, resQuotas: r.res_quotas, contributors: r.contributors,
  }));
}

async function getMessages() {
  const { rows } = await pool.query(
    `SELECT name, text, gift_name AS gift,
     TO_CHAR(created_at, 'DD "de" TMMonth "de" YYYY') AS date
     FROM messages ORDER BY created_at DESC`
  );
  return rows;
}

async function createPayment({ externalRef, giftId, qty, amount, payerName, payerEmail }) {
  await pool.query(
    `INSERT INTO payments (external_ref, gift_id, qty, amount, payer_name, payer_email)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [externalRef, giftId, qty, amount, payerName, payerEmail]
  );
}

async function updatePaymentMpId(externalRef, mpId) {
  await pool.query(
    `UPDATE payments SET mp_id=$1 WHERE external_ref=$2`,
    [mpId, externalRef]
  );
}

async function getPaymentByRef(externalRef) {
  const { rows } = await pool.query(
    `SELECT * FROM payments WHERE external_ref=$1`, [externalRef]
  );
  return rows[0] || null;
}

async function getPaymentByMpId(mpId) {
  const { rows } = await pool.query(
    `SELECT * FROM payments WHERE mp_id=$1`, [mpId]
  );
  return rows[0] || null;
}

async function confirmPayment(externalRef, message) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT * FROM payments WHERE external_ref=$1 AND status='pending'`,
      [externalRef]
    );
    if (!rows[0]) { await client.query('ROLLBACK'); return false; }

    const p = rows[0];

    // Atualiza pagamento
    await client.query(
      `UPDATE payments SET status='approved', confirmed_at=NOW() WHERE external_ref=$1`,
      [externalRef]
    );

    // Atualiza cotas do presente
    await client.query(
      `UPDATE gifts SET res_quotas = res_quotas + $1 WHERE id=$2`,
      [p.qty, p.gift_id]
    );

    // Registra contributor
    await client.query(
      `INSERT INTO contributors (gift_id, name, qty) VALUES ($1,$2,$3)`,
      [p.gift_id, p.payer_name, p.qty]
    );

    // Salva mensagem se existir
    if (message?.trim()) {
      const { rows: gRows } = await client.query(
        `SELECT name FROM gifts WHERE id=$1`, [p.gift_id]
      );
      await client.query(
        `INSERT INTO messages (name, text, gift_name) VALUES ($1,$2,$3)`,
        [p.payer_name, message.trim(), gRows[0]?.name || null]
      );
    }

    await client.query('COMMIT');
    return true;
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('confirmPayment error:', err);
    return false;
  } finally {
    client.release();
  }
}

async function addMessage({ name, text, giftName = null }) {
  await pool.query(
    `INSERT INTO messages (name, text, gift_name) VALUES ($1,$2,$3)`, [name, text, giftName]
  );
}

module.exports = {
  initDB, getGifts, getMessages,
  createPayment, updatePaymentMpId,
  getPaymentByRef, getPaymentByMpId,
  confirmPayment, addMessage,
};
