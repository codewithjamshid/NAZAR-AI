// Zone styling. TZ §12: a zone is never colour alone, the word always comes with it.

import type { Zone } from "../api/types";

interface ZoneStyle {
  badge: string;
  row: string;
  bar: string;
  text: string;
}

const STYLES: Record<string, ZoneStyle> = {
  red: {
    badge: "bg-red-600 text-white border-red-700",
    row: "bg-red-50",
    bar: "bg-red-600",
    text: "text-red-700",
  },
  yellow: {
    badge: "bg-amber-500 text-white border-amber-600",
    row: "bg-amber-50",
    bar: "bg-amber-500",
    text: "text-amber-700",
  },
  green: {
    badge: "bg-green-600 text-white border-green-700",
    row: "bg-green-50",
    bar: "bg-green-600",
    text: "text-green-700",
  },
  unknown: {
    badge: "bg-slate-500 text-white border-slate-600",
    row: "bg-slate-50",
    bar: "bg-slate-500",
    text: "text-slate-700",
  },
};

export function zoneStyle(zone: Zone | null | undefined): ZoneStyle {
  return STYLES[zone ?? "unknown"] ?? STYLES.unknown;
}

/** Hex values for the SVG map, where Tailwind classes do not apply. */
export const ZONE_HEX: Record<string, string> = {
  red: "#dc2626",
  yellow: "#d97706",
  green: "#16a34a",
  unknown: "#64748b",
};

/** The worst zone present in a district decides its colour on the map. */
export function worstZone(counts: { red: number; yellow: number; green: number }): Zone | null {
  if (counts.red > 0) return "red";
  if (counts.yellow > 0) return "yellow";
  if (counts.green > 0) return "green";
  return null;
}
