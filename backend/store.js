const { Pool } = require('pg');

async function pgStore(url) {
  const pool = new Pool({ connectionString: url });
  for (let i = 0; i < 10; i++) {           // tunggu DB siap
    try { await pool.query('SELECT 1'); break; }
    catch (e) { if (i === 9) throw e; await new Promise(r => setTimeout(r, 2000)); }
  }
  await pool.query(`CREATE TABLE IF NOT EXISTS todos (
    id SERIAL PRIMARY KEY, title TEXT NOT NULL, done BOOLEAN DEFAULT FALSE)`);
  return {
    list: async () => (await pool.query('SELECT * FROM todos ORDER BY id DESC')).rows,
    add: async (t) => (await pool.query('INSERT INTO todos(title) VALUES($1) RETURNING *', [t])).rows[0],
    toggle: async (id) => (await pool.query('UPDATE todos SET done = NOT done WHERE id=$1 RETURNING *', [id])).rows[0],
    remove: async (id) => { await pool.query('DELETE FROM todos WHERE id=$1', [id]); },
  };
}

function memoryStore() {                   // dipakai untuk test
  let items = [], seq = 1;
  return {
    list: async () => [...items].reverse(),
    add: async (title) => { const t = { id: seq++, title, done: false }; items.push(t); return t; },
    toggle: async (id) => { const t = items.find(i => i.id === id); if (t) t.done = !t.done; return t; },
    remove: async (id) => { items = items.filter(i => i.id !== id); },
  };
}
module.exports = { pgStore, memoryStore };
