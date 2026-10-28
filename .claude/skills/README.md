# Төслийн skill-үүд

Энэ хавтсанд байгаа skill-үүдийг Claude Code энэ repo дээр ажиллах бүрт автоматаар ачаална.

**Давуу эрх:** гадны skill манай `erp-ui-guidelines` эсвэл `docs/decisions.md`-тэй зөрчилдвөл манайх давуу. Жишээ нь:
- Ant Design-ийг Tailwind эсвэл өөр сангаар солихгүй.
- ERP-д хөдөлгөөнийг цөөн хэрэглэнэ.
- Монгол текстийн дүрмийг баримтална.

## Манай skill

| Skill | Юунд |
|---|---|
| `erp-ui-guidelines` | ERP-ийн дэлгэц, компонент зохиох болон шалгах дүрэм. NN/g, Carbon, Polaris, GOV.UK, WCAG 2.2, Apple HIG-ээс нэгтгэсэн |

## Гадны skill-үүд

Бүгд MIT лицензтэй. Хавтас бүрт эх лицензийн хуулбар (`LICENSE`) бий.

### [jakubkrehel/skills](https://github.com/jakubkrehel/skills) @ `592aedc` (Jakub Krehel, "interfaces" v1.17.0)

| Skill | Юунд |
|---|---|
| `better-interface` | Дэлгэцийг хүртээмж, байршил, текст, үсэг, өнгө, өнгөлгөөгөөр бүхэлд нь шалгаж, нэг тайлан гаргана |
| `better-ui` | Булангийн дугуйрал, сүүдэр, дүрс, хөдөлгөөний нарийн утгууд |
| `better-typography` | Үсгийн шатлал, зай, тасалж харуулах, тоон үсэг |
| `better-colors` | Өнгөний палитр, token-ий нэр, тодрол хэмжих |
| `better-layout` | Бүлэглэлт, тэгшлэлт, дэлгэцийн хэмжээ, орчуулгад зориулсан зай |
| `better-accessibility` | Гар, focus, ARIA, форм, сонсгол уншигч (WCAG 2.2) |
| `better-writing` | UI текст. Монгол текстэд `erp-ui-guidelines/references/writing.md` давуу |
| `interface-review` | Branch эсвэл өөрчлөлтөд гарсан UI-ийн алдааг шалгана |
| `build-design` | Figma файл эсвэл зурагнаас загварыг яг адилхан код болгоно |
| `state-machine` | Компонентийн бүх төлвийг (хоосон, ачаалж буй, алдаа…) нэг хуудсанд харуулна |
| `variant` | Компонентийн хэд хэдэн хувилбар хийж, сонгоход тусална |
| `explain-interface` | Сайт, эффект хэрхэн хийгдсэнийг линк эсвэл зурагнаас тайлбарлана |

`agents/` хавтсыг (Codex-д зориулсан) хуулаагүй. Мөн `teardown`, `break` skill-ийг оруулаагүй. `teardown`-ий оронд `dimensional-drawing`, `break`-ийн оронд `break-ui` бий.

### [emilkowalski/skills](https://github.com/emilkowalski/skills) @ `2d22863` (Emil Kowalski)

| Skill | Юунд |
|---|---|
| `emil-design-eng` | UI-ийн өнгөлгөө, компонентийн загвар, хөдөлгөөний шийдвэр |
| `break-ui` | Урт нэр, хоосон утга, латин бус бичиг зэрэг хамгийн хүнд өгөгдлөөр UI-г шалгана |
| `mobile-native` | Вэб системийг утсанд жинхэнэ апп шиг мэдрэмжтэй болгоно |

### [enesozturk/dimensional-drawing](https://github.com/enesozturk/dimensional-drawing) @ `5c45743`

| Skill | Юунд |
|---|---|
| `dimensional-drawing` | UI элементийн зай, радиус, давхаргыг техникийн зураг маягаар баримтжуулна |
| `dimensional-drawing-motion` | Дээрх зургийг ~10 секундийн бичлэг болгоно |

## Анхааруулга

- `dimensional-drawing-motion/adapters/headless` дотор `npm install` ажиллуулахгүй. Тэр нь `playwright install chromium`-ийг ажиллуулдаг. Энэ орчинд Chromium болон Playwright урьдчилан суусан байгаа тул тэдгээрийг шууд ашиглана.
- Dimensional drawing-ийн Arimo фонт монгол Ө, Ү үсэгтэй (2026-10-28-нд шалгасан).
- Гадны skill-ийг шинэчлэхдээ эх repo-гоос шинэ commit татаж, өөрчлөлтийг нь уншаад хуулна. Дээрх commit-уудыг шинэчилнэ.
