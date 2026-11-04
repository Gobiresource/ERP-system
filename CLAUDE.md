# Claude-д зориулсан заавар

## Ажиллах зарчим

- Хэрэглэгчтэй монгол хэлээр, техникийн үг аль болох цөөн хэрэглэж харилцана. Техникийн нэр (жишээ нь Ant Design) хэрэглэх бол эхлээд энгийн үгээр тайлбарлана.
- Компанид техникийн мэдлэгтэй хүн байхгүй. Кодыг бичих, байршуулах, баримтжуулах ажлыг бүхэлд нь Claude хийнэ.
- Session эхлэхдээ [docs/decisions.md](docs/decisions.md), [docs/org-structure.md](docs/org-structure.md)-г уншина. Шинэ шийдвэрийг `docs/decisions.md`-д огноотойгоор нэмнэ.
- Дизайн маш чухал. Фонт сонгохдоо монгол Ө, Ү үсэгтэй эсэхийг шалгана. Шалгасан фонтуудын жагсаалт `docs/decisions.md`-д бий.
- Код бичихдээ `ponytail` skill-ийн дүрмийг баримтална: даалгаврыг бүрэн шийдэх хамгийн бага өөрчлөлт хийнэ, байгаа кодыг дахин ашиглана. Ирээдүйн session-ууд кодыг хялбар ойлгож, засварлах ёстой.
- Гадны төсөл, skill нэмэхээсээ өмнө лиценз, ажиллуулдаг код, сүлжээний хандалт, телеметрийг шалгана. Үр дүнг `docs/decisions.md`-д бичнэ.
- Хэрэглэгч дизайны төсөл, сайт, зураг явуулбал зорилго нь суралцах. Үүнийг "суулгах уу" гэж шүүхгүй. Санааг нь задалж, сурсан зүйлээ `.claude/skills/erp-ui-guidelines/references/learned.md`-д бичээд шинэ дэлгэц хийхдээ ашиглана. Кодыг нь хуулах эсэхийг лицензийг нь харж тусад нь шийднэ.

## Дизайны хэрэгслүүд

ERP-ийн дэлгэц, компонент дээр ажиллахдаа:

- **`erp-ui-guidelines`** (энэ repo): манай UI дүрэм. Дэлгэц бүрийг үүгээр зохиож, шалгана.
- **`interface-design`:** самбар, админ хуудас зохиох арга барил.
- **Design plugin-ий skill-үүд:**
  - `design-critique`: дизайн шүүмж
  - `accessibility-review`: WCAG шалгалт
  - `ux-copy`: UI текст
  - `design-system`: дизайн системийн аудит
  - `design-handoff`: хөгжүүлэгчид хүлээлгэн өгөх тодорхойлолт
- **`frontend-design`** plugin: хэрэглэгч суулгасан бол frontend код бичихэд.
- **Jakub Krehel-ийн skill-үүд** (энэ repo):
  - `better-interface`: дэлгэцийг бүх талаас нь шалгах. Тэр `better-ui`, `better-typography`, `better-colors`, `better-layout`, `better-accessibility`, `better-writing`-ийг ашигладаг.
  - `interface-review`: өөрчлөлтийг шалгах.
  - `build-design`: хэрэглэгчийн өгсөн зураг, загварыг код болгох.
  - `state-machine`: компонентийн бүх төлвийг харах.
  - `variant`: хэрэглэгчид сонгуулах хувилбарууд хийх.
  - `explain-interface`: хэрэглэгчийн явуулсан сайт, зураг хэрхэн хийгдсэнийг тайлбарлах.
- **Emil Kowalski-ийн skill-үүд** (энэ repo):
  - `emil-design-eng`: өнгөлгөө, хөдөлгөөн.
  - `break-ui`: урт монгол нэр гэх мэт хүнд өгөгдлөөр шалгах.
  - `mobile-native`: утсанд апп шиг мэдрэмж өгөх.
- **`dimensional-drawing`, `dimensional-drawing-motion`** (энэ repo): компонентийн техникийн зураг, түүний хөдөлгөөнт бичлэг.
- **`diagram-design`** (энэ repo): баримт бичгийн диаграм (системийн бүтэц, байгууллагын бүтэц, өгөгдлийн загвар, ажлын урсгал).
- **`dataviz`:** график, самбар.
- **Playwright ба Chromium** (урьдчилан суусан): дэлгэцийг компьютер, утасны хэмжээнд, гэрэл ба харанхуй горимд screenshot авч шалгана.

