export function normalizePath(pathname) {
  if (!pathname || pathname === '/') return '/';
  return pathname.replace(/\/+$/, '') || '/';
}

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
      return routes.find((route) => route.method === m && route.path === p);
    },
  };
}