"""Verify source parity, embedded fonts, links and destinations of local PDF samples."""
import json
import re
from pathlib import Path
from pypdf import PdfReader

for expected_file in Path('output/pdf').glob('*.expected.json'):
    name = expected_file.name.removesuffix('.expected.json')
    expected = json.loads(expected_file.read_text(encoding='utf-8'))
    reader = PdfReader(expected_file.with_name(name + '.pdf'))
    source = ''.join(run['text'] for block in expected['blocks'] for run in block['runs'])
    body = []
    page_refs = {(p.indirect_reference.idnum, p.indirect_reference.generation) for p in reader.pages}
    for page in reader.pages:
        assert abs(float(page.mediabox.width) - 595.276) < .01
        assert abs(float(page.mediabox.height) - 841.89) < .01
        for ref in page['/Resources']['/Font'].get_object().values():
            font = ref.get_object()
            assert '/ToUnicode' in font
            descriptor = font['/DescendantFonts'][0].get_object()['/FontDescriptor'].get_object()
            assert '/FontFile2' in descriptor or '/FontFile3' in descriptor
        # This producer writes hex ActualText plus its body marker. Scan the
        # decoded stream without allocating millions of glyph-operation objects.
        for encoded in re.findall(rb'/ActualText\s*<([0-9A-Fa-f]+)>\s*/KalendarBody\s+true', page.get_contents().get_data()):
            body.append(bytes.fromhex(encoded.decode('ascii')).decode('utf-16-be').removeprefix('\ufeff'))
        for ref in page.get('/Annots', []):
            annotation = ref.get_object()
            destination = annotation['/Dest'][0]
            assert (destination.idnum, destination.generation) in page_refs
            x1, y1, x2, y2 = map(float, annotation['/Rect'])
            assert 0 <= x1 < x2 <= 595.276 and 0 <= y1 < y2 <= 841.89
    normalize = lambda text: re.sub(r'\s+', '', text)
    assert normalize(''.join(body)) == normalize(source), f'{name}: source text mismatch'
    headings = [{'runs': [{'text': item['title']}]} for item in expected['navigation']] if 'navigation' in expected else [block for block in expected['blocks'] if block['kind'] == 'heading']
    assert len(reader.outline) == len(headings)
    for outline, heading in zip(reader.outline, headings):
        assert outline.title == ''.join(run['text'] for run in heading['runs'])
        assert reader.get_destination_page_number(outline) in range(len(reader.pages))
    print(f'{name}: {len(reader.pages)} A4 pages; {len(headings)} bookmarks; full Unicode body parity; embedded fonts PASS')
