// P2 decision block (TZ §6 F-16, F-17, F-18). No case closes without this.

import { useState } from "react";

import { api } from "../api/client";
import type { CaseDetail, DecisionAction, Route } from "../api/types";
import { dateTime } from "../lib/format";
import { ACTION_UZ, ROUTE_UZ, specialist as specialistUz } from "../lib/labels";

const ACTIONS: { value: DecisionAction; label: string; className: string }[] = [
  { value: "confirm", label: "Tasdiqlash", className: "bg-green-600 hover:bg-green-700" },
  { value: "modify", label: "O'zgartirish", className: "bg-amber-600 hover:bg-amber-700" },
  { value: "reject_ai", label: "AI xato", className: "bg-slate-700 hover:bg-slate-800" },
];

const ROUTES: Route[] = ["onsite", "district", "regional"];

export function DecisionPanel({
  detail,
  onDecided,
}: {
  detail: CaseDetail;
  onDecided: (updated: CaseDetail) => void;
}) {
  const [action, setAction] = useState<DecisionAction>("confirm");
  const [route, setRoute] = useState<Route>((detail.route as Route) ?? "regional");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const noteRequired = action === "modify";
  const closed = detail.status === "closed";

  const submit = async () => {
    if (noteRequired && !note.trim()) {
      setError("O'zgartirish uchun izoh yozing");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const updated = await api.decide(detail.id, {
        action,
        note: note.trim() || undefined,
        route_final: route,
      });
      setNote("");
      onDecided(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Qaror saqlanmadi");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border-2 border-slate-900 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-900">
        Mutaxassis qarori
      </h3>

      {detail.decisions.length > 0 ? (
        <ul className="mb-4 space-y-2">
          {detail.decisions.map((decision) => (
            <li key={decision.id} className="rounded border border-slate-200 bg-slate-50 p-2 text-sm">
              <div className="font-semibold text-slate-900">
                {ACTION_UZ[decision.action] ?? decision.action}
                {decision.route_final ? " · " + (ROUTE_UZ[decision.route_final] ?? decision.route_final) : ""}
              </div>
              <div className="text-xs text-slate-600">
                {decision.specialist_name ?? "—"}
                {decision.specialty ? " (" + specialistUz(decision.specialty) + ")" : ""} ·{" "}
                {dateTime(decision.decided_at)}
              </div>
              {decision.note ? <p className="mt-1 text-slate-800">{decision.note}</p> : null}
            </li>
          ))}
        </ul>
      ) : null}

      {closed ? (
        <p className="rounded bg-slate-100 px-3 py-2 text-sm text-slate-600">
          Holat yopilgan, yangi qaror qabul qilinmaydi.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {ACTIONS.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setAction(item.value)}
                className={
                  "rounded px-4 py-2 text-sm font-semibold text-white " +
                  item.className +
                  (action === item.value ? " ring-2 ring-slate-900 ring-offset-2" : " opacity-70")
                }
              >
                {item.label}
              </button>
            ))}
          </div>

          <label className="mt-4 block text-xs font-bold uppercase tracking-wide text-slate-500">
            Yo'naltirish
          </label>
          <div className="mt-1 flex flex-wrap gap-2">
            {ROUTES.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setRoute(value)}
                className={
                  "rounded border px-3 py-1.5 text-sm " +
                  (route === value
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50")
                }
              >
                {ROUTE_UZ[value]}
              </button>
            ))}
          </div>

          <label
            className="mt-4 block text-xs font-bold uppercase tracking-wide text-slate-500"
            htmlFor="decision-note"
          >
            Ko'rsatma {noteRequired ? <span className="text-red-600">(majburiy)</span> : "(ixtiyoriy)"}
          </label>
          <textarea
            id="decision-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            placeholder="Masalan: Viloyatga transport, trombolizisga tayyorlansin"
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
          />

          {error ? (
            <p className="mt-2 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy}
            className="mt-3 w-full rounded bg-slate-900 px-4 py-3 text-base font-bold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {busy ? "Yuborilmoqda..." : "Yuborish"}
          </button>
        </>
      )}
    </div>
  );
}
