---
name: cinematic-video
description: Make a short cinematic 3D video entirely in code. A three.js scene is rendered frame by frame in headless Chromium, then ffmpeg adds motion blur and encodes it, and numpy makes the sound effects. Use when asked for a logo or mascot animation, an intro, or a short video for employees or social media. The method comes from an earlier session (shared by the user on 2026-11-02).
---

# 3D «кино» бичлэг: бүгд кодоор

Энэ аргыг өөр сесс бичлэг хийхдээ хэрэглэсэн. Хэрэглэгч түүнийг 2026-11-02-нд хуваалцаж, хадгалахыг хүссэн. Тэр сессийн код энэ repo-д байхгүй, зөвхөн доорх арга, тоонууд л үлдсэн. AI видео, Blender, After Effects хэрэглэхгүй, бүгдийг кодоор хийнэ.

## Хэрэгсэл

- **three.js:** хөтөч дээрх 3D тайз (WebGL).
- **three.js-ийн нэмэлтүүд:**
  - `EffectComposer` ба `BokehPass`: гүний бүдгэрэлт (DOF).
  - `UnrealBloomPass`: гэрэлтэлт.
  - Өөрийн `ShaderPass`: хальсны ширхэг, виньет.
  - `RoomEnvironment`: орчны гэрэл.
- **Playwright ба headless Chromium:** кадр бүрийг зураг болгоно.
- **ffmpeg:** дэд кадруудыг дундажилж motion blur үүсгэнэ, MP4 болгоно, дуу нэмнэ.
- **Python ба numpy:** дууны эффектийг нийлэгжүүлнэ.

2026-11-02-нд энэ container-т ffmpeg 6.1.1 (`tmix` шүүлтүүртэй), numpy, Playwright ба Chromium суусан байсан. npm-ээс three 0.187.0 татаж болно.

## Арга

1. **Цагийн функц.** Кадр бүрийг зөвхөн `t`-ээс тооцоолно (`seek(t)`). Өмнөх кадраас юу ч хамаарахгүй. Ингэснээр ямар ч кадрыг дахин яг адилхан гаргаж болно.
2. **Дүр.** SVG логог `ExtrudeGeometry`-гээр зузаантай, ирмэгийг нь налуу (bevel) болгож 3D болгоно. Материал нь шавар шиг бүдэг.
3. **Үсрэлт (squash & stretch).**
   - Хөөрөхийн өмнө ~0.14 секундэд 20% агшиж бэлтгэнэ. Хөөрөхдөө сунана.
   - Парабол нумаар нисэнэ: `y = 4h·u(1−u)`, энд `u` нь нислэгийн 0–1 хэсэг, `h` нь өндөр.
   - Газардахдаа хавтгайраад пүрш шиг чичирнэ (`exp × cos`, ~4 Гц), ~0.35 секундэд тогтоно.
   - Эзэлхүүнээ хадгална: өргөн = `1/√өндөр`. Масштабыг хөлнөөс нь (доод талаас) өөрчилнө.
   - Нисэхдээ урагшаа ~10° хазайна.
4. **Камер.**
   - Дүрийн газар дээрх байрлалыг 0.3 секунд хоцорч дагана. Хоцролтыг хугацааны цонхоор дундажилна. Үсрэлтийн өндрийг дагахгүй.
   - 50 мм линз. Миллиметрийг FOV болгож хөрвүүлнэ (three.js-д `camera.setFocalLength(50)`).
   - Гар камерын чичиргээ: seed-тэй давхар синус.
   - Камерын зам: Catmull-Rom муруй (`CatmullRomCurve3`).
   - Whip (хурдан эргэлт): 0.25 секундын `inOutExpo` шилжилт.
5. **Харагдац.**
   - Фокус кадр бүрт дүр дээр байна.
   - Bloom-ын threshold өндөр, ингэвэл цагаан зүйл манан болохгүй.
   - ACES tone mapping.
   - Дулаан гол гэрэл, зөөлөн сүүдэр (`PCFSoftShadowMap`), hemisphere дүүргэлт, араас ирмэгийн гэрэл, манан (fog).
6. **Рендэр.** Кадр бүрт 3–4 дэд кадр авна: 180° shutter, бага зэрэг jitter-тэй. ffmpeg-ийн `tmix`-ээр дундажлахад motion blur үүснэ. Эцсийн бичлэг 60 fps.
7. **Дуу.** Эффект нь хөдөлгөөний яг тэр агшинд тоглоно. Хөөрөх нь `t0` агшинд, газардах нь `t0 + агаарт байх хугацаа` агшинд.

## Хэрэгжүүлэх тэмдэглэл (Claude нэмсэн, хараахан туршаагүй)

- three.js-ийг npm-ээс суулгаж, тайзыг локал серверээс ачаална. CDN-ээс татахгүй.
- Хуудас `window.seek(t)`-г гаргана. Тэр нь тайзыг `t` агшинд тавиад composer-ээр зурна. Renderer-ийг `preserveDrawingBuffer: true`-тэй үүсгэнэ.
- Playwright: viewport 1920×1080. Кадр бүрт `page.evaluate(t => seek(t), t)` дуудаад screenshot авна.
- Дэд кадрын хугацаа: `t = (кадр + (k + jitter) / n × 0.5) / 60`, энд `k = 0…n−1`. 0.5 нь 180° shutter.
- ffmpeg-ээр 60 fps болгох: дэд кадрууд 240 fps дараалал (n = 4) бол `tmix=frames=4,select='eq(mod(n\,4)\,3)',setpts=N/(60*TB)`. Эсвэл кадр бүрийн дэд кадруудыг numpy-оор дундажилж болно.
- MP4: `-c:v libx264 -pix_fmt yuv420p -crf 18 -movflags +faststart`. Дуу нэмэх: `-i sfx.wav -c:a aac -shortest`.
- Лого: одоогоор зөвхөн 2000×2000 зураг бий, SVG алга. Өнгө нь `#BC1F29`. ExtrudeGeometry-д SVG хэрэгтэй тул эхлээд логог векторжуулна. Гурвалжин нь эргэлдсэн гурван туузаас бүтдэг.
