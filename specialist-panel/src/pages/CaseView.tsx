// P2 Holat ko'rinishi (TZ §12): left = patient, middle = images, right = AI + decision.

import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { api } from "../api/client";
import type { CaseDetail } from "../api/types";
import { AiPanel } from "../components/AiPanel";
import { DecisionPanel } from "../components/DecisionPanel";
import { ImageViewer } from "../components/ImageViewer";
import { PatientPanel } from "../components/PatientPanel";
import { ZoneBadge } from "../components/ZoneBadge";
import { STATUS_UZ } from "../lib/labels";
import { useQueue } from "../state/queue";

export function CaseViewPage() {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const { refresh } = useQueue();
  const id = Number(caseId);

  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [recomputing, setRecomputing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const value = await api.caseDetail(id);
      setDetail(value);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Holatni olishda xato");
    } finally {
      setLoading(false);
    }
  }, [id]);

  const recompute = useCallback(async () => {
    setRecomputing(true);
    try {
      setDetail(await api.recomputeTriage(id));
      setError(null);
      void refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Qayta hisoblashda xato");
    } finally {
      setRecomputing(false);
    }
  }, [id, refresh]);

  useEffect(() => {
    if (!Number.isFinite(id)) return;
    void load();
    // Opening the case takes it out of the unseen queue (TZ §9 in_review).
    api
      .openCase(id)
      .then(() => refresh())
      .catch(() => {
        /* already open or closed — not worth blocking the screen */
      });
    // Deliberately keyed on the case only: re-running on every queue tick would
    // re-open the case on the server.
  }, [id, load]);

  if (!Number.isFinite(id)) {
    return <p className="text-sm text-red-700">Holat raqami noto'g'ri.</p>;
  }

  if (loading && !detail) {
    return <p className="text-sm text-slate-600">Yuklanmoqda...</p>;
  }

  if (error && !detail) {
    return (
      <div>
        <p className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
        <button
          type="button"
          onClick={() => navigate("/")}
          className="mt-3 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm"
        >
          Navbatga qaytish
        </button>
      </div>
    );
  }

  if (!detail) return null;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
        >
          ‹ Navbat
        </button>
        <h1 className="text-xl font-bold">Holat #{detail.id}</h1>
        <ZoneBadge zone={detail.triage?.zone ?? detail.zone} withHint />
        <span className="rounded bg-slate-200 px-2 py-1 text-xs font-medium text-slate-700">
          {STATUS_UZ[detail.status] ?? detail.status}
        </span>
        <button
          type="button"
          onClick={() => void recompute()}
          disabled={recomputing}
          title="rules/triage.yaml o'zgargan bo'lsa zonani qayta hisoblaydi"
          className="ml-auto rounded border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
        >
          {recomputing ? "Hisoblanmoqda..." : "Qoidalar bo'yicha qayta hisoblash"}
        </button>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
        >
          Yangilash
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[320px_minmax(0,1fr)_420px]">
        <PatientPanel detail={detail} />

        <div className="min-h-[520px]">
          <ImageViewer studies={detail.studies} />
        </div>

        <div className="space-y-3">
          <AiPanel detail={detail} />
          <DecisionPanel
            detail={detail}
            onDecided={(updated) => {
              setDetail(updated);
              void refresh();
            }}
          />
        </div>
      </div>
    </div>
  );
}
