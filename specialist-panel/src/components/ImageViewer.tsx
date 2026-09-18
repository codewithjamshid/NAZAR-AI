// Image viewer (TZ §6 F-15): slice slider for a CT series, heatmap on/off, zoom,
// and a jump to the most suspicious slice. Base and heatmap images are pixel
// aligned, so the overlay is a plain stacked <img> with opacity.

import { useEffect, useMemo, useRef, useState } from "react";

import { fileUrl } from "../api/client";
import type { Study } from "../api/types";
import { STUDY_STATUS_UZ, STUDY_TYPE_UZ } from "../lib/labels";

const MIN_ZOOM = 1;
const MAX_ZOOM = 5;

export function ImageViewer({ studies }: { studies: Study[] }) {
  const viewable = useMemo(
    // Voice notes are played in the patient column, not drawn as images.
    () => studies.filter((study) => study.type !== "voice" && (study.images?.base ?? []).length > 0),
    [studies],
  );
  const [studyIndex, setStudyIndex] = useState(0);
  const study = viewable[studyIndex];

  const base = useMemo(
    () => (study?.images.base ?? []).map((path) => fileUrl(path)).filter(Boolean) as string[],
    [study],
  );
  const heatmaps = useMemo(
    () => (study?.images.heatmap ?? []).map((path) => fileUrl(path)).filter(Boolean) as string[],
    [study],
  );
  const keyIndex = study?.images.key_index ?? 0;

  const [slice, setSlice] = useState(0);
  const [heatmapOn, setHeatmapOn] = useState(false);
  const [opacity, setOpacity] = useState(0.55);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragFrom = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  useEffect(() => {
    // A different study means a fresh viewer.
    setSlice(Math.min(keyIndex ?? 0, Math.max(base.length - 1, 0)));
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [studyIndex, base.length, keyIndex]);

  if (!study) {
    return (
      <div className="flex h-full min-h-[420px] items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white text-sm text-slate-500">
        Bu holatda ko'riladigan tasvir yo'q.
      </div>
    );
  }

  const heatmapSrc = heatmaps.length === 0 ? null : heatmaps[slice] ?? heatmaps[0];
  const heatmapIsSingle = heatmaps.length > 0 && heatmaps.length !== base.length;

  const onWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (base.length > 1 && !event.ctrlKey && !event.metaKey) {
      // Plain wheel walks the slices, the way radiologists expect.
      const next = slice + (event.deltaY > 0 ? 1 : -1);
      setSlice(Math.max(0, Math.min(base.length - 1, next)));
    }
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (zoom <= 1) return;
    dragFrom.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const from = dragFrom.current;
    if (!from) return;
    setPan({ x: from.panX + (event.clientX - from.x), y: from.panY + (event.clientY - from.y) });
  };

  const endDrag = () => {
    dragFrom.current = null;
  };

  return (
    <div className="flex h-full flex-col rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-2">
        {viewable.length > 1 ? (
          <select
            className="rounded border border-slate-300 px-2 py-1 text-sm"
            value={studyIndex}
            onChange={(event) => setStudyIndex(Number(event.target.value))}
          >
            {viewable.map((item, index) => (
              <option key={item.id} value={index}>
                {STUDY_TYPE_UZ[item.type] ?? item.type} #{item.id}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-sm font-semibold">
            {STUDY_TYPE_UZ[study.type] ?? study.type}
          </span>
        )}
        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
          {STUDY_STATUS_UZ[study.status] ?? study.status}
        </span>

        <button
          type="button"
          onClick={() => setHeatmapOn((value) => !value)}
          disabled={!heatmapSrc}
          className={
            "ml-auto rounded px-3 py-1.5 text-sm font-semibold disabled:opacity-40 " +
            (heatmapOn ? "bg-orange-600 text-white" : "border border-slate-300 bg-white text-slate-800")
          }
          title={heatmapSrc ? "Heatmap qatlamini yoqish/o'chirish" : "Bu tasvirda heatmap yo'q"}
        >
          {heatmapOn ? "Heatmap YONIQ" : "Heatmap O'CHIQ"}
        </button>

        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded border border-slate-300 px-2 py-1 text-sm"
            onClick={() => setZoom((value) => Math.max(MIN_ZOOM, Number((value - 0.5).toFixed(1))))}
          >
            −
          </button>
          <span className="w-12 text-center text-sm tabular-nums">{zoom.toFixed(1)}×</span>
          <button
            type="button"
            className="rounded border border-slate-300 px-2 py-1 text-sm"
            onClick={() => setZoom((value) => Math.min(MAX_ZOOM, Number((value + 0.5).toFixed(1))))}
          >
            +
          </button>
          <button
            type="button"
            className="rounded border border-slate-300 px-2 py-1 text-sm"
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
          >
            Asliga
          </button>
        </div>
      </div>

      <div
        className="relative flex-1 overflow-hidden bg-black"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={{ cursor: zoom > 1 ? "grab" : "default", minHeight: 420 }}
      >
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            transform:
              "translate(" + pan.x + "px, " + pan.y + "px) scale(" + zoom + ")",
            transition: dragFrom.current ? "none" : "transform 120ms ease-out",
          }}
        >
          <div className="relative">
            <img
              src={base[slice]}
              alt={"Tasvir " + (slice + 1)}
              className="max-h-[70vh] select-none object-contain"
              draggable={false}
            />
            {heatmapOn && heatmapSrc ? (
              <img
                src={heatmapSrc}
                alt="Heatmap qatlami"
                className="pointer-events-none absolute inset-0 h-full w-full select-none object-contain"
                style={{ opacity }}
                draggable={false}
              />
            ) : null}
          </div>
        </div>

        {heatmapOn && heatmapIsSingle ? (
          <div className="absolute left-2 top-2 rounded bg-black/70 px-2 py-1 text-xs text-orange-200">
            Heatmap faqat eng shubhali kesim uchun hisoblangan
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 px-3 py-2">
        {base.length > 1 ? (
          <>
            <button
              type="button"
              className="rounded border border-slate-300 px-2 py-1 text-sm"
              onClick={() => setSlice((value) => Math.max(0, value - 1))}
            >
              ‹
            </button>
            <input
              type="range"
              min={0}
              max={base.length - 1}
              value={slice}
              onChange={(event) => setSlice(Number(event.target.value))}
              className="flex-1"
              aria-label="Kesim tanlash"
            />
            <button
              type="button"
              className="rounded border border-slate-300 px-2 py-1 text-sm"
              onClick={() => setSlice((value) => Math.min(base.length - 1, value + 1))}
            >
              ›
            </button>
            <span className="w-24 text-right text-sm tabular-nums text-slate-700">
              kesim {slice + 1} / {base.length}
            </span>
          </>
        ) : (
          <span className="text-sm text-slate-600">Bitta tasvir</span>
        )}

        {base.length > 1 && keyIndex !== null ? (
          <button
            type="button"
            onClick={() => setSlice(Math.max(0, Math.min(base.length - 1, keyIndex)))}
            className="rounded bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white"
          >
            Eng shubhali kesim (#{keyIndex + 1})
          </button>
        ) : null}

        {heatmapOn && heatmapSrc ? (
          <label className="flex items-center gap-2 text-xs text-slate-600">
            Shaffoflik
            <input
              type="range"
              min={0.1}
              max={1}
              step={0.05}
              value={opacity}
              onChange={(event) => setOpacity(Number(event.target.value))}
            />
          </label>
        ) : null}
      </div>
    </div>
  );
}
