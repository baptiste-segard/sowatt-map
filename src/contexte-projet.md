# Sowatt mapping — contexte projet (au 23/10/2026)

## Le projet
- Objectif (Baptiste) : une mindmap des structures présentes au Sowatt (tiers-lieu, 37 av. du Maréchal de Lattre de Tassigny, Saint-André-lez-Lille), les relations entre elles, et les **points de convergence / d'acupuncture** — en reprenant l'approche du prototype eco-map (GRLI / HE4G).
- Décisions du 23/10 : livrable = site statique + artifact (comme eco-map) ; vue « lieu » = **plan par étage en 3D WebGL** (préférence explicite pour le WebGL plutôt que l'axonométrie SVG) ; fiches avec **tout** (personnes, mails, téléphones — outil interne) ; logos récupérés.

## Sources
- Tableur Drive « LISTE OCCUPANT.E.S » (xlsx, id `1Fm5oMypre7YRVK-mG68fwHlXaRzigb8o`), onglet *Actuels* : 98 structures (Structure, Nom, Descriptif, Emplacement, n° bureau, Catégorie, Site, Mail, Téléphone). Onglet *Anciens occupants* (8) non repris.
- https://sowatt-tierslieu.fr/les-occupant-e-s/ : descriptions courtes et liens, sections Ateliers / Artistes / Associations / Entreprises (sous-catégories artisanat, bien-être, communication, restauration, services, bâtiment). A servi à compléter sites et descriptifs ; 2 structures présentes sur le site/plan mais pas au tableur ont été ajoutées (Zeste d'Amande, Henri Lemahieu). Poëtic Brindilles fusionné avec Natasha Dupont (même mail).
- `Plans A3 SW - oct 26.pdf` (Canva, Zoé / Intermède, MAJ 20/10/2026) : 4 pages RDC / 1er / 2e / 3e. Extraction par pdfplumber : fond de plan (image 2233×3159 ou 3388×4600 + masque) → `site/plans/floor{0..3}.webp` éclairci, et position (x,y en points PDF) de chaque logo / libellé → `px, py` dans les données. 64 logos tirés du PDF, 15 complétés depuis les sites web (og:image / favicon), 10 écartés (photos, favicon générique) ; **69 logos** au total.
- Écarts tableur / plan : Brick&Num et Pauline Caenen sont au 3e sur le plan (2e au tableur) ; IGWAP sur le plan RDC (sous-sol au tableur) ; Kino Ciné bureau 067 ⇒ RDC. Le plan a été suivi. Jérôme Boccia, Slawa, Sophie Letertre : absents du plan ⇒ position approximative (flag `approx`).

## Modèle de données (src/occupants.py)
- 100 structures. Catégorie (couleur) : Artistes 25 · Services aux entreprises 16 · Artisanat & création 15 · Associations & collectifs 13 · Communication & image 11 · Ateliers créatifs 7 · Bâtiment & immobilier 6 · Bien-être & soin 5 · Restauration & alimentation 2.
- 17 thèmes transversaux (plusieurs par structure) : Arts visuels 28 · Ateliers & transmission 27 · Transition écologique & sociale 16 · Spectacle vivant & événementiel 14 · Image, vidéo & son 14 · Numérique & IA 11 · Mode, textile & upcycling 11 · Communication & marque 10 · RH, organisation & gouvernance 9 · Enfance & familles 9 · Santé & bien-être 8 · Bâtiment, espace & immobilier 8 · Céramique, bijoux & matières 7 · Alimentation & restauration 6 · Beauté & soin 6 · Logistique, sécurité & mobilité 5 · Finance, assurance & gestion 4.
- 6 publics : Particuliers, Entreprises, Enfants & familles, Collectivités & associations, Artistes & créatifs, Scolaires.
- Étages : 1er 36 · 2e 26 · RDC 19 · 3e 14 · sous-sol 3 · cour 1 · bât. B 1.
- **Thèmes, publics, convergences et rôles sont des hypothèses de lecture des descriptifs** : à faire valider par Intermède / les occupant·e·s.

## Convergences et points d'acupuncture (src/convergences.py)
- 16 convergences en 4 familles : *Faire ensemble* (image & son, communication & marque, scène & récit, mode & textile, bâtiment, numérique, collectif d'ateliers d'artistes), *Mêmes publics* (enfance & familles, beauté, santé & bien-être, RH, assurance & gestion), *Transition* (réparer-réemployer, transformer les organisations), *Vie du lieu* (table & convivialité, faire tourner le lieu). Chacune a un résumé, un « ce que ça pourrait devenir » (action concrète) et des membres avec leur rôle.
- 9 relations déclarées (Capstone–Intermède, Maill'Art–Maze, Refill–Petite Madeleine, etc.).
- Points d'acupuncture : score = 2 × nb de convergences + nb de familles + 0,35 × nb de catégories reliées + 3 si curation commentée. Top 12 au 23/10 : Vivons en Forme, Studio CAD, Intermède, Ateliers DIY, Family Forme, La Consignerie, Leflower Studio, Coralie Hamaide, Mathieu Dauchy, Mishou Wigs, Exocer, Refill Atelier. Les notes curatoriales (`ACU_NOTES`) expliquent le « pourquoi » dans la fiche.
- Relations calculées côté client : convergences communes (liens pleins orange), affinités thématiques (pointillés gris), voisin·e·s de bureau / d'étage (liste dans la fiche).

## Interface (src/template.html + src/app.mjs)
- Dérivée du prototype eco-map v6 (header une ligne, filtres repliables à facettes, fiche à droite, mobile en bottom-sheets). Onboarding / profil / stress test retirés (non pertinents pour un lieu de 100 structures). UI en français, accent orange Sowatt.
- Vues : **Grappes** (pack D3, regroupement par catégorie / thèmes / étage / convergences / publics), **Le lieu 3D** (three.js 0.160, voir ci-dessous), **Convergences** (pack famille → convergence → membres).
- **Onboarding repris d'eco-map** (demande de Baptiste du 23/10) : 6 écrans pilotés au scroll / flèches — 100 particules → regroupement par catégorie → « Qui êtes-vous ? » (sa structure, recherche par nom ; visiteur·se sinon) → « Sur quoi travaillez-vous ? » (≤3 thèmes) → « Quel chantier vous tente ? » (convergences) → « Votre vue » (vol 3D vers son bureau). Profil mémorisé en local (`sowatt.profile`), bouton « Votre vue » (profil, Modifier, Tout afficher, Revoir l'intro, À propos), panneau « pour vous » : structure, plus proches (thèmes, chantiers, même palier, relations déclarées), chantiers pour vous, voisin·e·s de palier.

## La 3D (v2 du 23/10, après retour « la 3D est vraiment pas terrible »)
- Baptiste préfère le WebGL à une axonométrie SVG, et voulait que ça ressemble au vrai bâtiment (« utilise Google Maps »).
- Géoréférencement : emprise du bâtiment OSM way 125777214 (« So Watt », 50.65514 N 3.04281 E, ~2 465 m², L de 97 × 66 m) ; orthophoto IGN (Géoplateforme, WMTS ORTHOIMAGERY.ORTHOPHOTOS, 25 tuiles z19, ~0,19 m/px, Licence Ouverte) ; le fond de plan RDC (masque alpha du PDF) a été calé sur l'emprise par aire et centroïdes : **1 m = 12,33 pt de plan, rotation 146°** (le +x du plan, c.-à-d. l'aile sur rue, pointe au NW ; l'aile longue part de l'angle sud-est vers le SW). Vérifié visuellement (`work/align_sheet2.png`). Constantes dans `src/geo.json` (theta, centroïde plan, pts/m, calage ortho, polygone d'emprise).
- Scène : sol = orthophoto 1024 px (≈ 242 m) avec vignette blanche ; bâtiment = groupe tourné de 146°, une dalle texturée par étage (plans éclaircis), **murs translucides extrudés depuis l'emprise** + arêtes, hauteur d'étage 3,6 m × 1,25 en mode *Compact*, 11 m en mode *Éclaté* (bascule dans la barre) ; sprites-logos posés au bureau avec un petit mât, libellés en taille écran, liens 3D en arcs (noir = déclaré, orange = convergence, gris pointillé = affinité), halo sur la sélection, filtre par étage, boussole N, caméra par défaut depuis la rue (NE), vol vers la structure ou la convergence sélectionnée. Rendu à la demande (pas de boucle continue).
- Hors plan : sous-sol (3 structures) sur une dalle schématique sous le RDC ; cour (Bon'Allure) dans l'angle intérieur du L ; bâtiment B (Family Forme) posé à l'ouest de l'aile longue, **emplacement à confirmer**.
- Attribution affichée dans la légende : Orthophoto © IGN · emprise © contributeurs OpenStreetMap.
- Recherche sur nom, personnes, descriptif, bureau et titres de convergences.

## Livrables
- `so-watt/site/` : site statique prêt à déployer (index.html, vendor/ d3 + three, logos/, plans/ dont ortho.webp, data/ JSON + CSV). `noindex` activé. Contient aussi `artifact.html` (version sans doctype pour l'artifact Claude) et `sowatt-carte-autonome.html` (un seul fichier, tout inliné, ouvrable en double-clic ; index.html seul ne s'ouvre pas en file:// à cause des modules ES).
- `so-watt/src/` : occupants.py → occupants.json, convergences.py → convergences.json, logos.py, geo.json, template.html, app.mjs, build.py.
- Artifact Claude publié (lien dans le README / le projet).

## Pistes
- Faire valider thèmes / convergences par Intermède ; formulaire de mise à jour (ce que je propose / ce que je cherche) comme pour eco-map.
- Positionner les 5 structures hors plan (sous-sol, bât. B, cour) si un plan existe.
- Compléter les 31 logos manquants (demander aux structures).
- Vue « parcours » dans le bâtiment (chemin le plus court entre deux structures) et calendrier des événements du lieu.

## Mise en ligne
- Version publique (sans coordonnées) servie par GitHub Pages depuis `docs/` ; version complète réservée au serveur interne.

## Enrichissement et micro-systèmes (24/10/2026)
- Passage sur les 64 sites exploitables (accueil + pages agenda / ateliers / tarifs / contact) → `src/enrichissement.json` : offre, formats/tarifs, publics précis, agenda daté, réseaux, contacts trouvés (ajoutés seulement hors PUBLIC), alertes qualité (sites morts, contacts fictifs, Atelier Bouillon ↔ Au Fil de Soi à vérifier).
- `src/niches.json` : 18 micro-systèmes (famille « Micro-systèmes ») avec premier pas et sources ; fusionnés par convergences.py. Dans le score d'acupuncture, une niche compte 1 (une grande convergence 2).
- Fiche : blocs « Ce qu'elle propose », « À venir » (dates passées masquées automatiquement), réseaux, « À vérifier ». Accueil : agenda commun, micro-systèmes puis grandes convergences.
- 36 structures sans site exploitable (Instagram seul ou rien) : à compléter en entretien.

## Renommage (25/10/2026)
- « Points d'acupuncture » → **Connecteurs** dans toute l'interface (accueil, fiches, légende, intro, À propos), en écho à l'énergie du So Watt. Les noms techniques (`acu`, `ACU_NOTES`) sont inchangés.
- Audit mobile UX/UI du 25/10 : cibles tactiles ≥ 34–44 px, intro qui tient en paysage, balayage, recherche qui liste les structures, panneau « pour vous » ouvert en fin d'intro, notes internes masquées en public.
- Recherche (25/10) : mots séparés (ET, puis « approchants » si rien), accents/majuscules ignorés, fautes tolérées (Levenshtein 1–2 selon longueur), ~55 groupes de synonymes (enfant/gamin, poterie/céramique, mois…), champs pondérés (nom, personnes, métier, thèmes, publics, offre, descriptif, bureau/étage, agenda, convergences), classement par pertinence avec le champ qui a répondu affiché à droite, seuil de bruit à 30 % du meilleur score. Code : bloc « Recherche » d'app.mjs (SYN_GROUPS à enrichir librement).
- Logo (25/10) : mot-symbole officiel « SO WATT ! » orange (#EC644B) récupéré sur sowatt-tierslieu.fr (orange-1.png), dans `src/brand/` ; en-tête = logo + « occupant·e·s » ; favicon et icône d'écran d'accueil = l'éclair « ! ». Inlinés en data URI par build.py (marche aussi dans la version autonome).
- Couleur (25/10) : accent du site aligné sur l'orange du logo, --accent #EC644B, --accent-soft #FCE9E5, --accent-ink #B4432F (5,5:1 sur blanc, 4,7:1 sur fond doux), y compris 3D et anneaux des connecteurs.
- Panneau de gauche refondu (25/10) : titres de section en Outfit 21 px soulignés, texte à 14,5 px, plus de libellés en capitales monospace. Accueil = « Qui fait quoi au So Watt » + À venir (cartes date / titre / structure / lieu, « Au So Watt » mis en avant, 4 visibles puis « Voir les N autres ») + L'écosystème (cartes des 18 micro-systèmes avec pile de logos) + Les connecteurs (tuiles logo + rang) + Grandes convergences (rangées par famille). « Comment lire cette carte » déplacé dans une aide (bouton « ? » de l'en-tête, boîte de dialogue). Panneau « pour vous » et fiches dans le même style. Boutons pleins en orange foncé #B4432F (contraste AA).
- 3D (25/10) : sélecteur « Vue » dans la barre (étages éclatés par défaut · depuis la rue · aérienne · plan vu du dessus, nord en haut) ; remplace les boutons Éclaté/Compact ; LIEU.setPreset(), le bouton maison revient au préréglage choisi.
