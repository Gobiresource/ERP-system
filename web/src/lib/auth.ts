// Signing in. Five wrong tries in a row make the next one wait 30 seconds, then twice as long each time, so a password
// cannot be guessed quickly; the count is kept in this browser (the server will keep it per login).
import { actions, getState } from './store'
import { hashOf, loginKey } from './access'
import { signIn } from './ui'

const TRIES = 'erp:tries'
const FREE = 5

function tries(): { n: number; until: number } {
  try {
    return JSON.parse(localStorage.getItem(TRIES) ?? 'null') ?? { n: 0, until: 0 }
  } catch {
    return { n: 0, until: 0 }
  }
}
const keepTries = (t: { n: number; until: number }) => {
  try { localStorage.setItem(TRIES, JSON.stringify(t)) } catch { /* private window: counted until the tab closes */ }
}

/** Seconds to wait before trying again */
export const waitLeft = () => Math.max(0, Math.ceil((tries().until - Date.now()) / 1000))

/** Signs the person in, or says why not: a wrong login or password look the same, so neither gives the other away */
export async function login(name: string, password: string): Promise<'ok' | 'wrong' | 'inactive' | 'wait'> {
  if (waitLeft()) return 'wait'
  const p = getState().people.find(x => x.account?.login === loginKey(name))
  // Hash even when there is no such login, so the answer takes as long either way
  const hash = await hashOf(password, p?.account?.salt ?? 'AAAAAAAAAAAAAAAAAAAAAA==')
  if (!p?.account || hash !== p.account.hash) {
    const t = tries()
    const n = t.n + 1
    keepTries({ n, until: n >= FREE ? Date.now() + 30_000 * 2 ** (n - FREE) : 0 })
    return n >= FREE ? 'wait' : 'wrong'
  }
  if (!p.account.active) return 'inactive'
  keepTries({ n: 0, until: 0 })
  actions.setMe(p.id)
  if (!p.companies.includes(getState().company)) actions.switchCompany(p.companies[0])
  actions.signedIn(p.id)
  signIn(p.id)
  return 'ok'
}
