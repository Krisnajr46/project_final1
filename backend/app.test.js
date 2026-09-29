const test = require('node:test');
const assert = require('node:assert');
const { createApp } = require('./app');
const { memoryStore } = require('./store');

test('CRUD todo', async (t) => {
  const server = createApp(memoryStore()).listen(0);
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const j = { 'Content-Type': 'application/json' };

  assert.strictEqual((await fetch(`${base}/health`)).status, 200);

  const bad = await fetch(`${base}/todos`, { method: 'POST', headers: j, body: '{}' });
  assert.strictEqual(bad.status, 400);

  const created = await (await fetch(`${base}/todos`, { method: 'POST', headers: j, body: JSON.stringify({ title: 'belajar DevOps' }) })).json();
  assert.strictEqual(created.title, 'belajar DevOps');

  const toggled = await (await fetch(`${base}/todos/${created.id}`, { method: 'PATCH' })).json();
  assert.strictEqual(toggled.done, true);

  await fetch(`${base}/todos/${created.id}`, { method: 'DELETE' });
  assert.deepStrictEqual(await (await fetch(`${base}/todos`)).json(), []);
});
