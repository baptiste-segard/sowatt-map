"""Assemble le site statique (../site/) et la page artifact (../site/artifact.html) depuis template.html + app.mjs + données.
Usage : python3 build.py   (après occupants.py / convergences.py / logos.py si les données ont changé)"""
import json, os, re, shutil, subprocess, sys
from collections import Counter

ROOT = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.join(ROOT, '..', 'site')
os.chdir(ROOT)
sys.path.insert(0, ROOT)
from occupants import RELATIONS, CATS  # noqa

occ = json.load(open('occupants.json'))
PUBLIC = os.environ.get('PUBLIC') == '1'  # version publiable : sans mails ni téléphones
if PUBLIC:
    for o in occ:
        o['mails'] = []
        o['phone'] = ''
    SITE = os.path.join(ROOT, '..', 'site-public')
    os.makedirs(SITE, exist_ok=True)
    for d in ('logos', 'plans', 'vendor'):
        if not os.path.exists(os.path.join(SITE, d)):
            shutil.copytree(os.path.join(ROOT, '..', 'site', d), os.path.join(SITE, d))
# ---- enrichissement (sites des structures, 24/10/2026) : offre, formats, agenda, réseaux, contacts trouvés
import datetime
MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
def agenda_item(a):
    d = a['date']; parts = d.split('/'); y, *ym = parts[0].split('-'); m = int(ym[0]) if ym else None; rest = ym[1:]
    days = ([rest[0]] if rest else []) + parts[1:]
    if not m: return dict(a, label=y, end=f'{y}-12-31')
    end = f'{y}-{m:02d}-{int(days[-1]):02d}' if days else f'{y}-{m:02d}-28'
    lab = (('–'.join(str(int(x)) for x in [days[0], days[-1]]) if len(days) == 2 and len(parts) == 2 else ', '.join(str(int(x)) for x in days)) + ' ' if days else '') + MOIS[m - 1] + ('' if y == '2026' else ' ' + y)
    return dict(a, label=lab, end=end)
ENR = json.load(open('enrichissement.json'))
for o in occ:
    e = ENR.get(o['id'], {})
    for k in ('offre', 'formats'):
        o[k] = e.get(k, '')
    o['publicsDetail'] = e.get('publics', '')
    o['agenda'] = sorted((agenda_item(a) for a in e.get('agenda', [])), key=lambda a: a['end'])
    o['reseaux'] = e.get('reseaux', [])
    o['alertes'] = e.get('alertes', [])
    if not PUBLIC:
        o['mails'] = o.get('mails', []) + [m for m in e.get('mails_trouves', []) if m not in o.get('mails', [])]
        if not o.get('phone') and e.get('tel_trouves'):
            o['phone'] = e['tel_trouves'][0]
conv = json.load(open('convergences.json'))
byid = {o['id']: o for o in occ}

# ---- points d'acupuncture : convergences × diversité des catégories reliées
membership = {}
for c in conv['convergences']:
    for m in c['members']:
        membership.setdefault(m['id'], []).append(c)
scores = []
for o in occ:
    cs = membership.get(o['id'], [])
    fams = {c['family'] for c in cs}
    cats = set()
    for c in cs:
        for m in c['members']:
            if m['id'] != o['id']:
                cats.add(byid[m['id']]['cat'])
    score = sum(1 if c['family'] == 'niche' else 2 for c in cs) + len(fams) + len(cats) * 0.35 + (3 if o['id'] in conv['notes'] else 0)
    o['acu'] = {'score': round(score, 2), 'n': len(cs), 'fams': len(fams), 'cats': len(cats), 'note': conv['notes'].get(o['id']), 'top': False, 'rank': None}
    scores.append((score, o['id']))
scores.sort(reverse=True)
for i, (s, oid) in enumerate(scores[:12]):
    byid[oid]['acu']['top'] = True
    byid[oid]['acu']['rank'] = i + 1
print('acupuncture :', [(byid[oid]['name'], byid[oid]['acu']['n'], round(s, 1)) for s, oid in scores[:12]])

