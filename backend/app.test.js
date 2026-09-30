const test = require('node:test');
const assert = require('node:assert');
const { createApp } = require('./app');
const { memoryStore } = require('./store');

test('CRUD todo', async (t) => {
  const server = createApp(memoryStore()).listen(0);
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const jsonHeaders = { 'Content-Type': 'application/json' };

  assert.strictEqual((await fetch(`${base}/health`)).status, 200);

  const unauthorized = await fetch(`${base}/todos`, {
    method: 'POST',
    headers: jsonHeaders,
    body: '{}'
  });
  assert.strictEqual(unauthorized.status, 401);

  const email = 'test@example.com';
  const password = 'password123';

  const signup = await fetch(`${base}/auth/signup`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ email, password })
  });
  assert.strictEqual(signup.status, 201);

  const loginResponse = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ email, password })
  });
  assert.strictEqual(loginResponse.status, 200);

  const { token } = await loginResponse.json();
  assert.ok(token, 'login harus mengembalikan JWT');

  const authHeaders = {
    ...jsonHeaders,
    Authorization: `Bearer ${token}`
  };

  const createdResponse = await fetch(`${base}/todos`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ title: 'belajar DevOps' })
  });
  assert.strictEqual(createdResponse.status, 201);

  const created = await createdResponse.json();
  assert.strictEqual(created.title, 'belajar DevOps');

  const toggledResponse = await fetch(`${base}/todos/${created.id}`, {
    method: 'PATCH',
    headers: authHeaders
  });
  assert.strictEqual(toggledResponse.status, 200);

  const toggled = await toggledResponse.json();
  assert.strictEqual(toggled.done, true);

  const deletedResponse = await fetch(`${base}/todos/${created.id}`, {
    method: 'DELETE',
    headers: authHeaders
  });
  assert.strictEqual(deletedResponse.status, 204);

  const listResponse = await fetch(`${base}/todos`, {
    headers: authHeaders
  });
  assert.deepStrictEqual(await listResponse.json(), []);
});
