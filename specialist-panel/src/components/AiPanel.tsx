// P2 right column, AI block: zone, specialist summary, every reason, and per
// module confidence + model version. Nothing here is a diagnosis (TZ §11).

import type { AIResult, CaseDetail } from "../api/types";
import { msText, num, percent } from "../lib/format";
import { moduleName, pathology, specialist as specialistUz, route as routeUz } from "../lib/labels";
import { Disclaimer } from "./Disclaimer";
import { ModelVersion } from "./ModelVersion";
import { StrokeTimer } from "./StrokeTimer";
import { ZoneBadge } from "./ZoneBadge";

function readersLine(value: boolean | null | undefined) {
  if (value === true) {
    return {
      text: "Ikki o'quvchi kelishdi",
      className: "border-green-400 bg-green-50 text-green-800",
    };
  }
  if (value === false) {
    return {
      text: "Ikki o'quvchi kelishmadi — ehtiyot zonasi",
      className: "border-amber-400 bg-amber-50 text-amber-800",
    };
  }
  return {
    text: "Solishtirib bo'lmadi (ikkinchi o'quvchi yo'q)",
    className: "border-slate-300 bg-slate-50 text-slate-700",
  };
}

function findingsOf(result: AIResult): { name: string; probability: number }[] {
  const output = result.output as { findings?: unknown } | null;
  const raw = output?.findings;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => item as { pathology?: string; probability?: number })
    .filter((item) => typeof item.pathology === "string" && typeof item.probability === "number")
    .map((item) => ({ name: item.pathology as string, probability: item.probability as number }))
    .slice(0, 6);
}

function ModuleCard({ result }: { result: AIResult }) {
  const findings = findingsOf(result);
  return (
    <li className="rounded border border-slate-200 bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold text-slate-900">{moduleName(result.module)}</span>
        <span className="whitespace-nowrap rounded bg-slate-900 px-2 py-0.5 text-xs font-bold text-white">
          Ishonch: {result.confidence === null ? "—" : percent(result.confidence, 0)}
        </span>
      </div>
      <div className="mt-1.5">
        <ModelVersion value={result.model_version} />
      </div>
      {result.duration_ms !== null ? (
        <div className="mt-1 text-xs text-slate-500">Vaqt: {msText(result.duration_ms)}</div>
      ) : null}
      {result.error ? (
        <div className="mt-1 rounded bg-red-50 px-2 py-1 text-xs text-red-700">
          Xato: {result.error}
        </div>
      ) : null}
      {findings.length > 0 ? (
        <ul className="mt-2 space-y-0.5">
          {findings.map((finding) => (
            <li key={finding.name} className="flex justify-between text-xs text-slate-700">
              <span>{pathology(finding.name)}</span>
              <span className="font-mono tabular-nums">{num(finding.probability, 2)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function AiPanel({ detail }: { detail: CaseDetail }) {
  const triage = detail.triage;
  const results = detail.studies.flatMap((study) => study.ai_results);
  const readers = readersLine(triage?.readers_agree);

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <ZoneBadge zone={triage?.zone ?? detail.zone} withHint size="lg" />
          <div className="text-sm text-slate-700">
            <div>
              Mutaxassis: <b>{specialistUz(triage?.specialist_type ?? detail.specialist_type)}</b>
            </div>
            <div>
              Yo'nalish: <b>{routeUz(triage?.route ?? detail.route)}</b>
            </div>
          </div>
        </div>

        {triage?.summary_specialist ? (
          <pre className="mt-3 whitespace-pre-wrap rounded bg-slate-50 p-3 font-sans text-sm text-slate-800">
            {triage.summary_specialist}
          </pre>
        ) : (
          <p className="mt-3 text-sm text-slate-500">AI xulosasi yo'q.</p>
        )}

        <Disclaimer className="mt-3" />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
          Asoslar (reasons)
        </h3>
        {triage && triage.reasons.length > 0 ? (
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-800">
            {triage.reasons.map((reason, index) => (
              <li key={index}>{reason}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">Asos yozilmagan.</p>
        )}
        {triage && triage.signals.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {triage.signals.map((signal) => (
              <span
                key={signal}
                className="rounded bg-slate-200 px-1.5 py-0.5 font-mono text-[11px] text-slate-700"
              >
                {signal}
              </span>
            ))}
          </div>
        ) : null}
        <div className={"mt-3 rounded border px-3 py-2 text-sm font-semibold " + readers.className}>
          {readers.text}
        </div>
        {triage?.rules_version ? (
          <p className="mt-2 text-xs text-slate-500">Qoidalar versiyasi: {triage.rules_version}</p>
        ) : null}
      </div>

      {(triage?.time_window_min !== null && triage?.time_window_min !== undefined) ||
      (triage?.stroke as { onset_at?: string | null } | undefined)?.onset_at ? (
        <StrokeTimer
          stroke={triage?.stroke as never}
          timeWindowMin={triage?.time_window_min ?? null}
        />
      ) : null}

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
          AI modullari
        </h3>
        {results.length > 0 ? (
          <ul className="space-y-2">
            {results.map((result) => (
              <ModuleCard key={result.id} result={result} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">Hech bir modul hali natija bermadi.</p>
        )}
      </div>
    </div>
  );
}