conv_out = dict(conv, relations=[dict(a=a, b=b, why=w) for a, b, w in RELATIONS])
data_js = json.dumps(occ, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
conv_js = json.dumps(conv_out, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
app = open('app.mjs').read().replace('</script', '<\\/script')
tpl = open('template.html').read()
geo_js = open('geo.json').read()


def render(three_url, d3_url):
    return tpl.replace('__THREE_URL__', three_url).replace('__D3_URL__', d3_url).replace('__DATA__', data_js).replace('__CONV__', conv_js).replace('__GEO__', geo_js).replace('__APP_JS__', app)


# ---- artifact (le wrapper ajoute doctype/head/body) : CDN autorisés
art = render('https://cdnjs.cloudflare.com/ajax/libs/three.js/0.160.0/three.module.min.js', 'https://cdnjs.cloudflare.com/ajax/libs/d3/7.9.0/d3.min.js')
os.makedirs(SITE, exist_ok=True)
open(os.path.join(SITE, 'artifact.html'), 'w').write(art)

# ---- site statique : tout en local
page = render('./vendor/three.module.min.js', 'vendor/d3.min.js')
head_end = page.index('</style>') + len('</style>')
head_part, body_part = page[:head_end], page[head_end:]
html = f"""<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="Carte interactive des occupant·e·s du Sowatt, tiers-lieu de Saint-André-lez-Lille : qui est là, où, avec qui, et où converger.">
<meta name="robots" content="noindex">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<style>html{{color-scheme:light}}body{{margin:0}}img{{max-width:100%}}[hidden]{{display:none!important}}</style>
{head_part}
</head>
<body>
{body_part}
</body>
</html>
"""
open(os.path.join(SITE, 'index.html'), 'w').write(html)
open(os.path.join(SITE, 'favicon.svg'), 'w').write('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><polygon points="16,1 19.5,11.5 31,11.5 21.7,18.3 25.2,29 16,22.4 6.8,29 10.3,18.3 1,11.5 12.5,11.5" fill="#F05A28"/></svg>')
os.makedirs(os.path.join(SITE, 'data'), exist_ok=True)
json.dump(occ, open(os.path.join(SITE, 'data', 'occupants.json'), 'w'), ensure_ascii=False, indent=1)
json.dump(conv_out, open(os.path.join(SITE, 'data', 'convergences.json'), 'w'), ensure_ascii=False, indent=1)
# CSV pour la maintenance
import csv
with open(os.path.join(SITE, 'data', 'occupants.csv'), 'w', newline='') as f:
    w = csv.writer(f)
    w.writerow(['id', 'structure', 'personnes', 'categorie', 'themes', 'publics', 'etage', 'bureau', 'site', 'mails', 'telephone', 'convergences', 'acupuncture_rang', 'descriptif'])
    for o in occ:
        w.writerow([o['id'], o['name'], o['people'], o['catLabel'], ' | '.join(o['themes']), ' | '.join(o['publics']), o['floorLabel'], o['room'], o['website'], ' / '.join(o['mails']), o['phone'], ' | '.join(c['title'] for c in membership.get(o['id'], [])), o['acu']['rank'] or '', o['desc']])
# vérification syntaxe du module
open('/tmp/check.mjs', 'w').write(app)
r = subprocess.run(['node', '--check', '/tmp/check.mjs'], capture_output=True, text=True)
print('syntaxe', 'ok' if r.returncode == 0 else r.stderr[:600])
total = sum(os.path.getsize(os.path.join(dp, f)) for dp, _, fs in os.walk(SITE) for f in fs if f != 'artifact.html')
print('site', round(total / 1024), 'Ko ;', len([f for f in os.listdir(os.path.join(SITE, 'logos'))]), 'logos ; index.html', round(os.path.getsize(os.path.join(SITE, 'index.html')) / 1024), 'Ko')

# ---- version autonome (un seul fichier, ouvrable en double-clic même en file://) : libs, plans et logos inlinés
import base64
def b64(p, mime): return f'data:{mime};base64,' + base64.b64encode(open(p, 'rb').read()).decode()
three_src = open(os.path.join(SITE, 'vendor', 'three.module.min.js')).read()
three_data = 'data:text/javascript;base64,' + base64.b64encode(three_src.encode()).decode()
d3_src = open(os.path.join(SITE, 'vendor', 'd3.min.js')).read().replace('</script', '<\\/script')
app_sa = app
for f in sorted(os.listdir(os.path.join(SITE, 'plans'))):
    app_sa = app_sa.replace(f"'plans/{f}'", "'" + b64(os.path.join(SITE, 'plans', f), 'image/webp') + "'")
logo_map = {o['id']: b64(os.path.join(SITE, 'logos', o['id'] + '.webp'), 'image/webp') for o in occ if o['logo']}
app_sa = app_sa.replace("const logoUrl = o => o.logo ? `logos/${o.id}.webp` : null;", "const LOGOS=" + json.dumps(logo_map) + ";\nconst logoUrl = o => o.logo ? LOGOS[o.id] : null;")
sa = tpl.replace('__THREE_URL__', three_data).replace('<script src="__D3_URL__"></script>', '<script>' + d3_src + '</script>').replace('__DATA__', data_js).replace('__CONV__', conv_js).replace('__GEO__', geo_js).replace('__APP_JS__', app_sa)
he = sa.index('</style>') + len('</style>')
open(os.path.join(SITE, 'sowatt-carte-autonome.html'), 'w').write(html.replace(head_part, sa[:he]).replace(body_part, sa[he:]))
print('autonome', round(os.path.getsize(os.path.join(SITE, 'sowatt-carte-autonome.html')) / 1024), 'Ko')
