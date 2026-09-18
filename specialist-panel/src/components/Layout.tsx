// Panel shell: navigation, live-connection state and the red-case banner
// that lights up at the top when a new urgent case arrives (TZ §12 P1).

import type { ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";

import { SPECIALIST_UZ } from "../lib/labels";
import { unlockAudio } from "../lib/alert";
import { useQueue } from "../state/queue";
import { useSession } from "../state/session";
import { ZoneBadge } from "./ZoneBadge";

const NAV = [
  { to: "/", label: "Navbat", end: true },
  { to: "/xarita", label: "Xarita", end: false },
  { to: "/statistika", label: "Statistika", end: false },
];

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout, meta } = useSession();
  const { connected, alert, dismissAlert, items } = useQueue();
  const navigate = useNavigate();

  const redWaiting = items.filter((item) => item.zone === "red" && !item.has_decision).length;

  return (
    <div className="min-h-screen bg-slate-100" onClick={unlockAudio}>
      <header className="bg-slate-900 text-white">
        <div className="mx-auto flex max-w-[1800px] items-center gap-6 px-6 py-3">
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold">NAZAR AI</span>
            <span className="text-xs text-slate-300">Mutaxassis paneli</span>
          </div>

          <nav className="flex gap-1">
            {NAV.map((entry) => (
              <NavLink
                key={entry.to}
                to={entry.to}
                end={entry.end}
                className={({ isActive }) =>
                  "rounded px-3 py-1.5 text-sm font-medium " +
                  (isActive ? "bg-white text-slate-900" : "text-slate-200 hover:bg-slate-800")
                }
              >
                {entry.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-4 text-xs">
            {redWaiting > 0 ? (
              <span className="rounded bg-red-600 px-2 py-1 font-bold">
                QIZIL kutmoqda: {redWaiting}
              </span>
            ) : null}
            <span className="flex items-center gap-1.5" title="Real-time ulanish holati">
              <span
                aria-hidden="true"
                className={"h-2 w-2 rounded-full " + (connected ? "bg-green-400" : "bg-slate-500")}
              />
              {connected ? "Jonli ulanish" : "Ulanish yo'q"}
            </span>
            {meta?.rules_version ? (
              <span className="text-slate-400">Qoidalar: {meta.rules_version}</span>
            ) : null}
            <span className="text-slate-200">
              {user?.full_name}
              {user?.specialty ? " · " + (SPECIALIST_UZ[user.specialty] ?? user.specialty) : ""}
            </span>
            <button
              type="button"
              onClick={() => {
                logout();
                navigate("/kirish", { replace: true });
              }}
              className="rounded border border-slate-600 px-2 py-1 hover:bg-slate-800"
            >
              Chiqish
            </button>
          </div>
        </div>
      </header>

      {alert ? (
        <div className="border-b-4 border-red-700 bg-red-600 text-white">
          <div className="mx-auto flex max-w-[1800px] items-center gap-4 px-6 py-3">
            <ZoneBadge zone="red" withHint />
            <div className="text-sm">
              <span className="font-bold">Yangi shoshilinch holat #{alert.case_id}</span>
              <span className="ml-2 opacity-90">
                {[alert.district, alert.facility_name, alert.age ? alert.age + " yosh" : null]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
              {alert.summary ? <div className="opacity-90">{alert.summary}</div> : null}
            </div>
            <div className="ml-auto flex gap-2">
              <button
                type="button"
                onClick={() => {
                  dismissAlert();
                  navigate("/holat/" + alert.case_id);
                }}
                className="rounded bg-white px-3 py-1.5 text-sm font-semibold text-red-700"
              >
                Holatni ochish
              </button>
              <button
                type="button"
                onClick={dismissAlert}
                className="rounded border border-white/60 px-3 py-1.5 text-sm"
              >
                Yopish
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <main className="mx-auto max-w-[1800px] px-6 py-5">{children}</main>
    </div>
  );
}
