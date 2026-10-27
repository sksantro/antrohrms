import clsx from 'clsx'
import { Bell, CheckCircle2, ChevronDown, CornerDownLeft, Info, LogOut, Menu, Search, ShieldCheck, X, XCircle } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { NOTIFICATIONS, ROLE_LABEL, type Role } from '../lib/data'
import { useAuth } from '../lib/auth'
import { useMe, useStore } from '../lib/store'
import { homeFor, navFor } from './nav'
import { Avatar, useDialog, useEscape } from './ui'

export function Logo({ light, size = 'md' }: { light?: boolean; size?: 'md' | 'lg' }) {
  const lg = size === 'lg'
  return (
    <div className="flex items-center gap-2.5">
      <img src="/brand/antro-mark-192.png" alt="" className={clsx('shrink-0 drop-shadow-[0_4px_10px_rgba(61,90,254,.35)]', lg ? 'size-14' : 'size-10')} />
      <div className="leading-none">
        <div className={clsx('font-display font-extrabold tracking-tight', lg ? 'text-[30px]' : 'text-[19px]', light ? 'text-white' : 'text-ink-900')}>Antro</div>
        <div className={clsx('font-semibold tracking-[.32em] mt-1', lg ? 'text-[12px]' : 'text-[9.5px]', light ? 'text-white/60' : 'text-ink-400')}>HRMS</div>
      </div>
    </div>
  )
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { role, approvals } = useStore()
  const previews = useAuth().hasRole('SUPER_ADMIN')
  const sections = navFor(role, previews)
  return (
    <nav className="flex flex-col h-full" aria-label="Main">
      <div className="px-5 h-16 flex items-center"><Logo /></div>
      <div className="flex-1 overflow-y-auto scroll-thin px-3 pb-4 space-y-6 mt-2">
        {sections.map((s) => (
          <div key={s.title}>
            <div className="eyebrow px-3 mb-2">{s.title}</div>
            <ul className="space-y-0.5">
              {s.items.map((it) => (
                <li key={it.to}>
                  <NavLink to={it.to} end onClick={onNavigate}
                    title={it.planned ? `Planned for phase ${it.planned}` : undefined}
                    className={({ isActive }) => clsx(
                      'group flex items-center gap-3 px-3 h-9 rounded-xl text-[13.5px] font-medium transition-colors',
                      isActive ? 'bg-ink-900 text-white shadow-lift' : it.planned ? 'text-ink-400 hover:bg-ink-50 hover:text-ink-600' : 'text-ink-600 hover:bg-ink-100/80 hover:text-ink-900',
                    )}>
                    {({ isActive }) => (
                      <>
                        <it.icon size={17} className={clsx(isActive ? 'text-brand-300' : it.planned ? 'text-ink-300' : 'text-ink-400 group-hover:text-ink-600')} />
                        <span className="flex-1 truncate">{it.label}</span>
                        {it.badge === 'approvals' && approvals.length > 0 && (
                          <span className={clsx('text-[11px] font-bold rounded-full px-1.5 min-w-5 text-center', isActive ? 'bg-brand-500 text-white' : 'bg-brand-100 text-brand-700')}>{approvals.length}</span>
                        )}
                        {it.planned && <span className={clsx('text-[10px] font-semibold uppercase tracking-wide rounded-full px-1.5 py-px', isActive ? 'bg-white/10 text-white/60' : 'bg-ink-50 text-ink-400 ring-1 ring-inset ring-ink-100')}>Soon</span>}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="m-3 p-4 rounded-2xl bg-gradient-to-br from-brand-600 to-brand-900 text-white relative overflow-hidden">
        <div className="absolute -right-6 -top-6 size-24 rounded-full bg-white/10" />
        <ShieldCheck size={18} className="text-brand-200" />
        <div className="text-[13px] font-semibold mt-2">Privacy by design</div>
        <p className="text-[11.5px] text-white/70 mt-0.5 leading-snug">Salary & attendance are visible only to people who are allowed to see them.</p>
      </div>
    </nav>
  )
}

function RoleSwitcher() {
  const { role, setRole, views } = useStore()
  const { logout } = useAuth()
  const me = useMe()
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  useEscape(open, useCallback(() => setOpen(false), []))
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2.5 pl-1.5 pr-2.5 h-10 rounded-xl hover:bg-ink-100 transition" aria-haspopup="menu" aria-expanded={open}>
        <Avatar name={me.name} hue={me.hue} size={30} />
        <div className="text-left leading-tight hidden sm:block">
          <div className="text-[13px] font-semibold text-ink-900">{me.name}</div>
          <div className="text-[11px] text-brand-600 font-medium">{ROLE_LABEL[role]}</div>
        </div>
        <ChevronDown size={15} className="text-ink-400" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-64 card shadow-lift p-2 z-40 animate-fade-up" role="menu">
            <div className="px-2.5 pt-1 pb-3 border-b border-ink-100 mb-2">
              <div className="text-[13px] font-semibold text-ink-900 truncate">{me.email}</div>
              <div className="text-[11.5px] text-ink-400">{me.code}</div>
            </div>
            {views.length > 1 && <div className="eyebrow px-2 pt-1 pb-2">Switch workspace</div>}
            {views.length > 1 && views.map((r: Role) => (
              <button key={r} role="menuitem" onClick={() => { setRole(r); setOpen(false); nav(homeFor(r)) }}
                className={clsx('w-full text-left flex items-center justify-between px-2.5 h-9 rounded-lg text-[13px] font-medium', r === role ? 'bg-brand-50 text-brand-700' : 'hover:bg-ink-50 text-ink-700')}>
                {ROLE_LABEL[r]}
                {r === role && <CheckCircle2 size={15} />}
              </button>
            ))}
            <div className={clsx(views.length > 1 && 'border-t border-ink-100 mt-2 pt-2')}>
              <button onClick={async () => { setOpen(false); await logout(); nav('/login', { replace: true }) }} className="w-full text-left flex items-center gap-2 px-2.5 h-9 rounded-lg text-[13px] font-medium text-ink-600 hover:bg-ink-50"><LogOut size={15} /> Sign out</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function Notifications() {
  const [open, setOpen] = useState(false)
  const [read, setRead] = useState(false)
  useEscape(open, useCallback(() => setOpen(false), []))
  const isUnread = (n: (typeof NOTIFICATIONS)[number]) => n.unread && !read
  const unread = NOTIFICATIONS.filter(isUnread).length
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="relative size-10 rounded-xl grid place-items-center text-ink-500 hover:bg-ink-100 hover:text-ink-800" aria-label={`Notifications, ${unread} unread`}>
        <Bell size={19} />
        {unread > 0 && <span className="absolute top-2 right-2.5 size-2 rounded-full bg-rose-500 ring-2 ring-white" />}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-[min(20rem,calc(100vw-2rem))] card shadow-lift z-40 animate-fade-up overflow-hidden">
            <div className="px-4 py-3 border-b border-ink-100 flex justify-between items-center">
              <span className="font-semibold">Notifications</span>
              {unread > 0
                ? <button onClick={() => setRead(true)} className="text-[12px] text-brand-600 font-medium hover:text-brand-800">Mark all read</button>
                : <span className="text-[12px] text-ink-400">All caught up</span>}
            </div>
            {NOTIFICATIONS.map((n) => (
              <div key={n.id} className="px-4 py-3 flex gap-3 hover:bg-ink-50 border-b border-ink-50 last:border-0">
                <span className={clsx('mt-1.5 size-2 rounded-full shrink-0', isUnread(n) ? 'bg-brand-500' : 'bg-transparent')} />
                <div>
                  <div className={clsx('text-[13px]', isUnread(n) ? 'text-ink-900 font-medium' : 'text-ink-600')}>{n.title}</div>
                  <div className="text-[11.5px] text-ink-400 mt-0.5">{n.time}</div>
                </div>
              </div>
            ))}
            {NOTIFICATIONS.length === 0 && <p className="px-4 py-6 text-center text-[13px] text-ink-400">No notifications yet.</p>}
          </div>
        </>
      )}
    </div>
  )
}

function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { role } = useStore()
  const previews = useAuth().hasRole('SUPER_ADMIN')
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [i, setI] = useState(0)
  const dialog = useDialog(open)
  const list = useRef<HTMLUListElement>(null)
  const items = useMemo(() => navFor(role, previews).flatMap((s) => s.items.map((it) => ({ ...it, section: s.title })))
    .filter((it, idx, all) => all.findIndex((x) => x.to === it.to) === idx)
    .filter((it) => `${it.label} ${it.section}`.toLowerCase().includes(q.trim().toLowerCase())), [role, q, previews])
  useEffect(() => { if (open) { setQ(''); setI(0) } }, [open])
  useEffect(() => { list.current?.querySelector('[data-active]')?.scrollIntoView({ block: 'nearest' }) }, [i])
  if (!open) return null
  const go = (to: string) => { nav(to); onClose() }
  return (
    <div ref={dialog} className="fixed inset-0 z-50 flex justify-center pt-[12vh] px-4" role="dialog" aria-modal aria-label="Search">
      <div className="absolute inset-0 bg-ink-950/35 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full max-w-xl card shadow-2xl overflow-hidden animate-fade-up h-fit">
        <div className="flex items-center gap-3 px-4 h-14 border-b border-ink-100">
          <Search size={18} className="text-ink-400" />
          <input value={q} aria-label="Search pages" onChange={(e) => { setQ(e.target.value); setI(0) }} placeholder="Jump to a page…"
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose()
              if (e.key === 'ArrowDown') { e.preventDefault(); setI((x) => Math.min(items.length - 1, x + 1)) }
              if (e.key === 'ArrowUp') { e.preventDefault(); setI((x) => Math.max(0, x - 1)) }
              if (e.key === 'Enter' && items[i]) go(items[i].to)
            }}
            className="flex-1 outline-none text-[15px] placeholder:text-ink-400 bg-transparent" />
          <kbd className="text-[11px] text-ink-400 border border-ink-200 rounded px-1.5 py-0.5">ESC</kbd>
        </div>
        <ul ref={list} className="max-h-80 overflow-y-auto p-2 scroll-thin">
          {items.length === 0 && <li className="px-3 py-6 text-center text-ink-400">No pages match “{q}”.</li>}
          {items.map((it, idx) => (
            <li key={it.to}>
              <button tabIndex={-1} data-active={idx === i || undefined} onMouseEnter={() => setI(idx)} onClick={() => go(it.to)}
                className={clsx('w-full flex items-center gap-3 px-3 h-11 rounded-xl text-left', idx === i ? 'bg-brand-50 text-brand-800' : 'text-ink-700')}>
                <it.icon size={17} className={idx === i ? 'text-brand-600' : 'text-ink-400'} />
                <span className="flex-1 font-medium text-[13.5px]">{it.label}{it.planned && <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-ink-400">Soon</span>}</span>
                <span className="text-[11.5px] text-ink-400">{it.section}</span>
                {idx === i && <CornerDownLeft size={14} className="text-brand-500" />}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function Toasts() {
  const { toasts, dismissToast } = useStore()
  return (
    <div className="fixed bottom-4 right-4 left-4 sm:left-auto sm:bottom-5 sm:right-5 z-[60] space-y-2 sm:w-[340px]" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} role={t.tone === 'error' ? 'alert' : 'status'} className={clsx('card shadow-lift px-4 py-3 flex gap-3 animate-fade-up border-l-4',
          t.tone === 'success' ? 'border-l-emerald-400' : t.tone === 'error' ? 'border-l-rose-400' : 'border-l-brand-400')}>
          {t.tone === 'success' ? <CheckCircle2 size={19} className="text-emerald-500 shrink-0 mt-0.5" /> : t.tone === 'error' ? <XCircle size={19} className="text-rose-500 shrink-0 mt-0.5" /> : <Info size={19} className="text-brand-500 shrink-0 mt-0.5" />}
          <div className="flex-1">
            <div className="text-[13.5px] font-semibold text-ink-900">{t.title}</div>
            {t.body && <div className="text-[12.5px] text-ink-500 mt-0.5">{t.body}</div>}
          </div>
          <button onClick={() => dismissToast(t.id)} className="text-ink-300 hover:text-ink-600" aria-label="Dismiss"><X size={15} /></button>
        </div>
      ))}
    </div>
  )
}

export default function Shell() {
  const [cmd, setCmd] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)
  const loc = useLocation()
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setCmd((c) => !c) } }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])
  useEffect(() => { window.scrollTo(0, 0) }, [loc.pathname])
  const { role } = useStore()
  const previews = useAuth().hasRole('SUPER_ADMIN')
  const page = navFor(role, previews).flatMap((s) => s.items).find((it) => it.to === loc.pathname)
  useEffect(() => { document.title = page ? `${page.label} · antro.hr` : 'antro.hr' }, [page])
  const closeNav = useCallback(() => setMobileNav(false), [])
  useEscape(mobileNav, closeNav)
  const navRef = useDialog(mobileNav)

  return (
    <div className="min-h-screen flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[70] btn-dark">Skip to content</a>
      <aside className="hidden lg:block w-[260px] shrink-0 border-r border-ink-100 bg-white/70 backdrop-blur sticky top-0 h-screen">
        <Sidebar />
      </aside>
      {mobileNav && (
        <div ref={navRef} className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal aria-label="Menu">
          <div className="absolute inset-0 bg-ink-950/30 backdrop-blur-[2px] animate-fade-up" onClick={closeNav} />
          <aside className="absolute left-0 top-0 h-full w-[280px] max-w-[85vw] bg-white shadow-2xl animate-slide-in-left">
            <button className="absolute right-3 top-4 btn-ghost btn-sm !px-2 z-10" onClick={closeNav} aria-label="Close menu"><X size={18} /></button>
            <Sidebar onNavigate={closeNav} />
          </aside>
        </div>
      )}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-20 h-16 flex items-center gap-3 px-4 sm:px-8 bg-canvas/80 backdrop-blur-md border-b border-ink-100/70">
          <button className="lg:hidden btn-ghost !px-2" onClick={() => setMobileNav(true)} aria-label="Open menu"><Menu size={20} /></button>
          <button onClick={() => setCmd(true)} className="flex items-center gap-2.5 h-10 px-3.5 rounded-xl bg-white border border-ink-200 text-ink-400 text-[13px] w-full max-w-sm hover:border-ink-300 transition">
            <Search size={16} />
            <span className="flex-1 text-left">Search pages…</span>
            <kbd className="hidden sm:inline text-[11px] border border-ink-200 rounded px-1.5 py-0.5">Ctrl K</kbd>
          </button>
          <div className="flex-1" />
          <Notifications />
          <RoleSwitcher />
        </header>
        <main id="main" tabIndex={-1} className="flex-1 px-4 sm:px-8 py-6 sm:py-8 max-w-[1440px] w-full mx-auto outline-none">
          <Outlet />
        </main>
      </div>
      <CommandPalette open={cmd} onClose={() => setCmd(false)} />
      <Toasts />
    </div>
  )
}
