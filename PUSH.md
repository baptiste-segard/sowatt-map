# Mettre en ligne sur GitHub Pages (5 minutes)

1. Sur github.com : New repository → nom `sowatt-map` (public, vide, sans README).
2. Dans le Terminal :
   cd ~/Documents/Claude/Projects/so-watt/github
   git init -b main
   git add .
   git commit -m "Sowatt map v2"
   git remote add origin git@github.com:<ton-compte>/sowatt-map.git   # ou l'URL https
   git push -u origin main
3. Sur GitHub : Settings → Pages → Source « Deploy from a branch » → Branch `main` / dossier `/docs` → Save.
4. Après 1 à 2 minutes : https://<ton-compte>.github.io/sowatt-map/

Le dossier docs/ est la version publique (sans mails ni téléphones). Pour une version privée avec contacts, il faut GitHub Pro/Team (Pages sur dépôt privé) ou le serveur o2switch.
