# Төслийн skill-үүд

Энэ хавтсанд байгаа skill-үүдийг Claude Code энэ repo дээр ажиллах бүрт автоматаар ачаална.

| Skill | Юунд | Эх сурвалж | Лиценз |
|---|---|---|---|
| `erp-ui-guidelines` | ERP-ийн дэлгэц, компонент зохиох болон шалгах дүрэм | Энэ төсөлд бичсэн (NN/g, Carbon, Polaris, GOV.UK, WCAG 2.2, Apple HIG-ээс нэгтгэсэн) | — |
| `dimensional-drawing` | UI элементийн зай, радиус, давхаргыг техникийн зураг маягаар баримтжуулах | [enesozturk/dimensional-drawing](https://github.com/enesozturk/dimensional-drawing) @ `5c45743` | MIT |
| `dimensional-drawing-motion` | Дээрх зургийг ~10 секундийн бичлэг болгох | [enesozturk/dimensional-drawing](https://github.com/enesozturk/dimensional-drawing) @ `5c45743` | MIT |

Гадны skill-ийн хавтас бүрт эх лицензийн хуулбар (`LICENSE`) байна.

## Анхааруулга

- `dimensional-drawing-motion/adapters/headless` дотор `npm install` бүү ажиллуул. Тэр нь `playwright install chromium`-г ажиллуулдаг. Энэ орчинд Chromium болон Playwright урьдчилан суусан байгаа тул тэдгээрийг шууд ашиглана.
- Dimensional drawing-ийн Arimo фонт монгол Ө, Ү үсэгтэй (2026-10-28-нд шалгасан).