Гадны skill манай `erp-ui-guidelines` эсвэл `docs/decisions.md`-тэй зөрчилдвөл манайх давуу. Жишээ нь Ant Design-ийг солихгүй, хөдөлгөөнийг цөөн хэрэглэнэ, монгол текстийн дүрмийг баримтална. Дэлгэрэнгүйг `.claude/skills/README.md`-ээс үзнэ.

## Монгол текст ба Gemini

Хэрэглэгч Google Gemini монголоор илүү сайн бичдэг гэж үзэж, түүнийг холбохыг хүссэн. API түлхүүрээр биш, хэрэглэгчийн Google AI Pro бүртгэлтэй Antigravity CLI (`agy`)-аар холбоно (2026-10-29). `agy` энэ cloud container дотор ажиллана. Claude түүнийг өөрөө шууд дуудна, хэрэглэгчээр текст гараар хуулуулахгүй.

- **Хэзээ.** Дэлгэцийн текст, ажилчдад зориулсан заавар зэрэг монгол текстийг бичих, засахдаа хянуулна.
- **Суулгах.** Container шинэ бүрт суулгана (`S` = scratchpad хавтас):
  ```bash
  curl -fsSL https://antigravity.google/cli/install.sh -o $S/install.sh   # эхлээд уншиж шалгана
  bash $S/install.sh --dir $S/agy                                          # $S/agy/agy, ~230 MB
  ```
- **Нэвтрэх.** Нэвтрэх хэсэг нь терминалын цонх (TUI) тул tmux-аар ажиллуулна. SSH-ийн хувьсагчууд нь нэвтрэх URL хэвлүүлнэ.
  ```bash
  mkdir -p $S/agy-run && cd $S/agy-run
  tmux new-session -d -s agy -x 200 -y 50 "env SSH_CONNECTION='10.0.0.2 52000 10.0.0.1 22' SSH_CLIENT='10.0.0.2 52000 22' SSH_TTY=/dev/pts/0 TERM=xterm-256color $S/agy/agy"
  tmux send-keys -t agy Enter     # «1. Google OAuth»
  tmux capture-pane -t agy -p     # «────» хоорондох мөрүүдийг зайгүй нийлүүлбэл бүтэн URL болно
  ```
  - URL-ийг хэрэглэгчид явуулна. Хэрэглэгч нэвтэрч, хуудсан дээр гарсан кодыг чатаар өгнө. Код хэдэн минутын дараа хүчингүй болно.
  - `tmux send-keys -t agy -l '<КОД>'`, дараа нь `tmux send-keys -t agy Enter`.
  - Өнгө → Enter. «Interactions data»-г асаалгүй [ ] үлдээнэ (Enter нь асааж, унтраадаг). Down → Right-аар «Done» → Enter. «Trust this folder» → Enter.
  - `$S/agy/agy models`-оор шалгана. `/config`-д «Enable Telemetry» ба «Use AI Credits» унтраастай байгааг шалгана.
  - Токен `~/.gemini/antigravity-cli/antigravity-oauth-token`-д хадгалагдана. Түүнийг хэвлэхгүй, repo-д хийхгүй.
- **Ашиглах.** Хоосон `$S/agy-run`-аас ажиллуулна. Prompt-ын эхэнд "Do NOT use run_command. Do not read or write any files." гэж бичнэ. 60–95 мөртэй багц 3.5–4.5 минут болно. Багцуудыг зэрэг биш, дараалан ажиллуулна. Хариу файлыг agy дуусахаас өмнө уншихгүй, хагас бичигдсэн байдаг.
  ```bash
  cd $S/agy-run && $S/agy/agy -p "$(cat $S/prompts/batchN.txt)" --print-timeout 330s > $S/prompts/batchN.out
  ```
