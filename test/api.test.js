import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../src/app.js';

function startServer() {
  const server = createApp({
    corsOrigin: '*',
    jwtSecret: 'test-secret',
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        baseUrl: `http://127.0.0.1:${port}`,
        close: () => new Promise((done) => server.close(done)),
      });
    });
  });
}

function requestJson(baseUrl, path, options = {}) {
  const url = new URL(path, baseUrl);
  const body = options.body ? JSON.stringify(options.body) : null;

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: `${url.pathname}${url.search}`,
        method: options.method || 'GET',
        headers: {
          ...(body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {}),
          ...(options.headers || {}),
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
            resolve({ statusCode: res.statusCode, body: parsed });
          } catch (error) {
            reject(error);
          }
        });
      },
    );

    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function run(name, fn) {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

async function main() {
  await run('health returns the shared response envelope', async () => {
    const app = await startServer();
    try {
      const { statusCode, body } = await requestJson(app.baseUrl, '/health');
      assert.equal(statusCode, 200);
      assert.equal(body.code, 0);
      assert.equal(body.success, true);
      assert.equal(body.data.status, 'ok');
    } finally {
      await app.close();
    }
  });

  await run('activities match the frontend card contract', async () => {
    const app = await startServer();
    try {
      const { body } = await requestJson(app.baseUrl, '/api/v1/activities');
      assert.ok(Array.isArray(body.data));
      assert.ok(body.data.length >= 1);
      assert.equal(typeof body.data[0].title, 'string');
      assert.equal(typeof body.data[0].location_text, 'string');
      assert.ok(Array.isArray(body.data[0].joinAvatars));
    } finally {
      await app.close();
    }
  });

  await run('activity creation maps frontend form fields to list fields', async () => {
    const app = await startServer();
    try {
      const { statusCode, body } = await requestJson(app.baseUrl, '/api/v1/activities', {
        method: 'POST',
        body: {
          title: '测试活动',
          type: '户外出游',
          time: '2026-05-22 19:30',
          location: '深圳湾公园',
          price: '30',
          description: '<p>一起散步</p>',
        },
      });

      assert.equal(statusCode, 201);
      assert.equal(body.data.title, '测试活动');
      assert.equal(body.data.tagText, '户外');
      assert.equal(body.data.time_text, '2026-05-22 19:30:00');
      assert.deepEqual(body.data.detail_paragraphs, ['一起散步']);
    } finally {
      await app.close();
    }
  });

  await run('login accepts the frontend demo credentials flow', async () => {
    const app = await startServer();
    try {
      const { statusCode, body } = await requestJson(app.baseUrl, '/api/v1/auth/login', {
        method: 'POST',
        body: { username: 'shawn', password: 'demo' },
      });

      assert.equal(statusCode, 200);
      assert.equal(body.data.displayName, 'shawn');
      assert.match(body.data.token, /^[^.]+\.[^.]+\.[^.]+$/);
    } finally {
      await app.close();
    }
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});