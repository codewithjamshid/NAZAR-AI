// P4 Statistika (TZ §12): totals from GET /stats/region.

import { useEffect, useState } from "react";

import { api } from "../api/client";
import type { RegionStats } from "../api/types";
import { Disclaimer } from "../components/Disclaimer";
import { minutesText, msText, percent } from "../lib/format";
import { zoneWord } from "../lib/labels";
import { ZONE_HEX } from "../lib/zone";

function Card({
  title,
  value,
  hint,
  accent,
}: {
  title: string;
  value: string;
  hint?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-bold uppercase tracking-wide text-slate-500">{title}</div>
      <div className="mt-2 text-3xl font-bold tabular-nums" style={accent ? { color: accent } : undefined}>
        {value}
      </div>
      {hint ? <div className="mt-1 text-xs text-slate-600">{hint}</div> : null}
    </div>
  );
}

export function StatsPage() {
  const [stats, setStats] = useState<RegionStats | null>(null);
  const [days, setDays] = useState(7);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .regionStats(days)
      .then((value) => {
        if (!cancelled) {
          setStats(value);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Statistika olinmadi");
      });
    return () => {
      cancelled = true;
    };
  }, [days]);

  const totals = stats?.totals;
  const cases = totals?.cases ?? 0;
  const share = (count: number | undefined) =>
    cases > 0 && count !== undefined ? percent(count / cases, 0) : "—";

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold">Statistika</h1>
        <select
          className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm"
          value={days}
          onChange={(event) => setDays(Number(event.target.value))}
        >
          <option value={1}>Bugun</option>
          <option value={7}>7 kun</option>
          <option value={30}>30 kun</option>
        </select>
      </div>

      {error ? (
        <p className="mb-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card title="Holatlar" value={String(cases)} hint={days + " kunlik davr"} />
        <Card
          title={zoneWord("red") + " zona"}
          value={String(totals?.red ?? 0)}
          hint={share(totals?.red) + " — shoshilinch"}
          accent={ZONE_HEX.red}
        />
        <Card
          title={zoneWord("yellow") + " zona"}
          value={String(totals?.yellow ?? 0)}
          hint={share(totals?.yellow) + " — ehtiyot"}
          accent={ZONE_HEX.yellow}
        />
        <Card
          title={zoneWord("green") + " zona"}
          value={String(totals?.green ?? 0)}
          hint={share(totals?.green) + " — xavf past"}
          accent={ZONE_HEX.green}
        />
        <Card title="O'rtacha AI vaqti" value={msText(totals?.avg_ai_ms)} hint="tasvir o'qilgunicha" />
        <Card
          title="O'rtacha mutaxassis javobi"
          value={minutesText(totals?.avg_response_min)}
          hint="holat ochilishidan qarorgacha"
        />
        <Card
          title="AI xato ulushi"
          value={percent(totals?.ai_error_rate, 1)}
          hint={'"AI xato" bosilgan qarorlar'}
        />
        <Card title="Qarorlar" value={String(totals?.decisions ?? 0)} hint="mutaxassis qarorlari" />
      </div>

      <div className="mt-5 rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-3 py-2">Tuman</th>
              <th className="px-3 py-2">Holatlar</th>
              <th className="px-3 py-2">{zoneWord("red")}</th>
              <th className="px-3 py-2">{zoneWord("yellow")}</th>
              <th className="px-3 py-2">{zoneWord("green")}</th>
              <th className="px-3 py-2">O'rtacha javob</th>
            </tr>
          </thead>
          <tbody>
            {(stats?.districts ?? []).map((item) => (
              <tr key={item.district} className="border-t border-slate-200">
                <td className="px-3 py-2 font-medium">{item.district}</td>
                <td className="px-3 py-2 tabular-nums">{item.total}</td>
                <td className="px-3 py-2 tabular-nums text-red-700">{item.red}</td>
                <td className="px-3 py-2 tabular-nums text-amber-700">{item.yellow}</td>
                <td className="px-3 py-2 tabular-nums text-green-700">{item.green}</td>
                <td className="px-3 py-2">{minutesText(item.avg_response_min)}</td>
              </tr>
            ))}
            {(stats?.districts ?? []).length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                  Ma'lumot yo'q.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Disclaimer className="mt-4" />
    </div>
  );
}
