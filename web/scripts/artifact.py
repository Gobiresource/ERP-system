# Builds the preview page (claude.ai artifact) from web/dist: the page without skeleton tags, its assets, fonts inlined.
# Usage: python3 web/scripts/artifact.py web/dist <outDir>. Then publish <outDir>/erp.html with the new assets as files.
import sys, re, base64, os, shutil
D, A = sys.argv[1], sys.argv[2]
os.makedirs(f'{A}/assets', exist_ok=True)
built = {f for f in os.listdir(f'{D}/assets') if not f.endswith('.woff2')}  # fonts are inlined into the CSS
for f in os.listdir(f'{A}/assets'):
    if f not in built: os.remove(f'{A}/assets/{f}')  # stale files from an older build
for f in built:
    src = f'{D}/assets/{f}'
    if f.endswith('.css'):
        s = open(src).read()
        s = re.sub(r'url\(\./([\w.-]+\.woff2)\)', lambda m: 'url(data:font/woff2;base64,' + base64.b64encode(open(f'{D}/assets/{m.group(1)}', 'rb').read()).decode() + ')', s)
        open(f'{A}/assets/{f}', 'w').write(s)
    elif f.endswith(('.js', '.mjs')):
        # The artifact service refuses a raw ESC byte and U+FFFD; pdf.js and pdf-lib have a few, all inside string or
        # template literals, where the escapes \x1b and \uFFFD mean the same
        data = open(src, 'rb').read().replace(b'\x1b', b'\\x1b').replace('\ufffd'.encode(), b'\\uFFFD')
        open(f'{A}/assets/{f}', 'wb').write(data)
    else:
        shutil.copyfile(src, f'{A}/assets/{f}')
html = open(f'{D}/index.html').read()
head = re.search(r'<head>(.*)</head>', html, re.S).group(1)
theme = re.search(r'<script>\s*// Paint.*?</script>', head, re.S).group(0)
tags = re.findall(r'<(?:script type="module"|link rel="(?:modulepreload|stylesheet)")[^>]*>(?:</script>)?', head)
page = '\n'.join(['<title>Pane ERP</title>', "<script>document.documentElement.lang = 'mn'</script>", theme, *tags, '<div id="root"></div>', ''])
open(f'{A}/erp.html', 'w').write(page)
open(f'{A}/_preview.html', 'w').write('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"></head><body>' + page + '</body></html>')
print('assets', len(built), 'entry', [t for t in tags if 'module"' in t])
