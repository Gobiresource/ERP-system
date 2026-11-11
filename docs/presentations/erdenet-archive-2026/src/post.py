# Finishes the deck pptxgenjs wrote. Usage: post.py in.pptx out.pptx Regular.ttf Bold.ttf
# 1. Writes the deck's colours (assets/theme.json) into PowerPoint's theme: pptxgenjs leaves Office's own there.
# 2. Puts the two Golos Text weights inside the file, so PowerPoint shows the deck in its own font on a computer
#    that does not have it.
#
# PowerPoint keeps an embedded font as ppt/fonts/fontN.fntdata: an Embedded OpenType (EOT) file, which is the
# untouched TrueType file behind a header (W3C "Embedded OpenType (EOT) File Format", version 0x00020001, no
# compression, no XOR). presentation.xml lists it in <p:embeddedFontLst>. Golos Text is OFL; its fsType is 0
# (installable embedding), which permits this.
import io
import json
import os
import re
import struct
import sys
import zipfile
from xml.sax.saxutils import escape

from fontTools.ttLib import TTFont

THEME = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'assets', 'theme.json'), encoding='utf-8'))
FAMILY = THEME['font']
SLOTS = ['dk1', 'lt1', 'dk2', 'lt2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'hlink', 'folHlink']


def eot(ttf: bytes) -> bytes:
    font = TTFont(io.BytesIO(ttf))
    os2, head, name = font['OS/2'], font['head'], font['name']
    if os2.fsType & 0x0002:
        raise SystemExit('this font forbids embedding (fsType restricted)')

    def record(name_id: int) -> bytes:
        r = name.getName(name_id, 3, 1, 0x409) or name.getName(name_id, 1, 0, 0)
        text = (r.toUnicode() if r else '').encode('utf-16-le')
        return struct.pack('<H', len(text)) + text

    p = os2.panose
    panose = bytes([p.bFamilyType, p.bSerifStyle, p.bWeight, p.bProportion, p.bContrast, p.bStrokeVariation, p.bArmStyle, p.bLetterForm, p.bMidline, p.bXHeight])
    body = struct.pack('<III', len(ttf), 0x00020001, 0)                       # FontDataSize, Version, Flags
    body += panose + struct.pack('<BB', 1, os2.fsSelection & 1)               # Charset (DEFAULT_CHARSET), Italic
    body += struct.pack('<IHH', os2.usWeightClass, os2.fsType, 0x504C)        # Weight, fsType, MagicNumber
    body += struct.pack('<IIII', os2.ulUnicodeRange1, os2.ulUnicodeRange2, os2.ulUnicodeRange3, os2.ulUnicodeRange4)
    body += struct.pack('<II', getattr(os2, 'ulCodePageRange1', 0), getattr(os2, 'ulCodePageRange2', 0))
    body += struct.pack('<I', head.checkSumAdjustment) + b'\0' * 16           # CheckSumAdjustment, Reserved1-4
    body += b'\0\0' + record(1)                                               # Padding1, FamilyName
    body += b'\0\0' + record(2)                                               # Padding2, StyleName
    body += b'\0\0' + record(5)                                               # Padding3, VersionName
    body += b'\0\0' + record(4)                                               # Padding4, FullName
    body += b'\0\0' + struct.pack('<H', 0)                                    # Padding5, RootStringSize
    body += ttf
    return struct.pack('<I', len(body) + 4) + body                            # EOTSize comes first


def main(src: str, dst: str, regular: str, bold: str) -> None:
    zin = zipfile.ZipFile(src)
    parts = {i.filename: zin.read(i.filename) for i in zin.infolist() if not i.is_dir()}
    order = [i.filename for i in zin.infolist() if not i.is_dir()]

    def text(name: str) -> str:
        return parts[name].decode('utf-8')

    # 0. the theme's colours and name
    name = escape(THEME['name'], {'"': '&quot;'})
    scheme = f'<a:clrScheme name="{name}">' + ''.join(f'<a:{k}><a:srgbClr val="{THEME["colors"][k].upper()}"/></a:{k}>' for k in SLOTS) + '</a:clrScheme>'
    theme, n = re.subn(r'<a:clrScheme\b.*?</a:clrScheme>', lambda m: scheme, text('ppt/theme/theme1.xml'), count=1, flags=re.S)
    if n != 1:
        raise SystemExit('theme1.xml has no colour scheme to replace')
    theme = re.sub(r'(<a:(?:theme|fontScheme)\b[^>]*?\bname=")[^"]*"', lambda m: m.group(1) + name + '"', theme)
    parts['ppt/theme/theme1.xml'] = theme.encode('utf-8')

    # 1. the two font parts
    parts['ppt/fonts/font1.fntdata'] = eot(open(regular, 'rb').read())
    parts['ppt/fonts/font2.fntdata'] = eot(open(bold, 'rb').read())
    order += ['ppt/fonts/font1.fntdata', 'ppt/fonts/font2.fntdata']

    # 2. their content type
    ct = text('[Content_Types].xml')
    if 'Extension="fntdata"' not in ct:
        ct = ct.replace('<Default ', '<Default Extension="fntdata" ContentType="application/x-fontdata"/><Default ', 1)
    parts['[Content_Types].xml'] = ct.encode('utf-8')

    # 3. the presentation's relationships to them
    rels = text('ppt/_rels/presentation.xml.rels')
    top = max(int(n) for n in re.findall(r'Id="rId(\d+)"', rels))
    rid_regular, rid_bold = f'rId{top + 1}', f'rId{top + 2}'
    font_type = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/font'
    rels = rels.replace('</Relationships>', f'<Relationship Id="{rid_regular}" Type="{font_type}" Target="fonts/font1.fntdata"/><Relationship Id="{rid_bold}" Type="{font_type}" Target="fonts/font2.fntdata"/></Relationships>')
    parts['ppt/_rels/presentation.xml.rels'] = rels.encode('utf-8')

    # 4. the list of embedded fonts: after <p:notesSz>, where the schema puts it. Nothing else in the part moves.
    pres = text('ppt/presentation.xml')
    lst = f'<p:embeddedFontLst><p:embeddedFont><p:font typeface="{FAMILY}"/><p:regular r:id="{rid_regular}"/><p:bold r:id="{rid_bold}"/></p:embeddedFont></p:embeddedFontLst>'
    pres, n = re.subn(r'(<p:notesSz\b[^>]*/>)', lambda m: m.group(1) + lst, pres, count=1)
    if n != 1:
        raise SystemExit('presentation.xml has no <p:notesSz/> to put the font list after')
    if 'embedTrueTypeFonts' not in pres:
        pres = pres.replace('<p:presentation ', '<p:presentation embedTrueTypeFonts="1" ', 1)  # PowerPoint keeps the fonts in when the user saves
    parts['ppt/presentation.xml'] = pres.encode('utf-8')

    # 5. small repairs to what pptxgenjs writes
    for name in list(parts):
        if not name.endswith('.xml'):
            continue
        xml = text(name)
        fixed = re.sub(r' spc="(-?\d+)" kern="0"', r' spc="\1"', xml)        # tighter headings keep the font's kerning
        fixed = fixed.replace('<Company>PptxGenJS</Company>', '<Company></Company>')
        if fixed != xml:
            parts[name] = fixed.encode('utf-8')
        if '/tmp/' in fixed or '/home/' in fixed or 'scratchpad' in fixed:
            raise SystemExit(f'{name} carries a path from this machine')

    with zipfile.ZipFile(dst, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as zout:
        for name in order:
            zout.writestr(name, parts[name])
    print('fonts embedded:', len(parts['ppt/fonts/font1.fntdata']), len(parts['ppt/fonts/font2.fntdata']), 'bytes ->', dst)


if __name__ == '__main__':
    main(*sys.argv[1:5])
