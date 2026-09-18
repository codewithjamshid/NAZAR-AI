// Every AI reading shows which model produced it. A version ending in "@stub"
// came from a cached stub, not a live model — that must be impossible to miss.

import { isStubModel } from "../lib/format";

export function ModelVersion({ value }: { value: string | null | undefined }) {
  if (!value) {
    return <span className="text-xs text-slate-500">model versiyasi noma'lum</span>;
  }
  const stub = isStubModel(value);
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span className="rounded bg-slate-200 px-1.5 py-0.5 font-mono text-[11px] text-slate-700">
        {value}
      </span>
      {stub ? (
        <span
          className="rounded border border-orange-400 bg-orange-100 px-1.5 py-0.5 text-[11px] font-bold text-orange-800"
          title="Natija keshlangan namunadan olindi, jonli model o'qimadi"
        >
          STUB — jonli model emas
        </span>
      ) : null}
    </span>
  );
}
