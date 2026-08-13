/**
 * 予算の読み取りはチャット画面とサーバーの両方で使うため、ここに一本化する。
 * 要点は2つ。
 * - 「0円」単体だけを買い足しなしとして扱い、「3000円」のような部分一致で
 *   予算ゼロと誤判定しない。
 * - 「円」が付かない言い方（5000まで、予算8000）も拾う。ただし裸の数字は
 *   年号や個数と紛らわしいので、予算を指す語と一緒に現れたときだけ採用する。
 */

const noPurchasePattern = /買いたくない|買い足さない|買い足し[はもを]?\s*(なし|しない|不要)|(^|[^\d])0\s*円/;
const yenAmountPattern = /(\d{3,5})\s*円/g;
// 「予算8000」「8000まで」「8000以内」など、円を伴わない言い方。
const impliedAmountPattern = /予算[^\d]{0,4}(\d{3,5})|(\d{3,5})\s*(?:まで|以内|以下|くらい|ぐらい|前後)/g;

/**
 * @param {string} text
 * @param {number} fallback 金額が読み取れなかったときの既定値
 * @returns {number} 円単位の予算。0 は「買い足しなし」を表す
 */
export function budgetFromText(text, fallback) {
  const source = text.replace(/,/g, "");
  if (noPurchasePattern.test(source)) return 0;

  const yenAmounts = [...source.matchAll(yenAmountPattern)].map((match) => Number(match[1]));
  if (yenAmounts.length) return yenAmounts[yenAmounts.length - 1];

  const impliedAmounts = [...source.matchAll(impliedAmountPattern)]
    .map((match) => Number(match[1] ?? match[2]))
    .filter((value) => Number.isFinite(value));
  if (impliedAmounts.length) return impliedAmounts[impliedAmounts.length - 1];

  return fallback;
}

export { noPurchasePattern };
