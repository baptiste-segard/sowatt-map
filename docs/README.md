# Sowatt — carte des occupant·e·s (site statique)

Déploiement : copier ce dossier tel quel sur n'importe quel serveur web (pas de build, pas de backend, aucune requête externe sauf Google Fonts).

```
index.html          l'application complète (balisage, styles, script, données embarquées)
vendor/d3.min.js    D3 v7.9.0            vendor/three.module.min.js   three.js 0.160 (vue 3D)
logos/<id>.webp     un logo carré par structure (69 sur 100)
plans/floor0..3     fonds de plan RDC / 1er / 2e / 3e (WebP, issus du PDF Canva du 20/10/2026)
data/               occupants.json / .csv et convergences.json, pour la maintenance
artifact.html       la même page sans doctype, pour l'artifact Claude (CDN cdnjs)
```

Données : tableur « LISTE OCCUPANT.E.S » (23/10/2026) + sowatt-tierslieu.fr + plans A3. 100 structures, 16 convergences.
Pour mettre à jour : éditer `src/occupants.py` / `src/convergences.py` dans le projet source puis `python3 build.py`
(ou, à la main, remplacer le JSON dans `<script id="data">` et `<script id="conv">` d'index.html).

`<meta name="robots" content="noindex">` est posé : à retirer si le site devient public. Les mails et téléphones sont dans la page : usage interne.
