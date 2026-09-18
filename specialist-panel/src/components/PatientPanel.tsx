// P2 left column: patient, anamnesis, BE-FAST with its score, red flags and labs.

import { fileUrl } from "../api/client";
import type { CaseDetail } from "../api/types";
import { dateTime, num } from "../lib/format";
import { BEFAST_UZ, FLAG_UZ, SEX_UZ } from "../lib/labels";
import { useSession } from "../state/session";

/** Which labs the triage engine called critical. The thresholds live in
 *  rules/triage.yaml; the panel reads the engine's own reasons instead of
 *  keeping a second copy of the numbers. */
function criticalLabs(reasons: string[], labs: Record<string, number>): Set<string> {
  const critical = new Set<string>();
  for (const reason of reasons) {
    if (!reason.toLowerCase().startsWith("tahlil:")) continue;
    for (const name of Object.keys(labs)) {
      if (reason.toLowerCase().includes(name.toLowerCase())) critical.add(name);
    }
  }
  return critical;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-slate-200 px-4 py-3 last:border-b-0">
      <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">{title}</h3>
      {children}
    </section>
  );
}

export function PatientPanel({ detail }: { detail: CaseDetail }) {
  const { meta } = useSession();
  const anamnesis = detail.anamnesis;
  const befast = anamnesis?.befast ?? null;
  const flags = anamnesis?.flags ?? null;
  const labs = anamnesis?.labs ?? {};
  const points = meta?.befast.points ?? {};
  const minScore = meta?.befast.stroke_min_score ?? null;

  const score = befast
    ? Object.entries(befast).reduce(
        (total, [key, value]) => (value ? total + (points[key] ?? 0) : total),
        0,
      )
    : null;

  const critical = criticalLabs(detail.triage?.reasons ?? [], labs);
  const labEntries = Object.entries(labs);

  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <Section title="Bemor">
        <div className="text-lg font-bold text-slate-900">{detail.patient.full_name ?? "—"}</div>
        <div className="text-sm text-slate-700">
          {detail.patient.age !== null ? detail.patient.age + " yosh" : "yosh noma'lum"}
          {detail.patient.sex ? " · " + (SEX_UZ[detail.patient.sex] ?? detail.patient.sex) : ""}
        </div>
        {detail.patient.phone ? (
          <div className="text-sm text-slate-600">{detail.patient.phone}</div>
        ) : null}
        <div className="mt-2 text-sm text-slate-700">
          {detail.facility?.name ?? "—"}
          {detail.facility?.district ? " · " + detail.facility.district + " tumani" : ""}
        </div>
        <div className="mt-1 text-xs text-slate-500">
          Holat ochildi: {dateTime(detail.created_at)}
          {detail.symptom_onset_at ? " · simptom: " + dateTime(detail.symptom_onset_at) : ""}
        </div>
        {detail.facility && !detail.facility.has_ct && (detail.nearest_ct ?? []).length > 0 ? (
          <div className="mt-2 rounded bg-slate-50 px-2 py-1.5 text-xs text-slate-700">
            Eng yaqin KT: {detail.nearest_ct?.[0].name} ({num(detail.nearest_ct?.[0].distance_km, 1)} km)
          </div>
        ) : null}
      </Section>

      <Section title="Shikoyat / anamnez">
        {anamnesis?.chief_complaint ? (
          <p className="text-sm text-slate-900">{anamnesis.chief_complaint}</p>
        ) : (
          <p className="text-sm text-slate-500">Shikoyat yozilmagan.</p>
        )}
        {anamnesis?.voice_transcript ? (
          <div className="mt-2 rounded bg-slate-50 px-2 py-1.5 text-sm text-slate-700">
            <span className="text-xs font-semibold text-slate-500">Ovozdan matn: </span>
            {anamnesis.voice_transcript}
          </div>
        ) : null}
        {anamnesis?.voice_card ? <VoiceCardView card={anamnesis.voice_card} /> : null}
        <VoiceRecordings studies={detail.studies} />
      </Section>

      <Section title="BE-FAST">
        {befast ? (
          <>
            <ul className="space-y-1">
              {Object.entries(BEFAST_UZ).map(([key, label]) => {
                const value = befast[key];
                const point = points[key];
                return (
                  <li key={key} className="flex items-center justify-between text-sm">
                    <span className={value ? "font-semibold text-red-700" : "text-slate-700"}>
                      {label}
                    </span>
                    <span className="flex items-center gap-2">
                      {point !== undefined ? (
                        <span className="text-xs text-slate-500">{point} ball</span>
                      ) : null}
                      <span
                        className={
                          "rounded px-2 py-0.5 text-xs font-bold " +
                          (value ? "bg-red-600 text-white" : "bg-slate-200 text-slate-700")
                        }
                      >
                        {value ? "HA" : "YO'Q"}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
            <div className="mt-3 flex items-center justify-between rounded bg-slate-100 px-3 py-2">
              <span className="text-sm font-semibold">Umumiy ball</span>
              <span className="text-lg font-bold">{score}</span>
            </div>
            {minScore !== null ? (
              <p className="mt-1 text-xs text-slate-500">
                Insult shubhasi chegarasi: {minScore} ball
                {meta?.befast.stroke_any_of?.length
                  ? " yoki " +
                    meta.befast.stroke_any_of
                      .map((key) => BEFAST_UZ[key] ?? key)
                      .join(" / ") +
                    " dan bittasi"
                  : ""}
              </p>
            ) : null}
            {detail.triage?.stroke && "suspected" in detail.triage.stroke && detail.triage.stroke.suspected ? (
              <p className="mt-2 rounded border border-red-300 bg-red-50 px-2 py-1 text-sm font-bold text-red-700">
                INSULT SHUBHASI
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-slate-500">BE-FAST anketasi to'ldirilmagan.</p>
        )}
      </Section>

      <Section title="Xavf belgilari">
        {flags && Object.keys(flags).length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {Object.entries(flags).map(([key, value]) => (
              <li
                key={key}
                className={
                  "rounded border px-2 py-1 text-xs font-semibold " +
                  (value
                    ? "border-red-400 bg-red-50 text-red-700"
                    : "border-slate-300 bg-slate-50 text-slate-500")
                }
              >
                {(FLAG_UZ[key] ?? key) + ": " + (value ? "HA" : "yo'q")}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">Belgilanmagan.</p>
        )}
      </Section>

      <Section title="Tahlillar">
        {labEntries.length > 0 ? (
          <table className="w-full text-sm">
            <tbody>
              {labEntries.map(([name, value]) => {
                const isCritical = critical.has(name);
                return (
                  <tr key={name} className={isCritical ? "bg-red-50" : ""}>
                    <td className="py-1 pr-2 text-slate-700">{name}</td>
                    <td
                      className={
                        "py-1 text-right font-mono tabular-nums " +
                        (isCritical ? "font-bold text-red-700" : "text-slate-900")
                      }
                    >
                      {num(value, 1)}
                    </td>
                    <td className="w-24 py-1 pl-2 text-right">
                      {isCritical ? (
                        <span className="rounded bg-red-600 px-1.5 py-0.5 text-[11px] font-bold text-white">
                          KRITIK
                        </span>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-slate-500">Tahlil qiymatlari yo'q.</p>
        )}
      </Section>
    </div>
  );
}

function VoiceCardView({ card }: { card: import("../api/types").VoiceCard }) {
  const rows: Array<[string, string | null]> = [
    ["Asosiy shikoyat", card.chief_complaint],
    ["Boshlanishi (aytilgan)", card.onset],
    ["Qo'shimcha kasalliklar", card.comorbidities.length ? card.comorbidities.join(", ") : null],
    ["Dorilar", card.medications.length ? card.medications.join(", ") : null],
  ];
  const filled = rows.filter(([, value]) => value);
  if (!filled.length) return null;
  return (
    <div className="mt-2 rounded border border-slate-200 px-2 py-1.5">
      <p className="text-xs font-semibold text-slate-500">
        Ovozli karta (AI o'qidi, hamshira tekshirmagan)
      </p>
      <dl className="mt-1 space-y-0.5 text-sm">
        {filled.map(([label, value]) => (
          <div key={label} className="flex gap-2">
            <dt className="w-40 shrink-0 text-slate-500">{label}</dt>
            <dd className="text-slate-900">{value}</dd>
          </div>
        ))}
      </dl>
      {card.onset ? (
        <p className="mt-1 text-xs text-slate-500">
          Taymer hamshira kiritgan simptom vaqtidan hisoblanadi, bu yozuvdan emas.
        </p>
      ) : null}
    </div>
  );
}

/** The original recordings, so the specialist can check the transcript by ear. */
function VoiceRecordings({ studies }: { studies: import("../api/types").Study[] }) {
  const notes = studies.filter((study) => study.type === "voice" && study.images?.base?.[0]);
  if (!notes.length) return null;
  return (
    <div className="mt-2 space-y-1">
      {notes.map((study) => {
        const src = fileUrl(study.images.base[0]);
        return src ? (
          <div key={study.id}>
            <p className="text-xs font-semibold text-slate-500">Asl ovoz yozuvi</p>
            <audio controls preload="none" src={src} className="mt-0.5 w-full" />
          </div>
        ) : null;
      })}
    </div>
  );
}
