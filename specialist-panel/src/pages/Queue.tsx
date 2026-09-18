// P1 Navbat (TZ §12, F-12): red first, then yellow, then green; oldest waits on
// top inside a zone. Red rows pulse until a decision exists.

import { useNavigate } from "react-router-dom";

import type { QueueItem } from "../api/types";
import { Disclaimer } from "../components/Disclaimer";
import { StrokeTimer } from "../components/StrokeTimer";
import { ZoneBadge } from "../components/ZoneBadge";
import { minutesText, timeOfDay } from "../lib/format";
import { SPECIALIST_UZ, STATUS_UZ } from "../lib/labels";
import { zoneStyle } from "../lib/zone";
import { useQueue } from "../state/queue";
import { useSession } from "../state/session";

function readersText(value: boolean | null): string {
  if (value === true) return "ikki o'quvchi kelishdi";
  if (value === false) return "o'quvchilar kelishmadi";
  return "solishtirib bo'lmadi";
}

function Row({ item, onOpen }: { item: QueueItem; onOpen: (id: number) => void }) {
  const style = zoneStyle(item.zone);
  const pulsing = item.zone === "red" && !item.has_decision;
  return (
    <tr
      className={
        "cursor-pointer border-b border-slate-200 align-top hover:bg-slate-100 " +
        (pulsing ? "row-pulse" : style.row)
      }
      onClick={() => onOpen(item.case_id)}
    >
      <td className="px-3 py-3">
        <ZoneBadge zone={item.zone} withHint />
        <div className="mt-1 text-xs text-slate-600">#{item.case_id}</div>
      </td>
      <td className="px-3 py-3 text-sm">
        <div className="font-medium text-slate-900">{item.district ?? "—"}</div>
        <div className="text-xs text-slate-600">{item.facility_name ?? "—"}</div>
      </td>
      <td className="px-3 py-3 text-sm">
        <div className="font-medium">{item.age !== null ? item.age + " yosh" : "—"}</div>
        <div className="text-xs text-slate-600">
          {item.sex === "male" ? "erkak" : item.sex === "female" ? "ayol" : "—"}
        </div>
      </td>
      <td className="max-w-[520px] px-3 py-3 text-sm">
        <div className="line-clamp-2 text-slate-900">{item.summary ?? "AI xulosasi yo'q"}</div>
        <div className="mt-1 text-xs text-slate-600">
          {STATUS_UZ[item.status] ?? item.status} · {readersText(item.readers_agree)}
        </div>
      </td>
      <td className="px-3 py-3 text-sm">
        {item.specialist_type ? SPECIALIST_UZ[item.specialist_type] ?? item.specialist_type : "—"}
      </td>
      <td className="whitespace-nowrap px-3 py-3 text-sm">
        <div className="font-medium">{minutesText(item.waiting_min)}</div>
        <div className="text-xs text-slate-600">{timeOfDay(item.created_at)} dan</div>
      </td>
      <td className="px-3 py-3">
        {item.time_window_min !== null || item.stroke?.onset_at ? (
          <StrokeTimer stroke={item.stroke} timeWindowMin={item.time_window_min} compact />
        ) : (
          <span className="text-xs text-slate-500">—</span>
        )}
      </td>
      <td className="px-3 py-3 text-right">
        <span className="rounded bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white">
          Ochish
        </span>
      </td>
    </tr>
  );
}

export function QueuePage() {
  const navigate = useNavigate();
  const { user } = useSession();
  const {
    visibleItems, loading, error, mine, setMine, districtFilter, setDistrictFilter, refresh,
  } = useQueue();

  const open = (id: number) => navigate("/holat/" + id);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold">Navbat</h1>
        <span className="text-sm text-slate-600">{visibleItems.length} ta holat</span>

        <label className="ml-4 flex items-center gap-2 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm">
          <input
            type="checkbox"
            checked={mine}
            onChange={(event) => setMine(event.target.checked)}
            disabled={!user?.specialty}
          />
          Mening mutaxassisligim
          {user?.specialty ? (
            <span className="text-xs text-slate-500">
              ({SPECIALIST_UZ[user.specialty] ?? user.specialty})
            </span>
          ) : null}
        </label>

        {districtFilter ? (
          <button
            type="button"
            onClick={() => setDistrictFilter(null)}
            className="rounded border border-slate-400 bg-white px-3 py-1.5 text-sm"
          >
            Tuman filtri: <b>{districtFilter}</b> ✕
          </button>
        ) : null}

        <button
          type="button"
          onClick={() => void refresh()}
          className="ml-auto rounded border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
        >
          {loading ? "Yangilanmoqda..." : "Yangilash"}
        </button>
      </div>

      {error ? (
        <p className="mb-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full border-collapse">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-3 py-2">Zona</th>
              <th className="px-3 py-2">Tuman / muassasa</th>
              <th className="px-3 py-2">Bemor</th>
              <th className="px-3 py-2">AI xulosasi</th>
              <th className="px-3 py-2">Mutaxassis</th>
              <th className="px-3 py-2">Kutish</th>
              <th className="px-3 py-2">Insult taymeri</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {visibleItems.map((item) => (
              <Row key={item.case_id} item={item} onOpen={open} />
            ))}
            {visibleItems.length === 0 && !loading ? (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-sm text-slate-500">
                  Navbat bo'sh.
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
