"""Prepare local fonts and lossless source copies for the portal art direction.

Requires Pillow, fonttools and brotli. Video bytes are never transcoded.
"""
from pathlib import Path
import hashlib
import json
import shutil
from PIL import Image
from fontTools import subset

root = Path(__file__).resolve().parent.parent
masters = root / 'portal/masters/editorial-v1'
assets = root / 'portal/assets'
assets.mkdir(parents=True, exist_ok=True)
config = json.loads((root / 'portal.config.json').read_text(encoding='utf-8-sig'))
text = json.dumps(config, ensure_ascii=False)
for name in ['index.html', 'portal.js']:
    text += (root / 'portal' / name).read_text(encoding='utf-8-sig')
for game in json.loads((root / 'games.json').read_text(encoding='utf-8-sig'))['games']:
    data = json.loads((root / game['directory'] / 'game.config.json').read_text(encoding='utf-8-sig'))
    text += json.dumps(data.get('portal', {}), ensure_ascii=False)
    catalog = json.loads((root / game['directory'] / data['data']['catalog']).read_text(encoding='utf-8-sig'))
    text += ''.join(character['name'] for character in catalog)
text += '原神王者荣耀位英雄角色条台词语音音乐进入档案返回全部游戏暂停背景视频播放背景视频0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz/©↗'
records = []

def register(path, **meta):
    blob = path.read_bytes()
    records.append(dict(path=str(path.relative_to(root)).replace('\\', '/'), bytes=len(blob), sha256=hashlib.sha256(blob).hexdigest(), **meta))

for source, target, license_name, url in [
    ('MaShanZheng-Regular.ttf', 'PORTAL_03_DATA_brush_v1.woff2', 'MaShanZheng-OFL.txt', 'https://github.com/googlefonts/mashanzheng'),
    ('NotoSerifSC.ttf', 'PORTAL_03_DATA_text_v1.woff2', 'NotoSerifSC-OFL.txt', 'https://github.com/google/fonts/tree/main/ofl/notoserifsc'),
]:
    options = subset.Options()
    options.flavor = 'woff2'
    options.name_IDs = ['*']
    options.name_legacy = True
    font = subset.load_font(str(masters / source), options)
    cutter = subset.Subsetter(options=options)
    cutter.populate(text=text)
    cutter.subset(font)
    subset.save_font(font, str(assets / target), options)
    shutil.copyfile(masters / license_name, assets / license_name)
    register(assets / target, source=url, master=f'portal/masters/editorial-v1/{source}', license='SIL OFL 1.1', purpose='Self-hosted portal typography', glyphs=len(font.getBestCmap()))

sky = assets / 'PORTAL_03_BG_celestial-editorial_v1.webp'
with Image.open(masters / 'PORTAL_03_BG_celestial-editorial_v1.png') as picture:
    picture.save(sky, 'WEBP', quality=91, method=6)
    size = list(picture.size)
register(sky, master='portal/masters/editorial-v1/PORTAL_03_BG_celestial-editorial_v1.png', source='OpenAI built-in image_gen', taskId='exec-254e3ac9-2a3f-4c80-a06a-4ec358e2e114', dimensions=size, purpose='Celestial editorial hero scene', transformation='WebP format conversion only')

video = assets / 'PORTAL_03_VID_celestial-sea_v1.mp4'
video_source = root / 'yuanshenvoice/assets/masters/video/teyvat-starry-sea.mp4'
shutil.copyfile(video_source, video)
assert hashlib.sha256(video.read_bytes()).digest() == hashlib.sha256(video_source.read_bytes()).digest()
register(video, master=str(video_source.relative_to(root)).replace('\\', '/'), dimensions=[1248, 704], fps=60, duration=8.016667, channels='H.264 video only', source='Existing project reviewed source', purpose='Silent looping footer background', transformation='Byte-for-byte copy')
poster = assets / 'PORTAL_03_BG_celestial-sea-poster_v1.webp'
shutil.copyfile(root / 'yuanshenvoice/assets/video/teyvat-starry-sea-poster.webp', poster)
register(poster, source='Existing project video poster', purpose='Footer poster and reduced-motion fallback')
(masters / 'PORTAL_03_DATA_assets_v1.manifest.json').write_text(json.dumps({'schemaVersion': 1, 'assets': records}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
for record in records:
    print(record['path'], record['bytes'])
