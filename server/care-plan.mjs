/** @param {unknown} value */
export function validPlanActions(value) {
  return Array.isArray(value) && value.length >= 1 && value.length <= 8 && value.every(a =>
    a && typeof a === 'object' && ['skin','hair','body','makeup','nail'].includes(a.specialist)
    && typeof a.title === 'string' && a.title.trim().length > 0 && a.title.length <= 100
    && typeof a.detail === 'string' && a.detail.length <= 500);
}
/** @param {string} owner @param {number} now */
export function chatLimits(owner, now) {
  return [
    { key: `minute:${owner}`, window: Math.floor(now / 60000), limit: 10 },
    { key: `day:${owner}`, window: Math.floor(now / 86400000), limit: owner.startsWith('user:') ? 100 : 20 },
    { key: 'day:global', window: Math.floor(now / 86400000), limit: 1000 },
  ];
}
