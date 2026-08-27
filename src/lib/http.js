const MAX_BODY_BYTES = 1024 * 1024;

/**
 * 设置跨域（CORS）响应头。
 * 根据配置写入 Allow-Origin / Allow-Methods / Allow-Headers，便于客户端跨源调用接口。
 * @param {import('http').ServerResponse} res 响应对象
 * @param {{corsOrigin?:string}} config CORS 配置，未配置时放行所有来源（*）
 */
export function setCorsHeaders(res, config) {
  res.setHeader('Access-Control-Allow-Origin', config.corsOrigin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

/**
 * 以 JSON 格式向客户端发送响应。
 * 将 payload 序列化为 JSON，设置 application/json 头部并写入响应体后结束本次请求。
 * @param {import('http').ServerResponse} res 响应对象
 * @param {number} statusCode HTTP 状态码
 * @param {any} payload 要发送的数据对象
 */
export function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

/**
 * 发送成功响应。
 * 返回统一结构 {code:0, success:true, message, data}，data 为业务数据。
 * @param {import('http').ServerResponse} res 响应对象
 * @param {any} data 业务数据
 * @param {string} [message='ok'] 提示信息
 * @param {number} [statusCode=200] HTTP 状态码
 */
export function ok(res, data, message = 'ok', statusCode = 200) {
  sendJson(res, statusCode, {
    code: 0,
    success: true,
    message,
    data,
  });
}

/**
 * 发送失败响应。
 * 返回统一结构 {code, success:false, message, data:null}，code 默认与 HTTP 状态码一致。
 * @param {import('http').ServerResponse} res 响应对象
 * @param {number} statusCode HTTP 状态码
 * @param {string} message 错误提示信息
 * @param {number} [code=statusCode] 业务错误码
 */
export function fail(res, statusCode, message, code = statusCode) {
  sendJson(res, statusCode, {
    code,
    success: false,
    message,
    data: null,
  });
}

/**
 * 异步读取并解析请求体中的 JSON 数据。
 * 逐块累计请求体大小，超过 1MB 上限时以 413 错误拒绝；空请求体返回空对象；
 * JSON 解析失败时以 400 错误拒绝。
 * @param {import('http').IncomingMessage} req 请求对象
 * @returns {Promise<object>} 解析后的 JSON 对象
 */
export function readJsonBody(req) {
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

/**
 * 将 URLSearchParams 转换为纯对象。
 * 相同查询参数名出现多次时收集为数组（第一次出现为字符串，之后聚合成数组）。
 * @param {URLSearchParams} searchParams 查询参数字符串解析对象
 * @returns {Record<string, string|string[]>} 普通查询参数对象
 */
export function queryObject(searchParams) {
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