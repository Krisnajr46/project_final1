const { createApp } = require('./app');
const { pgStore } = require('./store');

(async () => {
  const store = await pgStore(process.env.DATABASE_URL);
  createApp(store).listen(3000, () => console.log(JSON.stringify({ msg: 'backend listening on :3000' })));
})().catch(e => { console.error(e); process.exit(1); });
