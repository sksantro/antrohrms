const TZ = 'Asia/Kolkata'

export const inr = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

// DD MMM YYYY per BRD §14.5
export const fmtDate = (iso: string | number | Date, opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' }) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: TZ, ...opts }).format(typeof iso === 'string' ? new Date(iso + (iso.length === 10 ? 'T00:00:00+05:30' : '')) : iso)

export const fmtTime = (t: number | Date) =>
  new Intl.DateTimeFormat('en-IN', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: true }).format(t)

export const fmtMonth = (ym: string) => fmtDate(ym + '-01', { month: 'long', year: 'numeric' })

export function hms(sec: number) {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
export function hm(sec: number) {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60)
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`
}
export const mmss = (sec: number) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`

export const initials = (name: string) => name.split(' ').map((p) => p[0]).slice(0, 2).join('')

export const greeting = (d = new Date()) => {
  const h = Number(new Intl.DateTimeFormat('en-IN', { timeZone: TZ, hour: 'numeric', hour12: false }).format(d))
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}
