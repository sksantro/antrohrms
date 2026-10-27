import clsx from 'clsx'
import { X, type LucideIcon } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { initials } from '../lib/format'

export function PageHeader({ eyebrow, title, subtitle, actions, sample }: { eyebrow?: string; title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; sample?: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-7 animate-fade-up">
      <div>
        <div className="flex items-center gap-2 mb-1.5">
          {eyebrow && <div className="eyebrow">{eyebrow}</div>}
          {sample && <span title="This screen still shows sample data. It connects to the server in its delivery phase." className="text-[10.5px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 bg-amber-100 text-amber-800">Sample data · {sample}</span>}
        </div>
        <h1 className="text-[26px] font-bold text-ink-900 leading-tight">{title}</h1>
        {subtitle && <p className="text-ink-500 mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx('card', className)} {...rest}>{children}</div>
}

export function CardHeader({ title, subtitle, action, icon: Icon }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; icon?: LucideIcon }) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-3">
      <div className="flex items-center gap-3 min-w-0">
        {Icon && <div className="size-9 rounded-xl bg-brand-50 text-brand-600 grid place-items-center shrink-0"><Icon size={18} /></div>}
        <div className="min-w-0">
          <h3 className="font-semibold text-[15px] text-ink-900 truncate">{title}</h3>
          {subtitle && <p className="text-[12.5px] text-ink-500 truncate">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  )
}

export function Avatar({ name, hue = 260, size = 36, ring }: { name: string; hue?: number; size?: number; ring?: boolean }) {
  return (
    <div
      className={clsx('rounded-full grid place-items-center font-semibold text-white shrink-0', ring && 'ring-2 ring-white')}
      style={{
        width: size, height: size, fontSize: size * 0.36,
        background: `linear-gradient(135deg, hsl(${hue} 75% 62%), hsl(${(hue + 40) % 360} 70% 45%))`,
      }}
      aria-hidden
    >
      {initials(name)}
    </div>
  )
}

const PILL_TONES = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15',
  amber: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  red: 'bg-rose-50 text-rose-700 ring-rose-600/15',
  blue: 'bg-sky-50 text-sky-700 ring-sky-600/15',
  violet: 'bg-brand-50 text-brand-700 ring-brand-600/15',
  gray: 'bg-ink-50 text-ink-600 ring-ink-500/15',
} as const
export type Tone = keyof typeof PILL_TONES

