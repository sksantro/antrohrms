import clsx from 'clsx'
import { Briefcase, Check, KeyRound, Search, ShieldCheck, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Avatar, Card, CardHeader, Drawer, PageHeader, Pill, type Tone } from '../../components/ui'
import { api, type AccessDTO, type ServerRole } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { useStore } from '../../lib/store'
import { errMsg, useApi } from '../../lib/useApi'

const SHORT: Record<string, { label: string; tone: Tone }> = {
  SUPER_ADMIN: { label: 'Super Admin', tone: 'violet' }, HR_OPERATIONS: { label: 'HR', tone: 'blue' },
  REPORTING_MANAGER: { label: 'RM', tone: 'amber' }, EMPLOYEE: { label: 'Employee', tone: 'gray' },
}
const WHY = { DESIGNATION: 'from designation', REPORTING_LINE: 'has people reporting to them', MANUAL: '' }
const AUTO: ServerRole[] = ['HR_OPERATIONS', 'REPORTING_MANAGER']

/** Who can do what: the four roles, each person's roles (and why), and roles given automatically by designation. */
export default function AccessAdmin() {
  const { data, error, reload } = useApi(() => api.access(), [])
  const [q, setQ] = useState('')
  const [edit, setEdit] = useState<AccessDTO['people'][number] | null>(null)
  const people = useMemo(() => (data?.people ?? []).filter((p) => `${p.display_name} ${p.designation} ${p.employee_code ?? ''}`.toLowerCase().includes(q.toLowerCase())), [data, q])
  const count = (r: string) => data?.people.filter((p) => p.roles.some((x) => x.role === r)).length ?? 0

  return (
    <>
      <PageHeader eyebrow="Console" title="Access Management" subtitle="Four roles decide what each person can see and do. HR and RM can be given automatically by designation or reporting line." />
      {error && <Card className="p-5 text-rose-700 mb-5">{error}</Card>}

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {(data?.roles ?? []).map((r) => (
          <Card key={r.role} className="p-5">
            <Pill tone={SHORT[r.role].tone}>{r.name}</Pill>
            <div className="text-[28px] font-bold text-ink-900 mt-3 leading-none">{count(r.role)}</div>
            <div className="text-[12.5px] text-ink-500 mt-1">{count(r.role) === 1 ? 'person' : 'people'}</div>
          </Card>
        ))}
      </div>

      <Card className="mb-6 overflow-x-auto">
        <CardHeader icon={KeyRound} title="What each role can do" subtitle="Enforced by the server on every request" />
        <table className="w-full text-[13.5px] min-w-[640px]">
          <thead><tr className="text-left text-[12px] text-ink-500 border-y border-ink-100">
            <th className="px-5 py-2.5 font-medium">Area</th>{data?.roles.map((r) => <th key={r.role} className="px-3 font-medium">{SHORT[r.role].label}</th>)}
          </tr></thead>
          <tbody>
            {data?.matrix.map((m) => (
              <tr key={m.capability} className="border-b border-ink-50 last:border-0">
                <td className="px-5 py-2.5 text-ink-800">{m.capability}</td>
                {data.roles.map((r) => {
                  const v = m.access[r.role]
                  return <td key={r.role} className={clsx('px-3', v === '—' ? 'text-ink-300' : 'text-ink-800')}>{v === 'Yes' ? <Check size={16} className="text-emerald-600" /> : v}</td>
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="grid xl:grid-cols-[minmax(0,1fr)_400px] gap-6 items-start">
        <Card>
          <CardHeader icon={Users} title="People and their roles" action={
            <div className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" /><input className="input pl-9 h-9 w-56" placeholder="Search name or designation" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          } />
          <ul className="divide-y divide-ink-100">
            {people.map((p) => (
              <li key={p.id}>
                <button className="w-full flex flex-wrap items-center gap-3 px-5 py-3 text-left hover:bg-ink-50/60" onClick={() => setEdit(p)}>
                  <Avatar name={p.display_name} size={36} />
                  <div className="min-w-0 flex-1"><div className="font-semibold text-ink-900">{p.display_name}</div><div className="text-[12.5px] text-ink-500">{p.designation}</div></div>
                  <div className="flex flex-wrap gap-1.5 justify-end">
                    {p.roles.filter((r) => r.role !== 'EMPLOYEE').map((r) => <Pill key={r.role} tone={SHORT[r.role].tone}>{SHORT[r.role].label}{r.source !== 'MANUAL' && <span className="opacity-60"> · auto</span>}</Pill>)}
                    {p.roles.every((r) => r.role === 'EMPLOYEE') && <Pill tone="gray">Employee</Pill>}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </Card>
        <DesignationRules data={data} onDone={reload} />
      </div>
      {edit && <EditRoles person={edit} onClose={() => setEdit(null)} onDone={() => { setEdit(null); reload() }} />}
    </>
  )
}

function DesignationRules({ data, onDone }: { data: AccessDTO | null; onDone: () => void }) {
  const { toast } = useStore()
  const [busy, setBusy] = useState('')
  const toggle = async (d: AccessDTO['designations'][number], role: ServerRole) => {
    const roles = d.roles.includes(role) ? d.roles.filter((r) => r !== role) : [...d.roles, role]
    setBusy(d.designation)
    try {
      const r = await api.setDesignationRoles(d.designation, roles)
      toast({ tone: 'success', title: 'Designation rule saved', body: `${r.people_updated} ${r.people_updated === 1 ? 'person' : 'people'} updated. New joiners with this designation get it too.` })
      onDone()
    } catch (e) { toast({ tone: 'error', title: 'Couldn’t save', body: errMsg(e) }) } finally { setBusy('') }
  }
  return (
    <Card>
      <CardHeader icon={Briefcase} title="Roles by designation" subtitle="Tick to give a role to everyone with that designation" />
      <div className="px-5 pb-5">
        <div className="grid grid-cols-[minmax(0,1fr)_56px_56px] gap-2 text-[11.5px] text-ink-500 font-medium pb-2 border-b border-ink-100"><span>Designation</span><span className="text-center">HR</span><span className="text-center">RM</span></div>
        <ul className="divide-y divide-ink-50">
          {data?.designations.map((d) => (
            <li key={d.designation} className="grid grid-cols-[minmax(0,1fr)_56px_56px] gap-2 items-center py-2.5">
              <span className="min-w-0"><span className="block truncate text-[13.5px] text-ink-800">{d.designation}</span><span className="text-[11.5px] text-ink-400">{d.people} {d.people === 1 ? 'person' : 'people'}</span></span>
              {AUTO.map((r) => (
                <span key={r} className="grid place-items-center">
                  <input type="checkbox" className="size-4 accent-brand-600" aria-label={`${SHORT[r].label} for ${d.designation}`} disabled={busy === d.designation} checked={d.roles.includes(r)} onChange={() => toggle(d, r)} />
                </span>
              ))}
            </li>
          ))}
        </ul>
        <p className="text-[12px] text-ink-400 mt-3">Anyone with people reporting to them becomes RM automatically. Super Admin is only ever given by hand.</p>
      </div>
    </Card>
  )
}

function EditRoles({ person, onClose, onDone }: { person: AccessDTO['people'][number]; onClose: () => void; onDone: () => void }) {
  const { me } = useAuth()
  const { toast } = useStore()
  const src = Object.fromEntries(person.roles.map((r) => [r.role, r.source]))
  const [roles, setRoles] = useState<ServerRole[]>(person.roles.map((r) => r.role))
  const [busy, setBusy] = useState(false)
  const self = me?.employee?.id === person.id
  const save = async () => {
    setBusy(true)
    try { await api.setRoles(person.id, roles); toast({ tone: 'success', title: 'Roles saved', body: 'They take effect on the person’s next page load.' }); onDone() }
    catch (e) { toast({ tone: 'error', title: 'Couldn’t save', body: errMsg(e) }) } finally { setBusy(false) }
  }
  return (
    <Drawer open onClose={onClose} title={person.display_name} subtitle={person.designation}
      footer={<div className="w-full flex justify-end gap-2"><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy} onClick={save}>Save roles</button></div>}>
      <div className="space-y-2">
        {(['SUPER_ADMIN', 'HR_OPERATIONS', 'REPORTING_MANAGER', 'EMPLOYEE'] as ServerRole[]).map((r) => {
          const auto = src[r] && src[r] !== 'MANUAL'
          const locked = r === 'EMPLOYEE' || !!auto || (r === 'SUPER_ADMIN' && self)
          const on = roles.includes(r)
          return (
            <label key={r} className={clsx('flex items-center justify-between rounded-xl px-3.5 py-2.5 ring-1', on ? 'ring-brand-200 bg-brand-50/50' : 'ring-ink-100', locked ? 'opacity-75' : 'cursor-pointer hover:ring-brand-300')}>
              <span>
                <span className="text-[13.5px] font-medium">{r === 'REPORTING_MANAGER' ? 'Reporting Manager (RM)' : SHORT[r].label}</span>
                {auto && <span className="block text-[12px] text-ink-500">Automatic: {WHY[src[r] as keyof typeof WHY]}</span>}
                {r === 'SUPER_ADMIN' && self && <span className="block text-[12px] text-ink-500">You can’t remove your own Super Admin role</span>}
              </span>
              <input type="checkbox" className="size-4 accent-brand-600" checked={on} disabled={locked} onChange={() => setRoles((x) => (on ? x.filter((y) => y !== r) : [...x, r]))} />
            </label>
          )
        })}
      </div>
      <p className="flex gap-2 text-[12px] text-ink-500 mt-4"><ShieldCheck size={14} className="shrink-0 mt-px" /> Every change is recorded in the Audit Trail.</p>
    </Drawer>
  )
}
