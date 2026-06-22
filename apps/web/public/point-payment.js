(function initPointPayment(root) {
  function nonNegativeInteger(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : 0;
  }

  function fullUse(balance, price) {
    return Math.min(nonNegativeInteger(balance), nonNegativeInteger(price));
  }

  root.PointPayment = { fullUse };
})(typeof window !== "undefined" ? window : globalThis);
