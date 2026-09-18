// WebSocket URL derived from the REST base so one env var configures both.

import { API_URL } from "../api/client";

export function queueSocketUrl(): string {
  const base = new URL(API_URL, window.location.origin);
  const scheme = base.protocol === "https:" ? "wss:" : "ws:";
  const path = base.pathname.replace(/\/$/, "") + "/ws/queue";
  return scheme + "//" + base.host + path;
}
