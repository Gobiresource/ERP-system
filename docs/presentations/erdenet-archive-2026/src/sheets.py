# Pairs of slide pictures, one above the other, for looking through the deck
import glob, sys
from PIL import Image
files = sorted(glob.glob(sys.argv[1] + '-*.jpg'))
for i in range(0, len(files), 2):
    ims = [Image.open(f) for f in files[i:i+2]]
    w = ims[0].width; h = sum(im.height for im in ims) + 12 * (len(ims) - 1)
    sheet = Image.new('RGB', (w, h), 'white'); y = 0
    for im in ims:
        sheet.paste(im, (0, y)); y += im.height + 12
    sheet.save(f'{sys.argv[2]}-{i//2+1:02d}.jpg', quality=85)
print(len(files), 'slides')
