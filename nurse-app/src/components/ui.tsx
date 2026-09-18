// Shared building blocks. Touch targets stay at 48px or more everywhere and
// 56px for the main actions on phones (TZ §12).

import type {
  ButtonHTMLAttributes, ComponentType, InputHTMLAttributes, ReactNode, SVGProps, TextareaHTMLAttributes,
} from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { LinkProps } from 'react-router-dom'
import { ChevronLeft, CircleAlert, Clock, Info, LoaderCircle, TriangleAlert } from 'lucide-react'
import type { Zone } from '../api/types'
import { zoneLabel } from '../lib/labels'
import { zoneStyle } from '../lib/zone'

export type Icon = ComponentType<SVGProps<SVGSVGElement> & { className?: string }>

/* ------------------------------------------------------------------ buttons */

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'brandOutline'
type Size = 'md' | 'lg'

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-brand-600 text-white shadow-sm hover:bg-brand-700 active:bg-brand-800 ' +
    'disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none',
  secondary:
    'border border-slate-300 bg-white text-slate-900 shadow-sm hover:bg-slate-50 active:bg-slate-100 ' +
    'disabled:text-slate-400',
  danger: 'bg-red-600 text-white shadow-sm hover:bg-red-700 active:bg-red-800',
  ghost: 'text-brand-700 hover:bg-brand-50 active:bg-brand-100',
  brandOutline:
    'border border-brand-300 bg-brand-50 text-brand-800 hover:bg-brand-100 active:bg-brand-200 ' +
    'disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400',
}

const SIZES: Record<Size, string> = {
  md: 'min-h-12 px-4 text-base',
  lg: 'min-h-14 px-5 text-lg lg:min-h-12 lg:text-base',
}

export function buttonClass(variant: Variant = 'primary', size: Size = 'lg', block = true): string {
  return (
    'inline-flex select-none items-center justify-center gap-2 rounded-xl font-semibold ' +
    'transition-colors duration-150 ' +
    `${block ? 'w-full ' : ''}${SIZES[size]} ${VARIANTS[variant]}`
  )
}

export function Button({
  variant = 'primary',
  size = 'lg',
  block = true,
  className = '',
  children,
  type = 'button',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; block?: boolean }) {
  return (
    <button type={type} className={`${buttonClass(variant, size, block)} ${className}`} {...rest}>
      {children}
    </button>
  )
}

export function ButtonLink({
  variant = 'secondary',
  size = 'lg',
  block = true,
  className = '',
  ...rest
}: LinkProps & { variant?: Variant; size?: Size; block?: boolean }) {
  return <Link className={`${buttonClass(variant, size, block)} ${className}`} {...rest} />
}

/** Square 48px icon button with a visible or screen-reader label. */
export function IconButton({
  label,
  icon: IconCmp,
  tone = 'light',
  showLabel = false,
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string
  icon: Icon
  tone?: 'light' | 'dark'
  showLabel?: boolean
}) {
  const tones = {
    light: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200',
    dark: 'text-slate-200 hover:bg-white/10 hover:text-white active:bg-white/15',
  }
  return (
    <button
      type="button"
      aria-label={showLabel ? undefined : label}
      title={label}
      className={`inline-flex min-h-12 min-w-12 shrink-0 items-center justify-center gap-2 rounded-xl ${
        showLabel ? 'px-3 text-base font-semibold' : ''
      } transition-colors ${tones[tone]} ${className}`}
      {...rest}
    >
      <IconCmp className="h-5 w-5" aria-hidden="true" />
      {showLabel ? <span>{label}</span> : null}
    </button>
  )
}

/* -------------------------------------------------------------------- cards */

export function Card({
  children,
  className = '',
  padded = true,
}: {
  children: ReactNode
  className?: string
  padded?: boolean
}) {
  return (
    <section
      className={`rounded-2xl border border-slate-200 bg-white shadow-card ${padded ? 'p-4 sm:p-5' : ''} ${className}`}
    >
      {children}
    </section>
  )
}

export function CardTitle({
  icon: IconCmp,
  children,
  action,
  className = '',
}: {
  icon?: Icon
  children: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={`mb-3 flex items-center gap-2.5 ${className}`}>
      {IconCmp ? <IconCmp className="h-5 w-5 shrink-0 text-slate-500" aria-hidden="true" /> : null}
      <h2 className="min-w-0 flex-1 text-lg font-semibold tracking-tight text-slate-900 lg:text-base">
        {children}
      </h2>
      {action}
    </div>
  )
}

/* ------------------------------------------------------------------- inputs */

/** Input look without size: callers add min-height and padding, so no two
 *  utilities for the same property ever meet on one element. */
