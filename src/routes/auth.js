import { ok } from '../lib/http.js';
import { login, register } from '../services/auth-service.js';

export function registerAuthRoutes(router) {
  router.post('/api/v1/auth/register', async ({ body, config, res }) => {
    ok(res, await register(body, config), 'registered', 201);
  });

  router.post('/api/v1/auth/login', async ({ body, config, res }) => {
    ok(res, await login(body, config));
  });
}