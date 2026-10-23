# Sowatt — carte des occupant·e·s

Carte interactive des structures du Sowatt (tiers-lieu, Saint-André-lez-Lille) : grappes, bâtiment en 3D sur l'orthophoto, convergences et points d'acupuncture.

- `docs/` : le site statique servi par GitHub Pages — **version publique sans mails ni téléphones**.
- `src/` : sources et données (`occupants.py`, `convergences.py`, `geo.json`, `template.html`, `app.mjs`, `build.py`).

Données nominatives : `src/occupants.py` lit un export du tableur (`sowatt_raw.json`, non versionné car il contient mails et téléphones) ; à placer à côté avant un rebuild.

Rebuild : `cd src && python3 occupants.py && python3 convergences.py && PUBLIC=1 python3 build.py` (écrit ../site-public/, à copier dans docs/).
Sans `PUBLIC=1`, build.py produit la version complète avec contacts dans ../site/ (usage interne).

Sources : tableur « LISTE OCCUPANT.E.S » (23/10/2026), sowatt-tierslieu.fr, plans A3 (20/10/2026). Orthophoto © IGN · emprise © contributeurs OpenStreetMap. Réalisation Studio CAD.
