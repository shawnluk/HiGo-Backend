import { ok } from '../lib/http.js';
import { listMessages } from '../services/message-service.js';

export function registerMessageRoutes(router) {
  router.get('/api/v1/messages', ({ query, res }) => {
    ok(res, listMessages(query));
  });
}