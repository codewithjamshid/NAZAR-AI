// Number and time formatting with Uzbek conventions (decimal comma).

export function num(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toFixed(digits).replace(".", ",");
}

export function percent(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return (value * 100).toFixed(digits).replace(".", ",") + "%";
}

/** "2 soat 15 daqiqa" / "42 daqiqa" */
export function minutesText(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || Number.isNaN(minutes)) return "—";
  const total = Math.max(0, Math.round(minutes));
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (hours === 0) return rest + " daqiqa";
  if (rest === 0) return hours + " soat";
  return hours + " soat " + rest + " daqiqa";
}

/** "03:45" for a countdown. */
export function clock(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || Number.isNaN(minutes)) return "—";
  const total = Math.max(0, Math.round(minutes));
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  return String(hours).padStart(2, "0") + ":" + String(rest).padStart(2, "0");
}

export function timeOfDay(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" });
}

export function dateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return (
    date.toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit" }) +
    " " +
    date.toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" })
  );
}

export function msText(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || Number.isNaN(ms)) return "—";
  if (ms < 1000) return Math.round(ms) + " ms";
  return num(ms / 1000, 1) + " s";
}

/** A model_version ending in "@stub" means a cached stub answered, not a live model. */
export function isStubModel(modelVersion: string | null | undefined): boolean {
  return Boolean(modelVersion && modelVersion.trim().toLowerCase().endsWith("@stub"));
}
