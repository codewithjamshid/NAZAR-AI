// One simple inline icon per BE-FAST question (F-03: "har biri rasm bilan").
// Plain strokes, no external icon pack, readable at 40px on a phone.

import type { ReactNode } from 'react'

const PATHS: Record<string, ReactNode> = {
  // Balance: a figure tilting, with a wobble line under the feet.
  balance: (
    <>
      <circle cx="10" cy="5" r="2.2" />
      <path d="M10 7.5l3 4-1 5 2 4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13 11.5l4-1" strokeLinecap="round" />
      <path d="M11 16.5l-3 4" strokeLinecap="round" />
      <path d="M3 22c1.5-1.5 3-1.5 4.5 0s3 1.5 4.5 0 3-1.5 4.5 0" strokeLinecap="round" />
    </>
  ),
  // Eyes: an eye with a line through it.
  eyes: (
    <>
      <path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6z" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="2.6" />
      <path d="M4 20L20 4" strokeLinecap="round" />
    </>
  ),
  // Face: a face whose mouth droops on one side.
  face: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="9" cy="10" r="0.6" fill="currentColor" />
      <circle cx="15" cy="10" r="0.6" fill="currentColor" />
      <path d="M8.5 15.5c1.2 1.4 3 1.8 4.5 1.2 1.2-.5 1.8-1.6 2-2.7" strokeLinecap="round" />
    </>
  ),
  // Arms: two arms, one raised and one falling.
  arms: (
    <>
      <circle cx="12" cy="4.5" r="2.2" />
      <path d="M12 7v9" strokeLinecap="round" />
      <path d="M12 9.5L18 6" strokeLinecap="round" />
      <path d="M12 9.5L6.5 14" strokeLinecap="round" />
      <path d="M9.5 16.5l-2 4.5M14.5 16.5l2 4.5" strokeLinecap="round" />
      <path d="M4 15.5l-1.5 2.5M4 15.5l2.4.6" strokeLinecap="round" />
    </>
  ),
  // Speech: a bubble with broken sound waves.
  speech: (
    <>
      <path d="M4 5h16v10H9l-5 4V5z" strokeLinejoin="round" />
      <path d="M8 9h3M13 9h3M8 12h6" strokeLinecap="round" />
    </>
  ),
  // Time: a clock, for the T of BE-FAST.
  time: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 6.5V12l3.5 2.5" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
}

export function BefastIcon({ name, className = 'h-10 w-10' }: { name: string; className?: string }) {
  const body = PATHS[name] ?? PATHS.time
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      {body}
    </svg>
  )
}
