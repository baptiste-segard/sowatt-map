"""Régénère docs/index.html et docs/sowatt-carte-autonome.html depuis template.html + app.mjs,
en réutilisant les données déjà embarquées dans docs/index.html (pas besoin de occupants.json ni du tableur).
À utiliser pour une modif d'interface seule. Usage : python3 src/rebuild_docs.py (depuis la racine du dépôt ou src/)."""
import base64, json, os, re, subprocess
ROOT = os.path.dirname(os.path.abspath(__file__)); os.chdir(ROOT)
DOCS = os.path.join(ROOT, '..', 'docs')
old = open(os.path.join(DOCS, 'index.html'), encoding='utf-8').read()
def tagjson(i): return re.search(r'<script id="%s" type="application/json">(.*?)</script>' % i, old, re.S).group(1)
data_js, conv_js, geo_js = tagjson('data'), tagjson('conv'), tagjson('geo')
occ = json.loads(data_js.replace('<\\/', '</'))
def _datauri(p): return 'data:image/png;base64,' + base64.b64encode(open(os.path.join(ROOT, 'brand', p), 'rb').read()).decode()
LOGO = _datauri('sowatt-logo.png'); icon64 = _datauri('sowatt-icon-64.png'); icon180 = _datauri('sowatt-icon-180.png')
tpl = open('template.html', encoding='utf-8').read().replace('__SOWATT_LOGO__', LOGO)
app = open('app.mjs', encoding='utf-8').read().replace('</script', '<\\/script')
def render(three_url, d3_url, app_js=app):
    return tpl.replace('__THREE_URL__', three_url).replace('__D3_URL__', d3_url).replace('__DATA__', data_js).replace('__CONV__', conv_js).replace('__GEO__', geo_js).replace('__APP_JS__', app_js)
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
<link rel="icon" href="{icon64}" type="image/png">
<link rel="apple-touch-icon" href="{icon180}">
<meta name="theme-color" content="#EC644B">
<style>html{{color-scheme:light}}body{{margin:0}}img{{max-width:100%}}[hidden]{{display:none!important}}</style>
{head_part}
</head>
<body>
{body_part}
</body>
</html>
"""
open(os.path.join(DOCS, 'index.html'), 'w', encoding='utf-8').write(html)
chk = os.path.join(ROOT, '..', '.check.mjs'); open(chk, 'w').write(open('app.mjs').read())
r = subprocess.run(['node', '--check', chk], capture_output=True, text=True); os.remove(chk)
print('syntaxe', 'ok' if r.returncode == 0 else r.stderr[:600])
# version autonome
def b64(p, mime): return f'data:{mime};base64,' + base64.b64encode(open(p, 'rb').read()).decode()
three_data = 'data:text/javascript;base64,' + base64.b64encode(open(os.path.join(DOCS, 'vendor', 'three.module.min.js'), 'rb').read()).decode()
d3_src = open(os.path.join(DOCS, 'vendor', 'd3.min.js'), encoding='utf-8').read().replace('</script', '<\\/script')
app_sa = app
for f in sorted(os.listdir(os.path.join(DOCS, 'plans'))):
    app_sa = app_sa.replace(f"'plans/{f}'", "'" + b64(os.path.join(DOCS, 'plans', f), 'image/webp') + "'")
logo_map = {o['id']: b64(os.path.join(DOCS, 'logos', o['id'] + '.webp'), 'image/webp') for o in occ if o.get('logo')}
app_sa = app_sa.replace("const logoUrl = o => o.logo ? `logos/${o.id}.webp` : null;", "const LOGOS=" + json.dumps(logo_map) + ";\nconst logoUrl = o => o.logo ? LOGOS[o.id] : null;")
sa = tpl.replace('__THREE_URL__', three_data).replace('<script src="__D3_URL__"></script>', '<script>' + d3_src + '</script>').replace('__DATA__', data_js).replace('__CONV__', conv_js).replace('__GEO__', geo_js).replace('__APP_JS__', app_sa)
he = sa.index('</style>') + len('</style>')
open(os.path.join(DOCS, 'sowatt-carte-autonome.html'), 'w', encoding='utf-8').write(html.replace(head_part, sa[:he]).replace(body_part, sa[he:]))
print('index', round(os.path.getsize(os.path.join(DOCS, 'index.html')) / 1024), 'Ko ; autonome', round(os.path.getsize(os.path.join(DOCS, 'sowatt-carte-autonome.html')) / 1024), 'Ko')
