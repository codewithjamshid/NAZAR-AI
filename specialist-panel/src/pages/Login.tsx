import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import { requestNotificationPermission, unlockAudio } from "../lib/alert";
import { useSession } from "../state/session";

export function LoginPage() {
  const { token, login } = useSession();
  const navigate = useNavigate();
  const [phone, setPhone] = useState("+998901000004");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = "NAZAR AI — Mutaxassis paneli";
  }, []);

  if (token) return <Navigate to="/" replace />;

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    // The browser only lets the alert tone play after a real user gesture.
    unlockAudio();
    void requestNotificationPermission();
    try {
      await login(phone.trim(), password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kirishda xato");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 p-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-lg bg-white p-8 shadow-xl"
      >
        <h1 className="text-2xl font-bold text-slate-900">NAZAR AI</h1>
        <p className="mt-1 text-sm text-slate-600">Mutaxassis paneli — Xorazm viloyati</p>

        <label className="mt-6 block text-sm font-medium text-slate-700" htmlFor="phone">
          Telefon
        </label>
        <input
          id="phone"
          className="mt-1 w-full rounded border border-slate-300 px-3 py-2 focus:border-slate-900 focus:outline-none"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          autoComplete="username"
          required
        />

        <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="password">
          Parol
        </label>
        <input
          id="password"
          type="password"
          className="mt-1 w-full rounded border border-slate-300 px-3 py-2 focus:border-slate-900 focus:outline-none"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          required
        />

        {error ? (
          <p className="mt-4 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={busy}
          className="mt-6 w-full rounded bg-slate-900 px-4 py-3 font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {busy ? "Kirilmoqda..." : "Kirish"}
        </button>
      </form>
    </div>
  );
}
