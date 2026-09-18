// Thin fetch wrapper around the NAZAR AI API. The token lives in localStorage so
// the panel survives a page reload during the demo.

import type {
  CaseDetail, DecisionAction, LoginResponse, Meta, QueueItem, RegionStats, Route,
} from "./types";

export const API_URL: string =
  (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:8000/api/v1";

/** Origin of the API, used to turn relative signed file paths into absolute URLs. */
export const API_ORIGIN: string = new URL(API_URL, window.location.origin).origin;

const TOKEN_KEY = "nazar.token";
const USER_KEY = "nazar.user";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setSession(token: string, user: unknown): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function storedUser<T>(): T | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Signed file URLs come back relative ("/api/v1/files/..."); make them absolute. */
export function fileUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return API_ORIGIN + path;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const token = getToken();
  if (token) headers.set("Authorization", "Bearer " + token);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(API_URL + path, { ...init, headers });
  if (response.status === 401) {
    clearSession();
    window.dispatchEvent(new CustomEvent("nazar:unauthorized"));
    throw new ApiError(401, "Sessiya tugadi, qaytadan kiring");
  }
  if (!response.ok) {
    let detail = "So'rov bajarilmadi (" + response.status + ")";
    try {
      const body = (await response.json()) as { detail?: unknown };
      if (typeof body.detail === "string") detail = body.detail;
    } catch {
      /* body was not JSON */
    }
    throw new ApiError(response.status, detail);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  login(phone: string, password: string): Promise<LoginResponse> {
    return request<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ phone, password }),
    });
  },

  meta(): Promise<Meta> {
    return request<Meta>("/meta");
  },

  queue(options: { mine?: boolean; includeDecided?: boolean } = {}): Promise<QueueItem[]> {
    const params = new URLSearchParams();
    params.set("mine", String(Boolean(options.mine)));
    params.set("include_decided", String(Boolean(options.includeDecided)));
    return request<QueueItem[]>("/queue?" + params.toString());
  },

  caseDetail(id: number): Promise<CaseDetail> {
    return request<CaseDetail>("/cases/" + id);
  },

  openCase(id: number): Promise<unknown> {
    return request<unknown>("/cases/" + id + "/open", { method: "POST" });
  },

  decide(
    id: number,
    payload: { action: DecisionAction; note?: string; route_final?: Route },
  ): Promise<CaseDetail> {
    return request<CaseDetail>("/cases/" + id + "/decision", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  regionStats(days = 7): Promise<RegionStats> {
    return request<RegionStats>("/stats/region?days=" + days);
  },
};
