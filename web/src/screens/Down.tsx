// Shown instead of the app when its server does not answer (lib/sync.ts boot). The app never carries on without it there:
// what a person then wrote would stay in their own browser, and nobody else would see it.
import { CloudOff } from 'lucide-react'
import '../styles/screens/login.css'
import { Wallpaper } from '../shell/Wallpaper'

export default function Down() {
  return (
    <div className="login">
      <Wallpaper />
      <main className="login__main">
        <section className="login__card glass glass--thick" aria-labelledby="down-t">
          <span className="login__icon" aria-hidden="true"><CloudOff className="ico" /></span>
          <h1 className="login__title" id="down-t">Сервертэй холбогдож чадсангүй</h1>
          <p className="login__sub">Интернэт холболтоо шалгаад дахин оролдоно уу.</p>
          <button type="button" className="btn btn--accent login__go" onClick={() => location.reload()} autoFocus>Дахин оролдох</button>
        </section>
      </main>
    </div>
  )
}
