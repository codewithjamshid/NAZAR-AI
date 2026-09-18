// The live queue (P1) plus the red-case alert (F-13). Kept at app level so the
// sound and the banner fire on every screen, not only on the queue table.

import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from "react";

import { api } from "../api/client";
import type { QueueEvent, QueueItem } from "../api/types";
import { playRedAlert, showRedNotification } from "../lib/alert";
import { queueSocketUrl } from "../lib/ws";
import { useSession } from "./session";

const POLL_MS = 20000;
const MAX_BACKOFF_MS = 15000;

interface QueueValue {
  items: QueueItem[];
  visibleItems: QueueItem[];
  loading: boolean;
  error: string | null;
  mine: boolean;
  setMine: (value: boolean) => void;
  districtFilter: string | null;
  setDistrictFilter: (value: string | null) => void;
  connected: boolean;
  refresh: () => Promise<void>;
  alert: QueueItem | null;
  dismissAlert: () => void;
}

const QueueContext = createContext<QueueValue | null>(null);

export function QueueProvider({ children }: { children: ReactNode }) {
  const { token } = useSession();
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mine, setMine] = useState(false);
  const [districtFilter, setDistrictFilter] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [alert, setAlert] = useState<QueueItem | null>(null);

  // Red cases already announced. Seeded on the first load so opening the panel
  // does not replay every alarm in the queue.
  const knownRed = useRef<Set<number> | null>(null);

  const refresh = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const next = await api.queue({ mine });
      setItems(next);
      setError(null);

      const reds = next.filter((item) => item.zone === "red" && !item.has_decision);
      if (knownRed.current === null) {
        knownRed.current = new Set(reds.map((item) => item.case_id));
      } else {
        const fresh = reds.filter((item) => !knownRed.current?.has(item.case_id));
        for (const item of fresh) knownRed.current.add(item.case_id);
        if (fresh.length > 0) {
          const first = fresh[0];
          playRedAlert();
          showRedNotification(
            "QIZIL zona — shoshilinch holat",
            [
              "#" + first.case_id,
              first.district ?? "",
              first.age ? first.age + " yosh" : "",
              first.summary ?? "",
            ]
              .filter(Boolean)
              .join(" · "),
          );
          setAlert(first);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Navbatni olishda xato");
    } finally {
      setLoading(false);
    }
  }, [token, mine]);

  // The "mening mutaxassisligim" filter re-queries the server (GET /queue?mine=true).
  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Polling is the safety net when the socket is down.
  useEffect(() => {
    if (!token) return;
    const timer = window.setInterval(() => void refresh(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [token, refresh]);

  // Live updates. Reconnects with a growing backoff if the socket drops.
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    if (!token) {
      setConnected(false);
      return;
    }
    let socket: WebSocket | null = null;
    let retryTimer = 0;
    let attempt = 0;
    let closed = false;

    const connect = () => {
      if (closed) return;
      socket = new WebSocket(queueSocketUrl());

      socket.onopen = () => {
        attempt = 0;
        socket?.send(JSON.stringify({ token }));
      };

      socket.onmessage = (event) => {
        let payload: QueueEvent;
        try {
          payload = JSON.parse(String(event.data)) as QueueEvent;
        } catch {
          return;
        }
        if (payload.type === "ping") return;
        if (payload.type === "ready") {
          setConnected(true);
          return;
        }
        if (payload.type === "case.updated" || payload.type === "case.decided") {
          void refreshRef.current();
        }
      };

      socket.onclose = () => {
        setConnected(false);
        if (closed) return;
        attempt += 1;
        const delay = Math.min(1000 * 2 ** (attempt - 1), MAX_BACKOFF_MS);
        retryTimer = window.setTimeout(connect, delay);
      };

      socket.onerror = () => socket?.close();
    };

    connect();
    return () => {
      closed = true;
      window.clearTimeout(retryTimer);
      socket?.close();
      setConnected(false);
    };
  }, [token]);

  const visibleItems = useMemo(
    () => (districtFilter ? items.filter((item) => item.district === districtFilter) : items),
    [items, districtFilter],
  );

  const value = useMemo<QueueValue>(
    () => ({
      items,
      visibleItems,
      loading,
      error,
      mine,
      setMine,
      districtFilter,
      setDistrictFilter,
      connected,
      refresh,
      alert,
      dismissAlert: () => setAlert(null),
    }),
    [items, visibleItems, loading, error, mine, districtFilter, connected, refresh, alert],
  );

  return <QueueContext.Provider value={value}>{children}</QueueContext.Provider>;
}

export function useQueue(): QueueValue {
  const value = useContext(QueueContext);
  if (!value) throw new Error("useQueue must be used inside QueueProvider");
  return value;
}
