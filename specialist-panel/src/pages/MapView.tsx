// P3 Xarita (TZ §12, S-05): districts plotted from the lat/lng the API reports.
// Plain SVG on purpose — no map library, no tile server during the demo.

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { api } from "../api/client";
import type { DistrictStat, RegionStats } from "../api/types";
import { Disclaimer } from "../components/Disclaimer";
import { minutesText } from "../lib/format";
import { ZONE_HEX, worstZone } from "../lib/zone";
import { zoneWord } from "../lib/labels";
import { useQueue } from "../state/queue";

const WIDTH = 960;
const HEIGHT = 560;
const PADDING = 90;

interface Placed {
  stat: DistrictStat;
  x: number;
  y: number;
  radius: number;
}

function place(districts: DistrictStat[]): Placed[] {
  const located = districts.filter((item) => item.lat !== null && item.lng !== null);
  if (located.length === 0) return [];

  const lats = located.map((item) => item.lat as number);
  const lngs = located.map((item) => item.lng as number);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const spanLat = maxLat - minLat || 1;
  const spanLng = maxLng - minLng || 1;
  const maxTotal = Math.max(...located.map((item) => item.total), 1);

  return located.map((stat) => {
    const nx = located.length === 1 ? 0.5 : ((stat.lng as number) - minLng) / spanLng;
    const ny = located.length === 1 ? 0.5 : ((stat.lat as number) - minLat) / spanLat;
    return {
      stat,
      x: PADDING + nx * (WIDTH - 2 * PADDING),
      // Latitude grows north, SVG y grows south.
      y: HEIGHT - PADDING - ny * (HEIGHT - 2 * PADDING),
      radius: 16 + 34 * Math.sqrt(stat.total / maxTotal),
    };
  });
}

export function MapPage() {
  const navigate = useNavigate();
  const { setDistrictFilter } = useQueue();
  const [stats, setStats] = useState<RegionStats | null>(null);
  const [days, setDays] = useState(7);
  const [error, setError] = useState<string | null>(null);
  const [hovered, setHovered] = useState<DistrictStat | null>(null);

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

  const placed = useMemo(() => place(stats?.districts ?? []), [stats]);
  const unplaced = (stats?.districts ?? []).filter((item) => item.lat === null || item.lng === null);

  const openDistrict = (district: string) => {
    setDistrictFilter(district);
    navigate("/");
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold">Xorazm viloyati xaritasi</h1>
        <select
          className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm"
          value={days}
          onChange={(event) => setDays(Number(event.target.value))}
        >
          <option value={1}>Bugun</option>
          <option value={7}>7 kun</option>
          <option value={30}>30 kun</option>
        </select>
        <span className="text-sm text-slate-600">
          Tumanga bosing — navbat shu tuman bo'yicha filtrlanadi
        </span>
      </div>

      {error ? (
        <p className="mb-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <svg viewBox={"0 0 " + WIDTH + " " + HEIGHT} className="w-full" role="img"
               aria-label="Tumanlar bo'yicha holatlar xaritasi">
            <rect x={0} y={0} width={WIDTH} height={HEIGHT} fill="#f1f5f9" rx={12} />
            {placed.map((item) => {
              const zone = worstZone(item.stat);
              const colour = ZONE_HEX[zone ?? "unknown"];
              return (
                <g
                  key={item.stat.district}
                  className="cursor-pointer"
                  onMouseEnter={() => setHovered(item.stat)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => openDistrict(item.stat.district)}
                >
                  <title>
                    {item.stat.district + " — " + item.stat.total + " holat, o'rtacha javob: " +
                      minutesText(item.stat.avg_response_min)}
                  </title>
                  <circle
                    cx={item.x}
                    cy={item.y}
                    r={item.radius}
                    fill={colour}
                    fillOpacity={0.35}
                    stroke={colour}
                    strokeWidth={3}
                  />
                  <text
                    x={item.x}
                    y={item.y + 5}
                    textAnchor="middle"
                    className="fill-slate-900 text-[16px] font-bold"
                  >
                    {item.stat.total}
                  </text>
                  <text
                    x={item.x}
                    y={item.y + item.radius + 18}
                    textAnchor="middle"
                    className="fill-slate-800 text-[14px] font-semibold"
                  >
                    {item.stat.district}
                  </text>
                  <text
                    x={item.x}
                    y={item.y + item.radius + 34}
                    textAnchor="middle"
                    className="fill-slate-600 text-[12px]"
                  >
                    {zoneWord(zone)}
                  </text>
                </g>
              );
            })}
            {placed.length === 0 ? (
              <text x={WIDTH / 2} y={HEIGHT / 2} textAnchor="middle" className="fill-slate-500 text-[18px]">
                Koordinatali tuman ma'lumoti yo'q
              </text>
            ) : null}
          </svg>

          <div className="mt-2 flex flex-wrap gap-3 px-2 text-xs text-slate-700">
            {(["red", "yellow", "green"] as const).map((zone) => (
              <span key={zone} className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="inline-block h-3 w-3 rounded-full"
                  style={{ backgroundColor: ZONE_HEX[zone] }}
                />
                {zoneWord(zone)}
              </span>
            ))}
            <span className="text-slate-500">Doira o'lchami — holatlar soni</span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
              {hovered ? hovered.district + " tumani" : "Tumanlar"}
            </h3>
            {hovered ? (
              <ul className="space-y-1 text-sm text-slate-800">
                <li>Holatlar: <b>{hovered.total}</b></li>
                <li>{zoneWord("red")}: {hovered.red}</li>
                <li>{zoneWord("yellow")}: {hovered.yellow}</li>
                <li>{zoneWord("green")}: {hovered.green}</li>
                <li>O'rtacha javob vaqti: <b>{minutesText(hovered.avg_response_min)}</b></li>
              </ul>
            ) : (
              <ul className="space-y-1">
                {(stats?.districts ?? []).map((item) => (
                  <li key={item.district}>
                    <button
                      type="button"
                      onClick={() => openDistrict(item.district)}
                      onMouseEnter={() => setHovered(item)}
                      onMouseLeave={() => setHovered(null)}
                      className="flex w-full items-center justify-between rounded px-2 py-1 text-sm hover:bg-slate-100"
                    >
                      <span className="flex items-center gap-2">
                        <span
                          aria-hidden="true"
                          className="inline-block h-3 w-3 rounded-full"
                          style={{ backgroundColor: ZONE_HEX[worstZone(item) ?? "unknown"] }}
                        />
                        {item.district}
                        <span className="text-xs text-slate-500">{zoneWord(worstZone(item))}</span>
                      </span>
                      <span className="text-slate-700">{item.total}</span>
                    </button>
                  </li>
                ))}
                {(stats?.districts ?? []).length === 0 ? (
                  <li className="px-2 py-1 text-sm text-slate-500">Ma'lumot yo'q.</li>
                ) : null}
              </ul>
            )}
          </div>

          {unplaced.length > 0 ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
              Koordinatasi yo'q tumanlar: {unplaced.map((item) => item.district).join(", ")}
            </div>
          ) : null}

          <Disclaimer />
        </div>
      </div>
    </div>
  );
}
