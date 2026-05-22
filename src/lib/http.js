const MAX_BODY_BYTES = 1024 * 1024;

function setCorsHeaders(res, config) {
  res.setHeader('Access-Control-Allow-Origin', config.corsOrigin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function ok(res, data, message = 'ok', statusCode = 200) {
  sendJson(res, statusCode, {
    code: 0,
    success: true,
    message,
    data,
  });
}

function fail(res, statusCode, message, code = statusCode) {
  sendJson(res, statusCode, {
    code,
    success: false,
    message,
    data: null,
  });
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;

    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > MAX_BODY_BYTES) {
        const err = new Error('Request body is too large');
        err.statusCode = 413;
        reject(err);
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      if (!chunks.length) {
        resolve({});
        return;
      }

      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw.trim()) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        error.statusCode = 400;
        error.message = 'Invalid JSON body';
        reject(error);
      }
    });

    req.on('error', reject);
  });
}

function queryObject(searchParams) {
  const query = {};
  for (const [key, value] of searchParams.entries()) {
    if (query[key] === undefined) {
      query[key] = value;
    } else if (Array.isArray(query[key])) {
      query[key].push(value);
    } else {
      query[key] = [query[key], value];
    }
  }
  return query;
}

module.exports = {
  fail,
  ok,
  queryObject,
  readJsonBody,
  sendJson,
  setCorsHeaders,
};
