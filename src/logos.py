# -*- coding: utf-8 -*-
"""Logos : 1) extraits des plans PDF (work/pdfimg/logo-p<page>-<i>.png), 2) favicons / og:image des sites web.
Sortie : site/logos/<id>.webp (carré 320 px, fond blanc) + champ logo dans occupants.json (plan | web | None)."""
import json, os, io, re, sys, urllib.request, urllib.parse
from PIL import Image

ROOT = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.join(ROOT, '..', 'work')
OUT = os.path.join(ROOT, '..', 'site', 'logos')
os.makedirs(OUT, exist_ok=True)

PLAN = {  # (page, image index) -> id
    (0, 1): 'consignerie', (0, 2): 'kino', (0, 3): 'litha', (0, 4): 'capstone', (0, 5): 'craienco', (0, 9): 'studiocad',
    (0, 11): 'igwap', (0, 12): 'amv', (0, 13): 'intermede', (0, 14): 'refill', (0, 15): 'vif', (0, 17): 'exocer', (0, 18): 'nexus',
    (0, 19): 'aqualunia', (0, 20): 'lesgus', (0, 21): 'laseconde', (0, 23): 'opale', (0, 24): 'sinode',
    (1, 1): 'ouichange', (1, 2): 'atk', (1, 3): 'knapfla', (1, 4): 'bouillon', (1, 5): 'thinkvitality', (1, 6): 'maranta', (1, 7): 'maillart',
    (1, 17): 'unasdebruja', (1, 20): 'coalline', (1, 21): 'joonailz', (1, 22): 'sneuf', (1, 23): 'nininails', (1, 24): 'assureetmoi',
    (1, 25): 'bacprod', (1, 26): 'vingtdeux', (1, 28): 'leflower', (1, 29): 'licols', (1, 30): 'cyremia', (1, 32): 'harch',
    (2, 1): 'artorium', (2, 2): 'buddy', (2, 3): 'lafoule', (2, 4): 'maze', (2, 5): 'helcou', (2, 6): 'holy', (2, 7): 'diy', (2, 8): 'astreos',
    (2, 9): 'sunday', (2, 10): 'corman', (2, 12): 'aeg', (2, 13): 'antego', (2, 14): 'selvamaris', (2, 15): 'hibourouge', (2, 19): 'rcc', (2, 21): 'mishou',
    (3, 1): 'lafabric', (3, 2): 'casamia', (3, 4): 'giselleetrose', (3, 7): 'likeafree', (3, 8): 'polaifos', (3, 10): 'ema',
    (3, 11): 'bricknum', (3, 12): 'willrh',
}
EXTRA_FILES = {'soluxan': os.path.join(WORK, 'pdfimg', 'soluxan.png')}  # extrait à part (1800×1800)


def square(img, size=320, pad=0.08):
    img = img.convert('RGBA')
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)
    w, h = img.size
    side = int(max(w, h) * (1 + pad * 2))
    canvas = Image.new('RGBA', (side, side), (255, 255, 255, 255))
    canvas.alpha_composite(img, ((side - w) // 2, (side - h) // 2))
    return canvas.convert('RGB').resize((size, size), Image.LANCZOS)


def trim_white(img):
    """Retire les marges blanches / transparentes avant la mise au carré (évite les wordmarks minuscules)."""
    rgba = img.convert('RGBA')
    bg = Image.new('RGBA', rgba.size, (255, 255, 255, 255))
    flat = Image.alpha_composite(bg, rgba).convert('L')
    mask = flat.point(lambda v: 255 if v < 245 else 0)
    bbox = mask.getbbox()
    return rgba.crop(bbox) if bbox else rgba


def fetch(url, timeout=12):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (sowatt-map logo fetch)'})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read(), r.headers.get('Content-Type', '')


def from_web(site):
    """Essaie og:image puis apple-touch-icon puis favicon Google s2."""
    cands = []
    try:
        html, _ = fetch(site)
        html = html.decode('utf-8', 'ignore')
        m = re.search(r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)', html) or re.search(r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image["\']', html)
        for m2 in re.finditer(r'<link[^>]+rel=["\'][^"\']*(apple-touch-icon|icon)[^"\']*["\'][^>]*>', html, re.I):
            h = re.search(r'href=["\']([^"\']+)', m2.group(0))
            if h:
                cands.append(urllib.parse.urljoin(site, h.group(1)))
        if m and 'instagram' not in site:
            cands.insert(0, urllib.parse.urljoin(site, m.group(1)))
    except Exception as e:
        pass
    host = urllib.parse.urlparse(site).netloc
    cands.append(f'https://www.google.com/s2/favicons?domain={host}&sz=256')
    for u in cands:
        try:
            data, ct = fetch(u)
            img = Image.open(io.BytesIO(data))
            img.load()
            if min(img.size) < 48:
                continue
            return img, u
        except Exception:
            continue
    return None, None


def main():
    occ = json.load(open(os.path.join(ROOT, 'occupants.json')))
    done = {}
    for (p, i), oid in PLAN.items():
        f = os.path.join(WORK, 'pdfimg', f'logo-p{p}-{i}.png')
        if oid in done or not os.path.exists(f):
            continue
        square(trim_white(Image.open(f))).save(os.path.join(OUT, oid + '.webp'), quality=82, method=6)
        done[oid] = 'plan'
    for oid, f in EXTRA_FILES.items():
        if os.path.exists(f):
            square(trim_white(Image.open(f))).save(os.path.join(OUT, oid + '.webp'), quality=82, method=6)
            done[oid] = 'plan'
    if '--no-web' not in sys.argv:
        for o in occ:
            if o['id'] in done or not o['website'] or 'instagram.com' in o['website'] or 'linkedin.com' in o['website']:
                continue
            img, u = from_web(o['website'])
            if img is not None:
                square(trim_white(img)).save(os.path.join(OUT, o['id'] + '.webp'), quality=82, method=6)
                done[o['id']] = 'web'
                print('web ', o['id'], u)
            else:
                print('----', o['id'], o['website'])
    for o in occ:
        o['logo'] = done.get(o['id'])
    json.dump(occ, open(os.path.join(ROOT, 'occupants.json'), 'w'), ensure_ascii=False, indent=1)
    from collections import Counter
    print(Counter(o['logo'] for o in occ))


if __name__ == '__main__':
    main()
