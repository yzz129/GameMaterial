"""Prepare font-independent heading art and a small legacy-compatible UI font."""
from pathlib import Path
import hashlib
import html
import json
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / '.tools/font-deps'))
from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen

game = ROOT / 'wangzhevoice'
config_path = game / 'game.config.json'
config = json.loads(config_path.read_text(encoding='utf-8'))
primary_path = game / config['assets']['fontBold']
brush_path = ROOT / 'portal/masters/editorial-v1/MaShanZheng-Regular.ttf'
primary, brush = TTFont(primary_path), TTFont(brush_path)
primary_map, brush_map = primary.getBestCmap(), brush.getBestCmap()
ui_copy = (ROOT / 'engine/client/app.js').read_text(encoding='utf-8') + config_path.read_text(encoding='utf-8')
codepoints = sorted({ord(c) for c in ui_copy if '\u4e00' <= c <= '\u9fff'} & brush_map.keys() - primary_map.keys())

patch = TTFont(brush_path)
options = subset.Options()
options.name_IDs = ['*']
options.name_legacy = True
options.name_languages = ['*']
builder = subset.Subsetter(options=options)
builder.populate(unicodes=codepoints)
builder.subset(patch)
for record in patch['name'].names:
    name = {1:'Game Archive UI Calligraphy',3:'GameArchiveUICalligraphy-3.0',4:'Game Archive UI Calligraphy Regular',6:'GameArchiveUICalligraphy-Regular',16:'Game Archive UI Calligraphy'}.get(record.nameID)
    if name:
        record.string = name.encode(record.getEncoding())
patch.flavor = 'woff'
patch_path = game / 'assets/fonts/HOK-UI-Calligraphy-v3.woff'
patch.save(patch_path)
assert all(ord(c) in TTFont(patch_path).getBestCmap() for c in '循熟换停')

def number(value):
    return f'{value:.3f}'.rstrip('0').rstrip('.') or '0'

paths = []
for row, line in enumerate(config['home']['titleLines']):
    for column, char in enumerate(line):
        font = primary if ord(char) in primary_map else brush
        cmap = font.getBestCmap()
        assert ord(char) in cmap, f'Missing title glyph {char}'
        glyphs = font.getGlyphSet()
        pen = SVGPathPen(glyphs, ntos=number)
        glyphs[cmap[ord(char)]].draw(pen)
        scale = 184 / font['head'].unitsPerEm
        paths.append(f'<path transform="translate({12 + column * 202} {178 + row * 248}) scale({number(scale)} {number(-scale)})" d="{pen.getCommands()}"/>')

title_copy = html.escape(' '.join(config['home']['titleLines']))
definitions = '<linearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#fff0c8"/><stop offset=".53" stop-color="#eed6a2"/><stop offset="1" stop-color="#dfb876"/></linearGradient>'
shapes = '<g id="letters">' + ''.join(paths) + '</g>'
base = f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1480" height="500" viewBox="0 0 1480 500"><title>{title_copy}</title><defs>{definitions}</defs><g fill="url(#gold)">{shapes}</g>{{motion}}</svg>'
still = base.replace('{motion}', '')
light = '<defs><linearGradient id="light" gradientUnits="userSpaceOnUse" x1="-650" y1="0" x2="-150" y2="0"><stop stop-color="#fff9e4" stop-opacity="0"/><stop offset=".5" stop-color="#fff9e4" stop-opacity=".72"/><stop offset="1" stop-color="#fff9e4" stop-opacity="0"/><animateTransform attributeName="gradientTransform" type="translate" from="0 0" to="2500 0" dur="2.6s" fill="freeze"/></linearGradient></defs><use xlink:href="#letters" fill="url(#light)"/>'
intro = base.replace('{motion}', light)
assets = game / 'assets/typography'
masters = game / 'assets/masters/typography'
masters.mkdir(parents=True, exist_ok=True)
records = []
for kind, text in [('still', still), ('intro', intro)]:
    name = f'HOK_04_FG_home-title-{kind}_v3.svg'
    (assets / name).write_text(text, encoding='utf-8')
    (masters / name).write_text(text, encoding='utf-8')
    records.append({'path':f'assets/typography/{name}','bytes':len(text.encode('utf-8')),'sha256':hashlib.sha256(text.encode('utf-8')).hexdigest()})

(game / 'assets/masters/brand' / patch_path.name).write_bytes(patch_path.read_bytes())
config['assets']['fontPatch'] = {'src':f'assets/fonts/{patch_path.name}','codepoints':codepoints}
config['home']['titleArt'] = {'still':records[0]['path'],'intro':records[1]['path'],'text':'\n'.join(config['home']['titleLines'])}
config_path.write_text(json.dumps(config, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
manifest = {
    'schemaVersion':1,
    'purpose':'Font-independent hero lettering and a small WOFF patch for the visible Chinese UI',
    'method':'Existing font glyph outlines; no runtime text or font references in SVG',
    'sources':[{'path':str(p.relative_to(ROOT)).replace('\\','/'),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in [primary_path,brush_path]],
    'rights':'Original Founder copyright retained for existing official glyphs; Ma Shan Zheng supplemental glyphs use SIL OFL 1.1',
    'supplementLicense':'assets/fonts/HOK-Calligraphy-Fallback-OFL.txt',
    'title':config['home']['titleArt']['text'],
    'titleWidth':1480,'titleHeight':500,
    'runtime':records,
    'fontPatch':{'path':config['assets']['fontPatch']['src'],'bytes':patch_path.stat().st_size,'sha256':hashlib.sha256(patch_path.read_bytes()).hexdigest(),'codepoints':codepoints},
    'build':'py -3.14 tools/prepare-honor-ui.py',
}
(masters / 'HOK_04_DATA_ui-lettering_v3.manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'titleBytes':[r['bytes'] for r in records],'uiGlyphs':len(codepoints),'uiFontBytes':patch_path.stat().st_size}))
