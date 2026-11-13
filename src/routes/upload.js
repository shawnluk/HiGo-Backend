import { ok } from '../lib/http.js';
import { buildCosUploadPolicy, getCosCredentials } from '../lib/sts.js';

// 临时密钥有效期（秒）
const CREDENTIALS_EXPIRES = 1800;

/**
 * 注册文件上传相关的路由。
 *
 * - POST `/api/v1/upload/credentials` → 为当前用户换取 COS 临时密钥（STS）。
 *   前端拿到临时密钥后，用 COS SDK 直传到 `user-avatar/<userId>/` 前缀下，
 *   再把得到的 URL 传给资料修改接口的 `avatar` 字段。
 *
 * @param {import('../lib/router.js').Router} router 路由实例，用于挂载接口。
 */
export function registerUploadRoutes(router) {
  router.post('/api/v1/upload/credentials', async ({ config, req, res }) => {
    const userId = Number(req.user?.sub) || 0;
    if (!userId) {
      const error = new Error('请先登录');
      error.statusCode = 401;
      throw error;
    }

    const { cosSecretId, cosSecretKey, cosBucket, cosRegion } = config;
    if (!cosSecretId || !cosSecretKey) {
      const error = new Error('COS 上传未配置');
      error.statusCode = 500;
      throw error;
    }

    const prefix = `user-avatar/${userId}/`;
    const appid = cosBucket.split('-').pop();
    const policy = buildCosUploadPolicy({
      bucket: cosBucket,
      region: cosRegion,
      appid,
      prefix,
    });

    const credentials = await getCosCredentials({
      secretId: cosSecretId,
      secretKey: cosSecretKey,
      region: cosRegion,
      name: `unitone-avatar-${userId}`,
      policy,
      durationSeconds: CREDENTIALS_EXPIRES,
    });

    ok(
      res,
      {
        ...credentials,
        bucket: cosBucket,
        region: cosRegion,
        prefix,
      },
      'ok',
    );
  });
}
