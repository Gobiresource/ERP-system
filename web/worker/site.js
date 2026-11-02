// Cloudflare: serves the built app (dist) from Workers KV (wrangler.jsonc "site"). The app keeps its pages in the address
// hash, so every page is index.html. /api/scan is the scan reader (server/scan.ts) with the OpenRouter key the user put in
// the Worker's secrets; the Timely server still waits for sign-in on the server (docs/decisions.md, 2026-11-02).
// Not Workers static assets: the session's network proxy puts the API token on every api.cloudflare.com request, which
// replaces the one-off token static-asset uploads need; KV is written with the API token itself.
import manifestJSON from '__STATIC_CONTENT_MANIFEST'
import { handleScan } from '../server/scan.ts'

const manifest = JSON.parse(manifestJSON)
const TYPES = {
  html: 'text/html; charset=utf-8', js: 'text/javascript', mjs: 'text/javascript', css: 'text/css', json: 'application/json',
  webp: 'image/webp', png: 'image/png', svg: 'image/svg+xml', ico: 'image/x-icon', woff2: 'font/woff2',
}

export default {
  async fetch(request, env) {
    const path = decodeURIComponent(new URL(request.url).pathname).replace(/^\/+/, '') || 'index.html'
    if (path === 'api/scan') return handleScan(request, env)
    if (path.startsWith('api/')) return new Response('Сервер хараахан байхгүй.', { status: 404 })
    const file = manifest[path] ? path : 'index.html'
    const body = await env.__STATIC_CONTENT.get(manifest[file], 'arrayBuffer')
    if (!body) return new Response('Олдсонгүй.', { status: 404 })
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
