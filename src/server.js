import 'dotenv/config';
import { createApp } from './app.js';
import { getConfig } from './config.js';
import { closePool } from './lib/db.js';

const config = getConfig();
const server = createApp(config);

server.listen(config.port, config.host, () => {
  console.log(`UnitOne backend listening on http://${config.host}:${config.port}`);
});

async function shutdown(signal) {
  console.log(`${signal} received, shutting down`);
  await closePool();
  server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);