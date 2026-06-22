(function exposeApi(root) {
  function url(path, config = root.__SAJU_RUNTIME__ || {}) {
    const value = String(path || "");
    if (!value.startsWith("/api/")) return value;
    const base = String(config.apiBaseUrl || "").trim().replace(/\/+$/, "");
    return base ? `${base}${value}` : value;
  }

  function request(path, options = {}) {
    return root.fetch(url(path), { ...options, credentials: "include" });
  }

  root.SajuApi = { url, fetch: request };
})(globalThis);
