const { createApp } = require('./app');
const { getConfig } = require('./config');

const config = getConfig();
const server = createApp(config);

server.listen(config.port, config.host, () => {
  console.log(`UnitOne backend listening on http://${config.host}:${config.port}`);
});

function shutdown(signal) {
  console.log(`${signal} received, shutting down`);
  server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
