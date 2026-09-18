// The permanent line next to every AI result (TZ §11, §12).

import { useSession } from "../state/session";

export function Disclaimer({ className = "" }: { className?: string }) {
  const { disclaimer } = useSession();
  return (
    <p
      className={
        "rounded border border-slate-300 bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700 " +
        className
      }
    >
      {disclaimer}
    </p>
  );
}
