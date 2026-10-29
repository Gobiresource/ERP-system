#!/usr/bin/env node
// Asks Google Gemini to write or review Mongolian text (see CLAUDE.md, "Монгол текст ба Gemini").
// The key comes from GEMINI_API_KEY in the environment settings; it is never stored in the repo or written in chat.
// On the free tier Google may keep and read what is sent, so send UI text and demo data only, no personal data.
//
//   node tools/gemini.mjs "Write ..."                    a prompt
//   cat draft.txt | node tools/gemini.mjs "Improve ..."  an instruction plus text from stdin
//   node tools/gemini.mjs --models                       models this key can use
// GEMINI_MODEL picks the model.

const key = process.env.GEMINI_API_KEY
if (!key) {
  console.error('GEMINI_API_KEY is not set. Add it in the environment settings, then start a new session.')
  process.exit(1)
}
const base = 'https://generativelanguage.googleapis.com/v1beta'
const headers = { 'content-type': 'application/json', 'x-goog-api-key': key }

async function call(path, body) {
  const res = await fetch(`${base}/${path}`, body ? { method: 'POST', headers, body: JSON.stringify(body) } : { headers })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    console.error(`Gemini ${res.status}: ${json.error?.message ?? res.statusText}`)
    if (res.status === 404) console.error('Run with --models and set GEMINI_MODEL to one of them.')
    process.exit(1)
  }
  return json
}

if (process.argv[2] === '--models') {
  const { models = [] } = await call('models?pageSize=200')
  for (const m of models) if (m.supportedGenerationMethods?.includes('generateContent')) console.log(m.name.replace('models/', ''), '-', m.displayName)
  process.exit(0)
}

let input = ''
if (!process.stdin.isTTY) for await (const chunk of process.stdin) input += chunk
const prompt = [process.argv.slice(2).join(' '), input.trim()].filter(Boolean).join('\n\n')
if (!prompt) {
  console.error('Nothing to send: give a prompt or pipe text in.')
  process.exit(1)
}

const model = process.env.GEMINI_MODEL || 'gemini-2.5-pro'
const out = await call(`models/${model}:generateContent`, { contents: [{ role: 'user', parts: [{ text: prompt }] }] })
console.log(out.candidates?.[0]?.content?.parts?.map(p => p.text ?? '').join('') ?? '')