export function Pill({ tone = 'gray', children, dot, className }: { tone?: Tone; children: ReactNode; dot?: boolean; className?: string }) {
  return (
    <span className={clsx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-medium ring-1 ring-inset whitespace-nowrap', PILL_TONES[tone], className)}>
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  )
}

export function ProgressRing({ value, size = 132, stroke = 11, color = '#6435f0', track = '#eceef5', children }: { value: number; size?: number; stroke?: number; color?: string; track?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(1, value))
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" role="img" aria-label={`${Math.round(v * 100)}% complete`}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - v)} style={{ transition: 'stroke-dashoffset .8s cubic-bezier(.2,.8,.2,1)' }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  )
}

export function Bar({ value, color = 'bg-brand-500', hex, className }: { value: number; color?: string; hex?: string; className?: string }) {
  return (
    <div className={clsx('h-2 rounded-full bg-ink-100 overflow-hidden', className)}>
      <div className={clsx('h-full rounded-full transition-all duration-700', color)} style={{ width: `${Math.min(100, Math.max(0, value * 100))}%`, background: hex }} />
    </div>
  )
}

export function StatTile({ label, value, icon: Icon, hint, tone = 'violet' }: { label: string; value: ReactNode; icon: LucideIcon; hint?: ReactNode; tone?: Tone }) {
  const tones: Record<Tone, string> = {
    violet: 'text-brand-600 bg-brand-50', green: 'text-emerald-600 bg-emerald-50', amber: 'text-amber-600 bg-amber-50',
    red: 'text-rose-600 bg-rose-50', blue: 'text-sky-600 bg-sky-50', gray: 'text-ink-500 bg-ink-50',
  }
  return (
    <Card className="p-5 hover:shadow-lift transition-shadow">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-ink-500">{label}</span>
        <span className={clsx('size-8 rounded-lg grid place-items-center', tones[tone])}><Icon size={16} /></span>
      </div>
      <div className="mt-3 text-[28px] font-display font-bold text-ink-900 leading-none">{value}</div>
      {hint && <div className="mt-2 text-[12.5px] text-ink-500">{hint}</div>}
    </Card>
  )
}

export function EmptyState({ icon: Icon, title, body, action }: { icon: LucideIcon; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center px-6 py-12">
      <div className="size-14 rounded-2xl bg-gradient-to-br from-brand-50 to-sky-50 text-brand-500 grid place-items-center mb-4"><Icon size={24} /></div>
      <h4 className="font-semibold text-ink-900">{title}</h4>
      {body && <p className="text-ink-500 mt-1 max-w-sm">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[] }) {
  return (
    <div className="inline-flex p-1 rounded-xl bg-ink-100/70" role="tablist">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value} onClick={() => onChange(o.value)}
          className={clsx('px-3.5 h-8 rounded-lg text-[13px] font-semibold transition-all',
            value === o.value ? 'bg-white text-ink-900 shadow-card' : 'text-ink-500 hover:text-ink-800')}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function useEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

// Keeps keyboard focus inside an open overlay, locks page scroll, and hands focus back to the opener on close.
export function useDialog(open: boolean) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const opener = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const el = ref.current
    const first = el?.querySelector<HTMLElement>('[autofocus]') ?? el?.querySelector<HTMLElement>(FOCUSABLE)
    first?.focus()
    const trap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !el) return
      const nodes = [...el.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((n) => n.offsetParent !== null)
      if (!nodes.length) return
      const [a, z] = [nodes[0], nodes[nodes.length - 1]]
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus() }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus() }
    }
    document.addEventListener('keydown', trap)
    return () => {
      document.removeEventListener('keydown', trap)
      document.body.style.overflow = overflow
      opener?.focus?.()
    }
  }, [open])
  return ref
}

export function Drawer({ open, onClose, title, subtitle, children, footer, wide }: { open: boolean; onClose: () => void; title: string; subtitle?: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEscape(open, onClose)
  const ref = useDialog(open)
  if (!open) return null
  return (
    <div ref={ref} className="fixed inset-0 z-50" role="dialog" aria-modal aria-label={title}>
      <div className="absolute inset-0 bg-ink-950/30 backdrop-blur-[2px] animate-fade-up" onClick={onClose} />
      <div className={clsx('absolute right-0 top-0 h-full w-full bg-white shadow-2xl flex flex-col animate-slide-in', wide ? 'max-w-[980px]' : 'max-w-[480px]')}>
        <div className="flex items-start justify-between px-6 py-5 border-b border-ink-100">
          <div>
            <h2 className="text-lg font-bold">{title}</h2>
            {subtitle && <p className="text-ink-500 text-[13px] mt-0.5">{subtitle}</p>}
          </div>
          <button className="btn-ghost btn-sm !px-2" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 scroll-thin">{children}</div>
        {footer && <div className="px-6 py-4 border-t border-ink-100 flex justify-end gap-2 bg-ink-50/40">{footer}</div>}
      </div>
    </div>
  )
}

export function Modal({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  useEscape(open, onClose)
  const ref = useDialog(open)
  if (!open) return null
  return (
    <div ref={ref} className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal aria-label={title}>
      <div className="absolute inset-0 bg-ink-950/35 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl animate-fade-up">
        <div className="px-6 pt-6"><h2 className="text-lg font-bold">{title}</h2></div>
        <div className="px-6 py-4">{children}</div>
        {footer && <div className="px-6 pb-6 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  )
}
