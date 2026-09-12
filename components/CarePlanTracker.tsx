"use client";
import { useEffect, useState } from 'react';
type Action = {specialist: string; title: string; detail: string; done?: boolean};
type Plan = {day: string; revision: number; actions: Action[]};
function localDay() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
}
export default function CarePlanTracker({actions}: {actions: Action[]}) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [day] = useState(localDay);
  const today = plans.find(p => p.day === day);
  async function load() {
    const response = await fetch('/api/care-plans');
    if (!response.ok) throw new Error('記録を読み込めませんでした。再読み込みしてください。');
    setPlans((await response.json()).plans);
    setReady(true);
  }
  useEffect(() => { let active = true; void fetch('/api/care-plans').then(async r => {
    if (!r.ok) throw new Error('保存したプランを読み込めませんでした。');
    const data = await r.json();
    if (active) { setPlans(data.plans); setReady(true); }
  }).catch(e => {if (active) setError(e.message);}); return () => {active = false;}; }, []);
  async function mutate(method: string, body?: object, targetDay?: string) {
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/care-plans${targetDay ? `?day=${targetDay}` : ''}`, {method, headers: {'Content-Type': 'application/json'}, body: body ? JSON.stringify(body) : undefined});
      if (!response.ok) throw new Error((await response.json()).error || '保存できませんでした。');
      await load();
    } catch (e) {setError(e instanceof Error ? e.message : '保存できませんでした。');}
    finally {setBusy(false);}
  }
  return <section className="care-tracker" aria-label="ケアの実行記録" aria-busy={busy}>
    <h3>決めたケアを、続ける</h3>
    <p>今日の提案を保存し、実行した項目を記録できます。記録はこの利用者の履歴に保存されます。</p>
    {error && <p role="alert">{error}</p>}
    {(!ready || error) && <button type="button" disabled={busy} onClick={() => {setError(''); void load().catch(e => setError(e.message));}}>再読み込み</button>}
    {ready && !today && <button type="button" className="condition-save" disabled={busy} onClick={() => void mutate('POST', {day, actions})}>今日の提案を保存して始める</button>}
    {today && <div>
      <p aria-live="polite">{today.actions.filter(a => a.done).length} / {today.actions.length} 完了</p>
      {today.actions.map((a,i) => <label className="care-task" key={i}>
        <input type="checkbox" checked={!!a.done} disabled={busy} onChange={e => void mutate('PATCH', {day, index:i, done:e.target.checked, revision:today.revision})}/>
        <span><strong>{a.title}</strong><small>{a.detail}</small></span>
      </label>)}
    </div>}
    {plans.length > 0 && <details><summary>保存したケアを振り返る（直近30日分まで）</summary>
      {plans.map(p => <article key={p.day}><strong>{p.day} · {p.actions.filter(a => a.done).length}/{p.actions.length} 完了</strong>
        <ul>{p.actions.map((a,i) => <li key={i}>{a.done ? '実行済み' : '未実行'}：{a.title}</li>)}</ul>
        <button type="button" disabled={busy} onClick={() => {if (window.confirm(`${p.day}のケア記録を削除しますか？`)) void mutate('DELETE', undefined, p.day);}}>この記録を削除</button>
      </article>)}
    </details>}
    <small>記録は実行状況です。美容効果を判定するものではありません。</small>
  </section>;
}