- **Загвар.** CLI-ийн анхдагч загвар Gemini 3.8 Flash (High). Хэрэглэгчийн хүссэн Argon 4, мөн 3.1 Pro зөвхөн Gemini апп-д байгаа, CLI-д алга (2026-10-29). `agy models`-д шинэ загвар гарвал `--model`-оор сонгоно.
  - High загвар 12 мөрийн багц дээр ч 5 минутаас удаан бодож, хариугаа гаргаж амжаагүй (2026-10-29). `--model gemini-3.8-flash-medium` 1.5–4 минутад хариулдаг тул түүнийг хэрэглэнэ.
- **Зураг, дуу.** Зураг (Imagen 3, 1024²): `agy -p "Do NOT use run_command. Use your image-generator subagent to create ONE image: …" --mode accept-edits --print-timeout 380s`. Зураг `~/.gemini/antigravity-cli/brain/<яриа>/`-д гарна. Видеоны дууг сонсгохдоо файлыг `$S/agy-run`-д хуулж, `read_file`-аар уншуулна. Veo видео CLI-д алга.
- **Хэлбэр.** Текстийг багцаар илгээнэ, мөр бүр ID-тай. Gemini зөвхөн засах мөрүүдийг `ID | шинэ хувилбар | шалтгаан` хэлбэрээр буцаана. Эргэлзээтэй зүйлийг дугаарласан асуултаар дахин тодруулна.
- **Шалгах.** Gemini-ийн хариуг шууд хуулахгүй. Утга, `erp-ui-guidelines`-ийн дүрэм, бусад дэлгэцтэй нийцэж байгааг Claude шалгана. Шийдсэн үгийг `erp-ui-guidelines/references/writing.md`-ийн нэр томьёоны толь бичигт нэмнэ.
- **Нууцлал.** Хувийн болон нууц мэдээлэл илгээхгүй, зөвхөн дэлгэцийн текст, жишээ өгөгдөл илгээнэ. Хувийн Google бүртгэлээр илгээсэн текстийг Google сургалтад ашиглаж магадгүй.
- **Сүлжээ.** 2026-10-29-нд хэрэглэгч бүрэн хандалт өгсөн. Хязгаарлавал эдгээр хаяг нээлттэй байх ёстой: antigravity.google, antigravity-cli-auto-updater-974169037036.us-central1.run.app, storage.googleapis.com, oauth2.googleapis.com, accounts.google.com, www.googleapis.com, cloudcode-pa.googleapis.com, aicode.googleapis.com, generativelanguage.googleapis.com, play.googleapis.com.
- **Ажиллахгүй бол** (нэвтрэх код байхгүй гэх мэт) Gemini-гүйгээр үргэлжлүүлж, хянуулах текстээ `docs/decisions.md`-д тэмдэглэж үлдээнэ.

## Cloudflare-т байршуулах

Туршилтын хувилбарын хаяг: https://gobi-erp.gobiresource.workers.dev (2026-11-02).
- Хөтчийн хэсэг ба скан уншдаг AI (`/api/scan`) байрласан. Өгөгдөл нь жишээ бөгөөд хүн бүрийн хөтөч дотор хадгалагдана.
- AI-ийн OpenRouter түлхүүрийг хэрэглэгч Worker-т `OPENROUTER_API_KEY` нэртэй **Secret** болгож өөрөө оруулдаг. Text төрлөөр оруулбал `npm run deploy` түүнийг устгана. OpenRouter-ийн workspace дээрх $1-ийн хязгаар зарлагыг хязгаарлана.
- Timely-ийн серверийг серверт нэвтрэлт хийгдэх хүртэл байршуулахгүй.

**Түлхүүр.** Хэрэглэгчийн API token энэ орчны Network secrets-д `api.cloudflare.com` хаягтай хадгалагдсан.
- Эрхүүд: Workers Scripts Edit, Workers KV Storage Edit, Account Settings Read.
- Прокси энэ хаяг руу явах хүсэлт бүрт token-ийг тавьдаг тул командад `via-proxy` гэж бичнэ.
- Token-ийг хэвлэхгүй, асуухгүй.

**Шинэчлэх.** Шинэ хувилбар бүрийн дараа туршилтын хуудастай (artifact) хамт шинэчилнэ:
```bash
cd web && CLOUDFLARE_ACCOUNT_ID=$(curl -s -H "Authorization: Bearer via-proxy" https://api.cloudflare.com/client/v4/accounts | python3 -c "import json,sys; print(json.load(sys.stdin)['result'][0]['id'])") CLOUDFLARE_API_TOKEN=via-proxy npm run deploy
```

