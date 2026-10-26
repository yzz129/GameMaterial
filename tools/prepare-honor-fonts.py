"""Build a calligraphic fallback for glyphs absent from the official web subset."""
from pathlib import Path
import hashlib
import json
import shutil
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / '.tools/font-deps'))
from fontTools import subset
from fontTools.ttLib import TTFont

game = ROOT / 'wangzhevoice'
source = ROOT / 'portal/masters/editorial-v1/MaShanZheng-Regular.ttf'
official = game / 'assets/fonts/HOK-Official-Title-Regular.woff'
output = game / 'assets/fonts/HOK-Calligraphy-Fallback-v2.woff2'
masters = game / 'assets/masters/brand'
font = TTFont(source)
primary_chars = set(TTFont(official).getBestCmap())
missing = set(font.getBestCmap()) - primary_chars
options = subset.Options()
options.name_IDs = ['*']
options.name_legacy = True
options.name_languages = ['*']
builder = subset.Subsetter(options=options)
builder.populate(unicodes=missing)
builder.subset(font)
for record in font['name'].names:
    replacement = {
        1: 'Game Archive Brush Fallback',
        3: 'GameArchiveBrushFallback-2.0',
        4: 'Game Archive Brush Fallback Regular',
        6: 'GameArchiveBrushFallback-Regular',
        16: 'Game Archive Brush Fallback',
    }.get(record.nameID)
    if replacement:
        record.string = replacement.encode(record.getEncoding())
font.flavor = 'woff2'
font.save(output)
combined = primary_chars | set(TTFont(output).getBestCmap())
required = '循着星光重逢熟悉的声音换一位角色自动播放暂停音乐'
assert all(ord(c) in combined for c in required)
license_name = 'HOK-Calligraphy-Fallback-OFL.txt'
shutil.copyfile(ROOT / 'portal/masters/editorial-v1/MaShanZheng-OFL.txt', masters / license_name)
shutil.copyfile(masters / license_name, output.parent / license_name)
shutil.copyfile(output, masters / output.name)
record = {
    'schemaVersion': 1,
    'id': output.name,
    'purpose': 'Supplement missing Chinese glyphs with locally hosted calligraphy, retaining the official primary font',
    'source': 'https://github.com/googlefonts/mashanzheng',
    'sourceFile': str(source.relative_to(ROOT)).replace('\\', '/'),
    'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
    'license': 'SIL Open Font License 1.1',
    'licenseFile': license_name,
    'path': str(output.relative_to(game)).replace('\\', '/'),
    'master': str((masters / output.name).relative_to(game)).replace('\\', '/'),
    'bytes': output.stat().st_size,
    'sha256': hashlib.sha256(output.read_bytes()).hexdigest(),
    'primaryCodepoints': len(primary_chars),
    'supplementCodepoints': len(missing),
    'combinedCodepoints': len(combined),
    'verifiedCopy': required,
    'review': 'Official titlefont web subsets omit U+5FAA, U+719F, U+6362 and U+505C; the supplement covers all four without system font substitution',
    'build': 'py -3.14 tools/prepare-honor-fonts.py',
}
(masters / 'HOK_03_DATA_font-coverage_v2.manifest.json').write_text(json.dumps(record, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'bytes': record['bytes'], 'primary': len(primary_chars), 'supplement': len(missing), 'covered': len(combined)}))
