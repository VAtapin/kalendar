"""Read-only inspection of an exported calendar; extracted evidence stays in tmp/."""
import json
import sys
import calendar
from pathlib import Path
import pdfplumber
from pypdf import PdfReader
from PIL import Image

source = Path(sys.argv[1])
target = Path(sys.argv[2])
target.mkdir(parents=True, exist_ok=True)
pages = []
def fingerprint(image):
    rgba = image.convert('RGBA')
    rgba = rgba.crop(rgba.getbbox())
    white = Image.new('RGBA', rgba.size, 'white')
    white.alpha_composite(rgba)
    return white.convert('RGB').resize((24, 24)).tobytes()

markers = {}
for asset in Path('public/assets/markers').glob('*/*.png'):
    with Image.open(asset) as image:
        markers.setdefault(fingerprint(image), []).append(str(asset))
reader = PdfReader(source)
with pdfplumber.open(source) as pdf:
    for index, page in enumerate(pdf.pages, 1):
        clean = page.dedupe_chars(tolerance=0.5)
        text = clean.extract_text(x_tolerance=1, y_tolerance=3) or ""
        words = clean.extract_words(x_tolerance=1, y_tolerance=3)
        images = [{key: item.get(key) for key in ['x0', 'top', 'x1', 'bottom', 'width', 'height', 'name']} for item in page.images]
        by_name = {}
        for item in reader.pages[index-1].images:
            # Only small calendar icons, not the user's photos.
            if item.name.endswith('.png') and max(item.image.size) <= 2048:
                pixels = fingerprint(item.image)
                distance, matched = min((sum(abs(a-b) for a,b in zip(pixels, sample))/len(sample), paths) for sample, paths in markers.items())
                by_name[item.name.rsplit('.', 1)[0]] = {'assets': matched, 'mean_rgb_error': round(distance, 3)} if distance < 8 else {'assets': [], 'mean_rgb_error': round(distance, 3)}
        for item in images:
            item['marker_match'] = by_name.get(item['name'], {'assets': []})
        pages.append({'page': index, 'width': page.width, 'height': page.height, 'text': text, 'words': words, 'images': images})
        if index > 1:
            # Grid bounds taken from the actual PDF's seven-column monthly layout.
            left, right, top, bottom = 37, 821, 633, 1128
            first_weekday, day_count = calendar.monthrange(2027, index-1)
            row_count = (first_weekday + day_count + 6)//7
            cell_width, cell_height = (right-left)/7, (bottom-top)/row_count
            cells=[]
            for number in range(1, day_count+1):
                row, col = divmod(first_weekday+number-1, 7)
                x0, y0 = left+col*cell_width, top+row*cell_height
                # Event type is under 12pt, decorative day numbers much larger.
                chars = [c for c in clean.chars if c['size'] < 12 and x0 <= c['x0'] < x0+cell_width and y0 <= c['top'] < y0+cell_height]
                cell_text = pdfplumber.utils.extract_text(chars, x_tolerance=1,y_tolerance=3)
                icons = [i for i in images if x0 <= (i['x0']+i['x1'])/2 < x0+cell_width and y0 <= (i['top']+i['bottom'])/2 < y0+cell_height]
                cells.append({'date': f'2027-{index-1:02}-{number:02}', 'text': cell_text, 'icons': icons})
            pages[-1]['cells'] = cells
        (target / f'page-{index:02}.txt').write_text(text, encoding='utf-8')
        print(f'Page {index}: {len(text)} characters, {len(words)} words, {len(images)} images', flush=True)
        page.close()
(target / 'pages.json').write_text(json.dumps(pages, ensure_ascii=False, indent=2), encoding='utf-8')