**Яагаад KV.** Cloudflare static assets файлыг тусгай түр түлхүүрээр илгээдэг. Прокси тэр түлхүүрийг солидог тул энэ орчинд static assets ажиллахгүй. Иймээс файлыг Workers KV-ээс жижиг Worker (`web/worker/site.js`) харуулдаг.

## Ирц (Timely)

- **Түлхүүр.** Орчны тохиргооны Environment variables-д `TIMELY_API_KEYS` нэрээр байна. Хэд хэдэн ХХК-ийнх бол таслалаар зааглана. Шинэ session түүнийг шууд уншина. Ажиллаж буй session-ий компьютер (VM) хуучин утгаа хадгална. Session хэсэг хугацаанд сул байхад компьютер нь өөрөө түр зогсдог. Дараагийн мессежээр сэргэхдээ шинэ утгыг уншина.
- **Network secrets ажиллахгүй** (2026-11-04). Timely түлхүүрийг зөвхөн `POST /auth/token`-ий JSON биеэр (`{"apiKey": …}`) авч, 1 цагийн токен өгдөг. Прокси Bearer төрлийн түлхүүрийг толгойд (header) тавьдаг. «Body parameter» төрлийг JSON, form, хаягаар туршихад Timely-д хүрээгүй. `api.timely.mn`-д Bearer secret үлдвэл манай серверийн токеныг дарж, өгөгдөл татахыг эвдэнэ. Тиймээс тэнд secret байх ёсгүй.
- **Шалгах.** `[ -n "$TIMELY_API_KEYS" ]`-ээр шалгана. Утгыг хэвлэхгүй, repo-д хийхгүй. `cd web && NODE_USE_ENV_PROXY=1 node server/main.ts` (8787) ажиллуулна. Энэ хувьсагчгүй бол Node прокси ашиглахгүй тул «Timely хариу өгсөнгүй» гэж гарна. `vite preview` `/api`-г түүн рүү дамжуулна. Дараа нь Хүний нөөц → Ирц-ийг нээнэ. Timely дээрх нэр нь «Говь ресурс девелопмент» тул ХХК-ийг админ гараар сонгож холбоно.
- **Тестийн өмнө** жинхэнэ түлхүүртэй серверийг зогсооно. Үгүй бол тестүүд жинхэнэ ирцийг харж, зурагт нь хувийн мэдээлэл орно.
- **Хувийн мэдээлэл.** Ажилтны нэр, регистрийн дугаар, ирцийг чатад хэвлэхгүй, Gemini-д илгээхгүй. Зөвхөн тоо, дүн, талбарын нэрийг харна. `/employees/info` (цалин, данс)-ийг хэзээ ч дуудахгүй.
- **Нийтийн хаяг.** Серверт нэвтрэлт хийгдэх хүртэл туршилтын хаягт байршуулахгүй.

## Instagram reel үзэх арга

Хэрэглэгч reel явуулбал:

1. Нийтэд нээлттэй reel-ийг `yt-dlp`-ээр нэвтрэлтгүйгээр татна. `--write-info-json` тайлбар (caption), хэрэглэгчийн нэр, reel-д дурдсан төслийн нэрийг өгнө. Видео татагдахгүй байсан ч тайлбарыг нь уншиж болно. Олон зурагтай пост (carousel) бол yt-dlp зураг бүр дээр "No video formats found" гэж алдаа өгдөг ч тайлбарыг `.info.json`-д бичдэг.
2. `ffmpeg`-ээр кадр болгон задлаад зургийг нь харна. Хэрэгтэй хэсгийг томруулж, давхардсан кадрыг хасна. Видеог үргэлжлүүлж үзэх боломжгүй, зөвхөн кадраар нь хардаг.
3. Яриатай бол `faster-whisper`-ээр монгол эсвэл англи текст болгоно.

Сүлжээнд `www.instagram.com` (тайлбар), `*.cdninstagram.com` (видео), `huggingface.co` (whisper загвар) нээлттэй байх ёстой. 2026-10-28-ны байдлаар зөвхөн `www.instagram.com` нээлттэй байсан.

Хуудсыг өөр хөтөч мэт дүр эсгэж (user-agent сольж) татахыг оролдохгүй.