export const INPUT_BASE =
  'block w-full rounded-xl border border-slate-300 bg-white text-slate-900 shadow-xs ' +
  'outline-hidden transition placeholder:text-slate-400 ' +
  'focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 disabled:bg-slate-50'

export const INPUT_CLASS = `${INPUT_BASE} min-h-13 px-4`

export function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="mb-1.5 block text-base font-medium text-slate-700">{children}</span>
}

export function Field({
  label,
  hint,
  className = '',
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: ReactNode }) {
  return (
    <label className="block min-w-0">
      <FieldLabel>{label}</FieldLabel>
      <input className={`${INPUT_CLASS} ${className}`} {...rest} />
      {hint ? <span className="mt-1.5 block text-sm text-slate-500">{hint}</span> : null}
    </label>
  )
}

export function TextArea({
  label,
  className = '',
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  return (
    <label className="block">
      <FieldLabel>{label}</FieldLabel>
      <textarea className={`${INPUT_BASE} min-h-28 resize-y px-4 py-3 leading-snug ${className}`} {...rest} />
    </label>
  )
}

/** Big pressable choice (sex, onset quick picks, flags). Pressed = filled. */
export function ChoiceButton({
  pressed,
  tone = 'brand',
  size = 'lg',
  stacked = false,
  spread = false,
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  pressed: boolean
  tone?: 'brand' | 'danger' | 'ink'
  size?: 'md' | 'lg'
  /** Icon above the label on narrow containers, side by side from @xl. */
  stacked?: boolean
  /** Label left, value right (the red-flag toggles). */
  spread?: boolean
}) {
  const on = {
    brand: 'border-brand-600 bg-brand-600 text-white shadow-sm',
    danger: 'border-red-600 bg-red-600 text-white shadow-sm',
    ink: 'border-slate-700 bg-slate-700 text-white shadow-sm',
  }
  const sizes = { md: 'text-base', lg: 'text-lg lg:text-base' }
  const layout = stacked ? 'flex-col gap-1 py-2 @xl:flex-row @xl:gap-2 @xl:py-0' : 'gap-2'
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={`inline-flex min-h-14 items-center rounded-xl border px-3 font-semibold transition-colors lg:min-h-12 ${
        spread ? 'justify-between text-left' : 'justify-center'
      } ${
        sizes[size]
      } ${layout} ${
        pressed ? on[tone] : 'border-slate-300 bg-white text-slate-800 hover:border-slate-400 hover:bg-slate-50'
      } ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}

/* ------------------------------------------------------------ status marks */

export function ZoneBadge({
  zone,
  size = 'md',
  className = '',
}: {
  zone: Zone | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const sizes = {
    sm: 'px-2 py-0.5 text-sm gap-1.5',
    md: 'px-2.5 py-1 text-sm gap-2',
    lg: 'px-3 py-1.5 text-base gap-2',
  }
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-lg font-bold tracking-wide ${sizes[size]} ${
        zoneStyle(zone).badge
      } ${className}`}
    >
      <span aria-hidden="true" className="h-2 w-2 rounded-full bg-current opacity-80" />
      {zone ? zoneLabel(zone) : 'ZONA YOʻQ'}
    </span>
  )
}

/** F-08: anything still sitting in the offline queue says so, in words. */
export function PendingBadge({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-dashed border-slate-400 bg-slate-50 px-2 py-0.5 text-sm font-semibold text-slate-700 ${className}`}
    >
      <Clock className="h-4 w-4" aria-hidden="true" />
      Yuborish kutilmoqda
    </span>
  )
}

export function Chip({
  children,
  tone = 'slate',
  icon: IconCmp,
}: {
  children: ReactNode
  tone?: 'slate' | 'green' | 'brand' | 'red' | 'amber'
  icon?: Icon
}) {
  const tones = {
    slate: 'bg-slate-100 text-slate-700',
    green: 'bg-green-50 text-green-800 ring-1 ring-inset ring-green-200',
    brand: 'bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-200',
    red: 'bg-red-50 text-red-800 ring-1 ring-inset ring-red-200',
    amber: 'bg-amber-50 text-amber-900 ring-1 ring-inset ring-amber-200',
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-sm font-medium ${tones[tone]}`}
    >
      {IconCmp ? <IconCmp className="h-3.5 w-3.5" aria-hidden="true" /> : null}
      {children}
    </span>
  )
}

export function Spinner({ className = 'h-5 w-5' }: { className?: string }) {
  return <LoaderCircle className={`animate-spin ${className}`} aria-hidden="true" />
}

/* ---------------------------------------------------------------- messages */

