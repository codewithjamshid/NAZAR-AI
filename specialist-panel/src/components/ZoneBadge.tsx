// TZ §12: the zone is shown as colour AND word, never colour alone.

import type { Zone } from "../api/types";
import { ZONE_HINT, zoneWord } from "../lib/labels";
import { zoneStyle } from "../lib/zone";

export function ZoneBadge({
  zone,
  withHint = false,
  size = "md",
}: {
  zone: Zone | null | undefined;
  withHint?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const style = zoneStyle(zone);
  const padding =
    size === "lg" ? "px-4 py-2 text-base" : size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm";
  const hint = zone ? ZONE_HINT[zone] : null;
  return (
    <span
      className={
        "inline-flex items-center gap-2 rounded border font-bold tracking-wide " +
        style.badge + " " + padding
      }
    >
      <span aria-hidden="true" className="h-2 w-2 rounded-full bg-white/90" />
      {zoneWord(zone)}
      {withHint && hint ? <span className="font-normal opacity-90">— {hint}</span> : null}
    </span>
  );
}
