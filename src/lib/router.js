/**
 * 规范化路径字符串。
 * 输入为根路径或空值时返回 '/'；否则去除末尾多余的斜杠以保证路径只保留一个结尾分隔符。
 * @param {string} pathname 原始路径
 * @returns {string} 规范化后的路径，至少为 '/'
 */
export function normalizePath(pathname) {
  if (!pathname || pathname === '/') return '/';
  return pathname.replace(/\/+$/, '') || '/';
}

/**
 * 创建一个路由注册与匹配器。
 * 提供 get / post 注册 GET、POST 路由；match 按方法与路径匹配请求，并提取路径参数。
 *
 * 路径匹配规则：
 * - 字面量路径要求完全一致；
 * - 支持以 ':' 开头的动态参数段（如 /users/:id），该段会被通配并记入 params，
 *   动态匹配要求路由段数与请求段数一致；
 * - 匹配成功返回 { ...route, params }，params 为动态参数映射；未命中返回 null。
 * @returns {{get:Function,post:Function,match:Function}} 路由对象
 */
export function createRouter() {
  const routes = [];

  function add(method, path, handler) {
    routes.push({
      method: method.toUpperCase(),
      path: normalizePath(path),
      handler,
    });
  }

  return {
    get: (path, handler) => add('GET', path, handler),
    post: (path, handler) => add('POST', path, handler),
    match(method, pathname) {
      const m = method.toUpperCase();
      const p = normalizePath(pathname);
      const pSegs = p.split('/');
      for (const route of routes) {
        if (route.method !== m) continue;

        if (!route.path.includes(':')) {
          if (route.path === p) return route;
          continue;
        }

        const rSegs = route.path.split('/');
        if (rSegs.length !== pSegs.length) continue;

        const params = {};
        let matched = true;
        for (let i = 0; i < rSegs.length; i++) {
          if (rSegs[i].startsWith(':')) {
            params[rSegs[i].slice(1)] = pSegs[i];
          } else if (rSegs[i] !== pSegs[i]) {
            matched = false;
            break;
          }
        }
        if (matched) return { ...route, params };
      }
      return null;
    },
  };
}