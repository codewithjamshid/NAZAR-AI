// Stroke countdown (TZ §6 F-14). Both thresholds come from GET /meta
// (rules/triage.yaml) — never hard-coded here.

import { useEffect, useState } from "react";

import type { StrokeInfo } from "../api/types";
import { clock, minutesText } from "../lib/format";
import { useSession } from "../state/session";

interface TimerState {
  remaining: number | null;
  elapsed: number | null;
  level: "open" | "warning" | "closed" | "unknown";
}

function computeState(
  stroke: Partial<StrokeInfo> | null | undefined,
  fallbackRemaining: number | null,
  warningMin: number | null,
  thrombolysisMin: number | null,
): TimerState {
  const onset = stroke?.onset_at ? new Date(stroke.onset_at) : null;
  let elapsed: number | null = null;
  if (onset && !Number.isNaN(onset.getTime())) {
    elapsed = (Date.now() - onset.getTime()) / 60000;
  } else if (typeof stroke?.elapsed_min === "number") {
    elapsed = stroke.elapsed_min;
  }

  let remaining: number | null = null;
  if (elapsed !== null && thrombolysisMin !== null) {
    remaining = thrombolysisMin - elapsed;
  } else if (typeof stroke?.remaining_min === "number") {
    remaining = stroke.remaining_min;
  } else if (fallbackRemaining !== null) {
    remaining = fallbackRemaining;
  }

  let level: TimerState["level"] = "unknown";
  if (remaining !== null && remaining <= 0) {
    level = "closed";
  } else if (elapsed !== null && warningMin !== null) {
    level = elapsed >= warningMin ? "warning" : "open";
  } else if (remaining !== null) {
    level = "open";
  }
  return { remaining, elapsed, level };
}

const LEVEL_STYLE: Record<TimerState["level"], string> = {
  open: "border-green-600 bg-green-50 text-green-800",
  warning: "border-amber-500 bg-amber-50 text-amber-800",
  closed: "border-red-600 bg-red-50 text-red-800",
  unknown: "border-slate-300 bg-slate-50 text-slate-700",
};

const LEVEL_WORD: Record<TimerState["level"], string> = {
  open: "Trombolizis oynasi OCHIQ",
  warning: "Trombolizis oynasi — OGOHLANTIRISH",
  closed: "Trombolizis oynasi YOPILDI",
  unknown: "Vaqt noma'lum",
};

export function StrokeTimer({
  stroke,
  timeWindowMin,
  compact = false,
}: {
  stroke: Partial<StrokeInfo> | null | undefined;
  timeWindowMin: number | null;
  compact?: boolean;
}) {
  const { meta } = useSession();
  const [, setTick] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setTick((value) => value + 1), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const warningMin = meta?.stroke_window.warning_min ?? null;
  const thrombolysisMin = meta?.stroke_window.thrombolysis_min ?? null;
  const state = computeState(stroke, timeWindowMin, warningMin, thrombolysisMin);

  if (state.remaining === null && state.elapsed === null) return null;

  if (compact) {
    return (
      <span
        className={"inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-bold " + LEVEL_STYLE[state.level]}
        title={LEVEL_WORD[state.level]}
      >
        <span aria-hidden="true">⏱</span>
        {state.level === "closed" ? "OYNA YOPIQ" : clock(state.remaining) + " qoldi"}
      </span>
    );
  }

  return (
    <div className={"rounded border px-3 py-2 " + LEVEL_STYLE[state.level]}>
      <div className="text-xs font-semibold uppercase tracking-wide">{LEVEL_WORD[state.level]}</div>
      <div className="mt-1 font-mono text-3xl font-bold tabular-nums">
        {state.level === "closed" ? "00:00" : clock(state.remaining)}
      </div>
      <div className="mt-1 text-xs">
        Simptomdan: {minutesText(state.elapsed)}
        {thrombolysisMin !== null ? " · oyna: " + minutesText(thrombolysisMin) : ""}
        {warningMin !== null ? " · ogohlantirish: " + minutesText(warningMin) : ""}
      </div>
    </div>
  );
}
