# Speaker notes: the paper's own paragraphs, by slide. Line ranges refer to the text taken from the user's PDF.
import json, re, sys
src, out = sys.argv[1], sys.argv[2]
L = open(src, encoding='utf-8').read().split('\n')
def P(a, b):
    """Lines a..b (1-based, inclusive) as one paragraph"""
    t = ' '.join(x.strip() for x in L[a-1:b] if x.strip())
    t = t.replace('​', '').replace('‎', '').replace('●', '•')
    t = re.sub(r'\s+', ' ', t).replace('• ', '\n• ').strip()
    return t.replace('обьект', 'объект')
N = {
 'title': 'Хураангуй\n' + P(15, 31),
 'history': P(36, 43) + '\n\n' + P(44, 51),
 'problem': P(52, 58) + '\n\n' + P(62, 66),
 'r1': P(69, 76),
 'r2': P(79, 83) + '\n\n' + P(84, 87),
 'r3': P(90, 97),
 'r4': P(203, 209),
 'table': 'Хүснэгт: дөрвөн асуудлын хүрээгээр уламжлалт гар ажиллагаа, энгийн сканнерыг хиймэл оюун ухаанаар ялгаж цэгцлэх сантай харьцуулав.',
 'pipeline': P(213, 217),
 's12': 'Нэгдүгээр шат. ' + P(220, 225) + '\n\nХоёрдугаар шат. ' + P(228, 237),
 's34': 'Гуравдугаар шат. ' + P(240, 253) + '\n\nДөрөвдүгээр шат. ' + P(256, 260),
 'schema': P(265, 267).rstrip(':') + '.',
 'fields': P(328, 330) + '\n\n' + P(331, 338) + '\n\n' + P(339, 345) + '\n\n' + P(346, 353) + '\n\n' + P(354, 361),
 'results': P(366, 375).strip(),
 'security': P(378, 388).strip(),
 'roadmap': P(391, 402).strip() + '\n\nХэмжүүр: ' + P(322, 324).split('Хэмжүүр:')[1].split('—')[0].strip() + '. Үр дүнг туршилтын дараа бөглөнө.',
 'conclusion': P(405, 412),
}
N['roadmap'] = re.sub(r'\s(\d)\.\s', r'\n\1. ', ' ' + N['roadmap']).strip()
json.dump(N, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
for k, v in N.items(): print(k, len(v), '|', v[:90].replace('\n', ' / '))
