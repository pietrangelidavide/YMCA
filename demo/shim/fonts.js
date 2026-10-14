module.exports = new Proxy({}, { get: (t, k) => (k === '__esModule' ? false : String(k)) });