/** The permanent line next to every AI result (TZ §12). */
export function Disclaimer({ text, className = '' }: { text: string; className?: string }) {
  return (
    <p
      role="note"
      className={`flex items-start gap-2.5 rounded-xl bg-slate-200/60 px-3.5 py-2.5 text-base font-medium text-slate-700 ${className}`}
    >
      <Info className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" aria-hidden="true" />
      <span>{text}</span>
    </p>
  )
}

export function ErrorBanner({ message, action }: { message: string | null; action?: ReactNode }) {
  if (!message) return null
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-base text-red-800"
    >
      <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden="true" />
      <div className="min-w-0 flex-1 break-words">{message}</div>
      {action}
    </div>
  )
}

export function InfoBanner({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-base text-amber-950">
      <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

export function Notice({
  icon: IconCmp = Info,
  children,
  action,
}: {
  icon?: Icon
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-800 shadow-card">
      <IconCmp className="h-5 w-5 shrink-0 text-slate-500" aria-hidden="true" />
      {/* 12rem floor: on phones the action wraps below instead of squeezing the text. */}
      <div className="min-w-48 flex-1">{children}</div>
      {action}
    </div>
  )
}

export function EmptyState({
  icon: IconCmp,
  title,
  children,
  action,
  className = '',
}: {
  icon: Icon
  title: string
  children?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={`flex flex-col items-center px-6 py-10 text-center ${className}`}>
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 ring-1 ring-slate-200">
        <IconCmp className="h-7 w-7" aria-hidden="true" />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-slate-900">{title}</h3>
      {children ? <div className="mt-1 max-w-sm text-base text-slate-600">{children}</div> : null}
      {action ? <div className="mt-5 w-full max-w-xs">{action}</div> : null}
    </div>
  )
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-lg bg-slate-200/80 ${className}`} />
}

/* ------------------------------------------------------------------ layout */

/**
 * One screen. Below 1024px it owns the page: dark app bar, content, sticky
 * bottom action. From 1024px it sits in the desktop detail pane (see
 * AppShell), which is its own scroll container, so the same sticky header and
 * footer stick inside the pane.
 */
export function Screen({
  title,
  subtitle,
  back,
  right,
  children,
  footer,
  footerNote,
}: {
  title: string
  subtitle?: ReactNode
  back?: string | number
  right?: ReactNode
  children: ReactNode
  footer?: ReactNode
  footerNote?: ReactNode
}) {
  const navigate = useNavigate()
  // On desktop the case list is always on screen, so "back to the list" is redundant.
  const backHiddenOnDesktop = back === '/'
  return (
    <div className="flex min-h-dvh flex-col lg:min-h-full">
      <header className="sticky top-0 z-30 bg-slate-900 text-white shadow-sm lg:border-b lg:border-slate-200 lg:bg-white/95 lg:text-slate-900 lg:shadow-none lg:backdrop-blur">
        <div className="mx-auto flex min-h-16 w-full max-w-5xl items-center gap-2 px-2 py-2 sm:px-4 lg:max-w-none lg:px-6 xl:px-8">
          {back !== undefined ? (
            <button
              type="button"
              aria-label="Orqaga"
              title="Orqaga"
              onClick={() => (typeof back === 'number' ? navigate(back) : navigate(back))}
              className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white hover:bg-white/10 active:bg-white/15 lg:-ml-3 lg:text-slate-700 lg:hover:bg-slate-100 ${
                backHiddenOnDesktop ? 'lg:hidden' : ''
              }`}
            >
              <ChevronLeft className="h-7 w-7" aria-hidden="true" />
            </button>
          ) : (
            <span className="w-2 lg:hidden" />
          )}
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-semibold tracking-tight">{title}</h1>
            {subtitle ? (
              <div className="truncate text-sm text-slate-300 lg:text-slate-500">{subtitle}</div>
            ) : null}
          </div>
          {right}
        </div>
      </header>

      <main className="flex-1">
        <div className="@container mx-auto w-full max-w-5xl space-y-4 px-4 pt-4 pb-8 sm:space-y-5 sm:px-6 sm:pt-6 lg:max-w-6xl xl:px-8">
          {children}
        </div>
      </main>

      {footer ? (
        // A container, so the footer follows the pane width on desktop, not the window width.
        <div className="@container sticky bottom-0 z-30 border-t border-slate-200 bg-white/95 shadow-[0_-4px_16px_-8px_rgb(15_23_42/0.12)] backdrop-blur">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 @xl:flex-row @xl:items-center @xl:justify-end lg:max-w-6xl xl:px-8">
            {footerNote ? (
              <div className="hidden text-base text-slate-500 @xl:mr-auto @xl:block">{footerNote}</div>
            ) : null}
            {footer}
          </div>
        </div>
      ) : null}
    </div>
  )
}

/** Width rule for the one primary action inside a Screen footer. */
export const FOOTER_ACTION = '@xl:w-auto @xl:min-w-64'
