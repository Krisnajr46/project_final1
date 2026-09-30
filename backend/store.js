const { Pool } = require('pg');

async function pgStore(url) {
  const pool = new Pool({ connectionString: url });
  for (let i = 0; i < 10; i++) {
    try { await pool.query('SELECT 1'); break; }
    catch (e) { if (i === 9) throw e; await new Promise(r => setTimeout(r, 2000)); }
  }

  // Buat tabel users & todos dengan relasi
  await pool.query(`CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS todos (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    done BOOLEAN DEFAULT FALSE,
    user_id INT REFERENCES users(id) ON DELETE CASCADE
  )`);

  return {
    // 🔑 User functions
    getUserByEmail: async (email) =>
      (await pool.query('SELECT * FROM users WHERE email=$1', [email])).rows[0],

    createUser: async (email, hash) =>
      (await pool.query('INSERT INTO users(email, password_hash) VALUES($1,$2) RETURNING *', [email, hash])).rows[0],

    // ✅ Todos functions (per user)
    listByUser: async (userId) =>
      (await pool.query('SELECT * FROM todos WHERE user_id=$1 ORDER BY id DESC', [userId])).rows,

    add: async (title, userId) =>
      (await pool.query('INSERT INTO todos(title, user_id) VALUES($1,$2) RETURNING *', [title, userId])).rows[0],

    toggle: async (id, userId) =>
      (await pool.query('UPDATE todos SET done = NOT done WHERE id=$1 AND user_id=$2 RETURNING *', [id, userId])).rows[0],

    remove: async (id, userId) =>
      await pool.query('DELETE FROM todos WHERE id=$1 AND user_id=$2', [id, userId]),
  };
}

function memoryStore() {
  let items = [], seq = 1, users = [];
  return {
    getUserByEmail: async (email) => users.find(u => u.email === email),
    createUser: async (email, hash) => {
      const u = { id: users.length + 1, email, password_hash: hash };
      users.push(u); return u;
    },
    listByUser: async (userId) => items.filter(i => i.user_id === userId).reverse(),
    add: async (title, userId) => {
      const t = { id: seq++, title, done: false, user_id: userId };
      items.push(t); return t;
    },
    toggle: async (id, userId) => {
      const t = items.find(i => i.id === id && i.user_id === userId);
      if (t) t.done = !t.done; return t;
    },
    remove: async (id, userId) => {
      items = items.filter(i => !(i.id === id && i.user_id === userId));
    },
  };
}

module.exports = { pgStore, memoryStore };
