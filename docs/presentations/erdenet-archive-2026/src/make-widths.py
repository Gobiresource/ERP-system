# Advance widths of the two Golos Text weights, so lib.js can size pills to their words and warn when a text
# would not fit its box. Usage: make-widths.py Regular.ttf Bold.ttf assets/golos-widths.json
import json
import sys

from fontTools.ttLib import TTFont

out = {'upm': 1000}
for key, path in (('regular', sys.argv[1]), ('bold', sys.argv[2])):
    font = TTFont(path)
    widths = font['hmtx'].metrics
    out[key] = {str(cp): widths[glyph][0] for cp, glyph in font.getBestCmap().items()}
json.dump(out, open(sys.argv[3], 'w'))
print('letters:', len(out['regular']), len(out['bold']))
