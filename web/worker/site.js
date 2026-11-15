// Cloudflare: serves the built app (dist) from Workers KV (wrangler.jsonc "site"). The app keeps its pages in the address
// hash, so every page is index.html. /api is the ERP's server (server/api.ts): sign-in and the data everyone shares, in
// the D1 database bound as DB, their files in the KV namespace bound as FILES (docs/decisions.md, 2026-11-15); the scan
// reader with the OpenRouter key and Ирц with the
// Timely keys the user put in the Worker's secrets, for whoever is signed in. ATTENDANCE_CODE, also a secret, is asked
// for once, when the system is set up; without it nobody can set it up here.
// Not Workers static assets: the session's network proxy puts the API token on every api.cloudflare.com request, which
// replaces the one-off token static-asset uploads need; KV is written with the API token itself.
import manifestJSON from '__STATIC_CONTENT_MANIFEST'
import { handleApi } from '../server/api.ts'
import { kvFiles } from '../server/files.ts'

const manifest = JSON.parse(manifestJSON)
const TYPES = {
  html: 'text/html; charset=utf-8', js: 'text/javascript', mjs: 'text/javascript', css: 'text/css', json: 'application/json',
  webp: 'image/webp', png: 'image/png', svg: 'image/svg+xml', ico: 'image/x-icon', woff2: 'font/woff2',
}

export default {
  async fetch(request, env) {
    const path = decodeURIComponent(new URL(request.url).pathname).replace(/^\/+/, '') || 'index.html'
    if (path.startsWith('api/')) return (await handleApi(request, { ...env, FILES: env.FILES && kvFiles(env.FILES), ATTENDANCE_CODE: env.ATTENDANCE_CODE ?? '' })) ?? new Response('Олдсонгүй.', { status: 404 })
    const file = manifest[path] ? path : 'index.html'
    let body = await env.__STATIC_CONTENT.get(manifest[file], file === 'index.html' ? 'text' : 'arrayBuffer')
    if (!body) return new Response('Олдсонгүй.', { status: 404 })
    // The page is told that a server stands behind it: it then never falls back to keeping data in the browser alone
    // when the server cannot be reached for a moment (src/lib/sync.ts)
    if (file === 'index.html' && env.DB) body = body.replace('<html', '<html data-server')
    return new Response(body, {
      headers: {
        'content-type': TYPES[file.split('.').pop()] ?? 'application/octet-stream',
        // Built files carry their hash in the name and never change; the page itself is asked for again each time
        'cache-control': file.startsWith('assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
        'x-content-type-options': 'nosniff',
      },
    })
  },
}
