import { ok } from '../lib/http.js';
import { login } from '../services/auth-service.js';

export function registerAuthRoutes(router) {
  router.post('/api/v1/auth/login', ({ body, config, res }) => {
    ok(res, login(body, config));
  });
}