/**
 * 予算の読み取りはチャット画面とサーバーの両方で使うため、ここに一本化する。
 * 「0円」だけを買い足しなしとして扱い、「3000円」のような部分一致で
 * 予算ゼロと誤判定しないことがこの実装の要点。
 */

const noPurchasePattern = /買いたくない|買い足さない|買い足し[はもを]?\s*(なし|しない|不要)|(^|[^\d])0\s*円/;
const amountPattern = /(\d{3,5})\s*円/g;

/**
 * @param {string} text
 * @param {number} fallback 金額が読み取れなかったときの既定値
 * @returns {number} 円単位の予算。0 は「買い足しなし」を表す
 */
export function budgetFromText(text, fallback) {
  const source = text.replace(/,/g, "");
  if (noPurchasePattern.test(source)) return 0;
  const values = [...source.matchAll(amountPattern)].map((match) => Number(match[1]));
  return values.at(-1) ?? fallback;
}

export { noPurchasePattern };
