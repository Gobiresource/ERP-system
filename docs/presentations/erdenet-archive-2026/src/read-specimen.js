// Reads the sample page with a vision model through OpenRouter, in the shape of the paper's JSON
// (Erdenet-Archive-AI-Parser output_schema), plus where each part of the page sits. Usage:
//   NODE_USE_ENV_PROXY=1 node read-specimen.js <OpenRouter model id>     -> assets/reading-<model>.json
// The key comes from the session's proxy. On 2026-11-11 that key was refused (401), so assets/reading.json was
// made another way, with these same instructions: see README.md.
const fs = require('fs')
const path = require('path')

const TYPES = ['Тушаал', 'Протокол', 'ТЭЗҮ', 'Барилгын ажлын зураг', 'Акт', 'Статистик тайлан', 'Албан бичиг']
const DOMAINS = ['Хот, нийтийн аж ахуй', 'Байгаль орчин', 'Хүнс ба хөдөө аж ахуй', 'Эрүүл мэнд', 'Боловсрол', 'Нийгэм', 'Эдийн засаг', 'Хот төлөвлөлт ба дэд бүтэц', 'Үйлдвэрлэл технологи']
const PARTS = ['header', 'type_number_date', 'title', 'clauses', 'table', 'signature', 'stamp', 'other_mark']

const str = { type: 'string' }
const maybe = { type: ['string', 'null'] }
const obj = (properties, extra = {}) => ({ type: 'object', additionalProperties: false, required: Object.keys(properties), properties, ...extra })
const SCHEMA = obj({
  archive_location: obj({ fond_id: maybe, inventory_id: maybe, unit_id: maybe, page_number: maybe }),
  auto_classification: obj({
    document_type: { type: 'string', enum: TYPES },
    primary_research_domain: { type: 'string', enum: DOMAINS },
    secondary_tags: { type: 'array', items: str },
  }),
  document_metadata: obj({
    date: maybe,
    document_number: maybe,
    original_language: { type: 'string', enum: ['ru', 'mn', 'mixed'] },
    issuing_organization: maybe,
    signatories: { type: 'array', items: str },
  }),
  transcription: obj({ original_text: str, mongolian_translation: str }),
  extracted_entities_and_metrics: { type: 'array', items: obj({ entity_or_metric: str, value: str, related_unit: maybe }) },
  catalog_summary: str,
  verification: obj({ status: { type: 'string', enum: ['машин уншсан', 'хянасан', 'баталгаажсан'] }, uncertain_spans: { type: 'array', items: str } }),
  access_level: { type: 'string', enum: ['нээлттэй', 'хязгаарлалттай'] },
  regions: {
    type: 'array',
    items: obj({ part: { type: 'string', enum: PARTS }, box_2d: { type: 'array', items: { type: 'integer' } }, read: str }),
  },
})

const SYSTEM = `You are the pilot of an archive document parser. You read ONE scanned page from the archive of a Mongolian mining enterprise. Pages are in Russian, in Cyrillic Mongolian, or mixed. Fill in the JSON.

- archive_location: comes from the scan batch, not from the page. Give null for each unless the page itself shows it.
- transcription.original_text: the page as written, in its own language, line by line. Where a word or figure is faded, smudged or you are not sure of it, write your best reading followed by [?]. Never guess silently.
- transcription.mongolian_translation: a professional translation into Cyrillic Mongolian with Mongolian administrative and engineering terms. Keep the [?] marks at the same places.
- auto_classification.document_type: the form of the paper. primary_research_domain: the one field it serves most. secondary_tags: first any other fields from the same list that also apply, then two to four short Mongolian keywords.
- document_metadata: date as YYYY-MM-DD; document_number as written, without the № sign; issuing_organization as written, in the original language; signatories as "position, name" as written.
- extracted_entities_and_metrics: the facilities, places and figures the page names. entity_or_metric and value in Mongolian (value with its unit); related_unit: the district, shop or location in Mongolian, or null.
- catalog_summary: one or two Mongolian sentences for the catalogue.
- verification.status: "машин уншсан", because no archivist has checked this reading yet. uncertain_spans: every span you marked [?], each with a short Mongolian reason.
- access_level: "хязгаарлалттай" when the page holds personal data of private people (officials signing in their office do not count), otherwise "нээлттэй".
- regions: every visible part of the page: header (the issuing organization), type_number_date (the kind of paper with its date, number and place), title, clauses (the body with its numbered items), table, signature, stamp, and other_mark for any overprint. box_2d is [ymin, xmin, ymax, xmax], each 0-1000 relative to the picture. read: in a few Mongolian words, what you read there.
Never invent a value the page does not show: use null.`

;(async () => {
  const dir = path.join(__dirname, 'assets')
  const model = process.argv[2]
  if (!model) { console.log('usage: node read-specimen.js <OpenRouter model id>'); process.exit(2) }
  const img = fs.readFileSync(path.join(dir, 'specimen-send.jpg')).toString('base64')
  const body = {
    model,
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: [{ type: 'text', text: 'One page.' }, { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + img } }] },
    ],
    response_format: { type: 'json_schema', json_schema: { name: 'archive_page', strict: true, schema: SCHEMA } },
    provider: { zdr: true, data_collection: 'deny', require_parameters: true },
    reasoning: { effort: 'low' },
    max_tokens: 6000,
    usage: { include: true },
  }
  const t0 = Date.now()
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: 'Bearer via-proxy', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(170_000),
  })
  const data = await res.json().catch(() => null)
  const secs = ((Date.now() - t0) / 1000).toFixed(1)
  if (!res.ok) { console.log('HTTP', res.status, JSON.stringify(data)?.slice(0, 600)); process.exit(1) }
  const content = data?.choices?.[0]?.message?.content
  const tag = model.replace(/[^a-z0-9.]+/gi, '-')
  fs.writeFileSync(path.join(dir, `reading-${tag}.raw.json`), JSON.stringify({ model: data.model, provider: data.provider, usage: data.usage, seconds: +secs, content }, null, 2))
  const reading = JSON.parse(String(content).replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, ''))
  fs.writeFileSync(path.join(dir, `reading-${tag}.json`), JSON.stringify(reading, null, 2))
  console.log('model', data.model, '| provider', data.provider, '| seconds', secs, '| cost', data.usage?.cost, '| tokens', data.usage?.prompt_tokens, data.usage?.completion_tokens)
  console.log(JSON.stringify(reading, null, 2))
})().catch(e => { console.log('failed:', e.name, e.message); process.exit(1) })
