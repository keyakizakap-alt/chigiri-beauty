"use client";
import { useEffect, useState } from "react";

type Action = { specialist: string; title: string; detail: string; done?: boolean };
type Plan = { day: string; revision: number; actions: Action[] };
const storageKey = "chigiri-care-plans-v1";

function localDay() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function localPlans(): Plan[] {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) ?? "[]") as unknown;
    return Array.isArray(value)
      ? value.filter((plan): plan is Plan => Boolean(plan && typeof plan === "object" && Array.isArray((plan as Plan).actions)))
      : [];
  } catch {
    return [];
  }
}

function saveLocal(plans: Plan[]) {
  localStorage.setItem(storageKey, JSON.stringify(plans.slice(0, 30)));
}

export default function CarePlanTracker({ actions, serverSyncRequired }: { actions: Action[]; serverSyncRequired: boolean }) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [localOnly, setLocalOnly] = useState(false);
  const [day] = useState(localDay);
  const today = plans.find((plan) => plan.day === day);

  async function load() {
    try {
      const response = await fetch("/api/care-plans");
      if (!response.ok) throw new Error("server unavailable");
      const data = await response.json() as { plans?: Plan[] };
      setPlans(data.plans ?? []);
      setLocalOnly(false);
    } catch {
      if (serverSyncRequired) throw new Error("保存したプランを読み込めませんでした。");
      setPlans(localPlans());
      setLocalOnly(true);
    } finally {
      setReady(true);
    }
  }

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      void load().catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : "読み込めませんでした。");
      });
    }, 0);
    return () => { active = false; window.clearTimeout(timer); };
    // load is intentionally tied to the authentication mode.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverSyncRequired]);

  function mutateLocal(method: string, body?: { index?: number; done?: boolean }, targetDay?: string) {
    let next = [...plans];
    if (method === "POST") {
      next = [{ day, revision: 1, actions: actions.map((action) => ({ ...action, done: false })) }, ...next.filter((plan) => plan.day !== day)];
    }
    if (method === "PATCH" && today && body?.index != null) {
      next = next.map((plan) => plan.day === day
        ? { ...plan, revision: plan.revision + 1, actions: plan.actions.map((action, index) => index === body.index ? { ...action, done: body.done } : action) }
        : plan);
    }
    if (method === "DELETE" && targetDay) next = next.filter((plan) => plan.day !== targetDay);
    saveLocal(next);
    setPlans(next);
  }

  async function mutate(method: string, body?: { index?: number; done?: boolean }, targetDay?: string) {
    setBusy(true);
    setError("");
    try {
      if (localOnly) {
        mutateLocal(method, body, targetDay);
        return;
      }
      const payload = method === "POST"
        ? { day, actions }
        : method === "PATCH"
          ? { day, index: body?.index, done: body?.done, revision: today?.revision }
          : undefined;
      const response = await fetch(`/api/care-plans${targetDay ? `?day=${targetDay}` : ""}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: payload ? JSON.stringify(payload) : undefined,
      });
      if (!response.ok) throw new Error((await response.json()).error || "保存できませんでした。");
      await load();
    } catch (cause) {
      if (!serverSyncRequired) {
        setLocalOnly(true);
        mutateLocal(method, body, targetDay);
      } else {
        setError(cause instanceof Error ? cause.message : "保存できませんでした。");
      }
    } finally {
      setBusy(false);
    }
  }

  return <section className="care-tracker" aria-label="ケアの実行記録" aria-busy={busy}>
    <h3>決めたケアを、続ける</h3>
    <p>今日の提案を保存し、実行した項目を記録できます。</p>
    {localOnly ? <p className="care-storage-note">この端末に保存します</p> : null}
    {error ? <p role="alert">{error}</p> : null}
    {!ready || error ? <button type="button" disabled={busy} onClick={() => { setError(""); void load().catch((cause) => setError(cause instanceof Error ? cause.message : "読み込めませんでした。")); }}>再読み込み</button> : null}
    {ready && !today ? <button type="button" className="condition-save" disabled={busy} onClick={() => void mutate("POST")}>今日の提案を保存して始める</button> : null}
    {today ? <div>
      <p aria-live="polite">{today.actions.filter((action) => action.done).length} / {today.actions.length} 完了</p>
      {today.actions.map((action, index) => <label className="care-task" key={`${action.specialist}-${action.title}`}>
        <input type="checkbox" checked={Boolean(action.done)} disabled={busy} onChange={(event) => void mutate("PATCH", { index, done: event.target.checked })} />
        <span><strong>{action.title}</strong><small>{action.detail}</small></span>
      </label>)}
    </div> : null}
    {plans.length > 0 ? <details><summary>保存したケアを振り返る（直近30日分まで）</summary>
      {plans.map((plan) => <article key={plan.day}><strong>{plan.day} · {plan.actions.filter((action) => action.done).length}/{plan.actions.length} 完了</strong>
        <ul>{plan.actions.map((action, index) => <li key={index}>{action.done ? "実行済み" : "未実行"}：{action.title}</li>)}</ul>
        <button type="button" disabled={busy} onClick={() => { if (window.confirm(`${plan.day}のケア記録を削除しますか？`)) void mutate("DELETE", undefined, plan.day); }}>この記録を削除</button>
      </article>)}
    </details> : null}
    <small>記録は実行状況です。美容効果を判定するものではありません。</small>
  </section>;
}
