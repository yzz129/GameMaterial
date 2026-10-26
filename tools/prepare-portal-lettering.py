"""Package approved calligraphy artwork at original resolution with its alpha."""
from pathlib import Path
import hashlib
import json
from PIL import Image

root = Path(__file__).resolve().parent.parent
masters = root / 'portal/masters/lettering-v1'
manifest_path = masters / 'PORTAL_04_DATA_lettering_v1.manifest.json'
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
for asset in manifest['assets']:
    source = masters / asset['master']
    target = root / asset['target']
    target.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(source) as picture:
        assert picture.mode == 'RGBA', 'Calligraphy must preserve transparent alpha'
        assert picture.getchannel('A').getextrema()[0] == 0
        picture.save(target, 'WEBP', quality=94, method=6, exact=True)
        asset['dimensions'] = list(picture.size)
        asset['alphaBounds'] = list(picture.getchannel('A').getbbox())
    asset['masterSha256'] = hashlib.sha256(source.read_bytes()).hexdigest()
    asset['sha256'] = hashlib.sha256(target.read_bytes()).hexdigest()
    asset['bytes'] = target.stat().st_size
    asset['transformation'] = 'WebP encoding at quality 94; original resolution and alpha preserved'
    print(asset['target'], asset['dimensions'], asset['bytes'])
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
