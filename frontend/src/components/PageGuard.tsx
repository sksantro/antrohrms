import { TriangleAlert } from 'lucide-react'
import { Component, type ReactNode } from 'react'

/** If one page throws while rendering, show a message there instead of blanking the whole app; the menu keeps working. */
export default class PageGuard extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.error('Page crashed', error)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="max-w-lg mx-auto mt-16 rounded-3xl bg-white ring-1 ring-ink-100 p-10 text-center">
        <span className="size-14 rounded-2xl bg-amber-50 text-amber-600 grid place-items-center mx-auto"><TriangleAlert size={26} /></span>
        <h2 className="text-xl font-bold mt-5">This page ran into a problem</h2>
        <p className="text-ink-500 mt-2">Nothing was lost. Reload the page, or pick another item from the menu. If it keeps happening, tell the Super Admin which page it was.</p>
        <button className="btn-primary mt-6" onClick={() => window.location.reload()}>Reload page</button>
      </div>
    )
  }
}
