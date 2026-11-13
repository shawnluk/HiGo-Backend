import crypto from 'node:crypto';
import https from 'node:https';

/**
 * 腾讯云 STS（临时密钥）工具：基于原生 crypto 与 https 实现，零第三方依赖。
 * 后端用主密钥（SecretId/SecretKey）调用 GetFederationToken，换取受限的临时密钥给前端，
 * 前端再用临时密钥直传 COS。主密钥不出后端。
 */

const STS_HOST = 'sts.tencentcloudapi.com';
const STS_SERVICE = 'sts';
const STS_VERSION = '2018-08-13';
const STS_ACTION = 'GetFederationToken';

function sha256Hex(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function hmacSha256(key, value) {
  return crypto.createHmac('sha256', key).update(value).digest();
}

/**
 * 计算腾讯云 API 3.0（TC3-HMAC-SHA256）签名的 Authorization 头。
 * @returns {string} Authorization 头值
 */
function signTc3({ secretId, secretKey, host, service, action, payload, timestamp, region }) {
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10);

  const canonicalHeaders =
    `content-type:application/json; charset=utf-8\n` +
    `host:${host}\n` +
    `x-tc-action:${action.toLowerCase()}\n` +
    `x-tc-region:${region}\n`;
  const signedHeaders = 'content-type;host;x-tc-action;x-tc-region';
  const hashedPayload = sha256Hex(payload);

  const canonicalRequest = [
    'POST',
    '/',
    '',
    canonicalHeaders,
    signedHeaders,
    hashedPayload,
  ].join('\n');

  const credentialScope = `${date}/${service}/tc3_request`;
  const stringToSign =
    `TC3-HMAC-SHA256\n${timestamp}\n${credentialScope}\n${sha256Hex(canonicalRequest)}`;

  const secretDate = hmacSha256(`TC3${secretKey}`, date);
  const secretService = hmacSha256(secretDate, service);
  const secretSigning = hmacSha256(secretService, 'tc3_request');
  const signature = crypto
    .createHmac('sha256', secretSigning)
    .update(stringToSign)
    .digest('hex');

  return (
    `TC3-HMAC-SHA256 Credential=${secretId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`
  );
}

/**
 * 调用腾讯云 STS API（原生 https）。
 * @returns {Promise<object>} STS 返回的完整 JSON 对象
 */
function requestSts({ secretId, secretKey, payload, region }) {
  const timestamp = Math.floor(Date.now() / 1000);
  const body = JSON.stringify(payload);
  const authorization = signTc3({
    secretId,
    secretKey,
    host: STS_HOST,
    service: STS_SERVICE,
    action: STS_ACTION,
    payload: body,
    timestamp,
    region,
  });

  const options = {
    method: 'POST',
    host: STS_HOST,
    path: '/',
    headers: {
      Authorization: authorization,
      'Content-Type': 'application/json; charset=utf-8',
      Host: STS_HOST,
      'X-TC-Action': STS_ACTION,
      'X-TC-Timestamp': String(timestamp),
      'X-TC-Version': STS_VERSION,
      'X-TC-Region': region,
      'Content-Length': Buffer.byteLength(body),
    },
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        let json;
        try {
          json = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        } catch (error) {
          const err = new Error('STS 响应解析失败');
          err.statusCode = 500;
          reject(err);
          return;
        }
        resolve(json);
      });
    });

    req.on('error', () => {
      const err = new Error('STS 请求失败');
      err.statusCode = 500;
      reject(err);
    });

    req.write(body);
    req.end();
  });
}

/**
 * 获取 COS 上传所需的临时密钥。
 *
 * @param {object} options
 * @param {string} options.secretId 腾讯云主账号 SecretId
 * @param {string} options.secretKey 腾讯云主账号 SecretKey
 * @param {string} options.region 地域（如 ap-guangzhou）
 * @param {string} options.name 临时凭证名称
 * @param {object} options.policy 授权策略对象（限定 Bucket/路径/操作）
 * @param {number} [options.durationSeconds=1800] 有效期（秒）
 * @returns {Promise<object>} { tmpSecretId, tmpSecretKey, token, expiredTime }
 */
export async function getCosCredentials({
  secretId,
  secretKey,
  region,
  name,
  policy,
  durationSeconds = 1800,
}) {
  const result = await requestSts({
    secretId,
    secretKey,
    region,
    payload: {
      Name: name,
      Policy: JSON.stringify(policy),
      DurationSeconds: durationSeconds,
    },
  });

  const resp = result && result.Response;
  if (!resp || resp.Error) {
    const error = new Error((resp && resp.Error && resp.Error.Message) || '获取临时密钥失败');
    error.statusCode = 500;
    throw error;
  }

  return {
    tmpSecretId: resp.Credentials.TmpSecretId,
    tmpSecretKey: resp.Credentials.TmpSecretKey,
    token: resp.Credentials.Token,
    expiredTime: resp.ExpiredTime,
  };
}

/**
 * 构建限定到指定 COS 路径的授权策略（仅允许上传）。
 *
 * @param {object} options
 * @param {string} options.bucket 存储桶名称（含 APPID，如 unitone-1310134019）
 * @param {string} options.region 地域（如 ap-guangzhou）
 * @param {string} options.appid 账号 APPID（从 bucket 名末尾解析）
 * @param {string} options.prefix 对象键前缀（如 avatar/1/）
 * @returns {object} 策略对象
 */
export function buildCosUploadPolicy({ bucket, region, appid, prefix }) {
  return {
    version: '2.0',
    statement: [
      {
        effect: 'allow',
        action: ['name/cos:PutObject', 'name/cos:PostObject'],
        resource: [`qcs::cos:${region}:uid/${appid}:${bucket}/${prefix}*`],
      },
    ],
  };
}
