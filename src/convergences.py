# -*- coding: utf-8 -*-
"""Couche "convergences" du Sowatt : là où plusieurs structures de catégories différentes
travaillent une même matière, un même public ou une même chaîne de valeur.

Chaque convergence = un point de rencontre possible (atelier commun, offre groupée, événement,
mutualisation). Les membres sont des ids de occupants.py. Le rôle précise ce que la structure
apporte dans cette convergence.

Les "connecteurs" (ex-points d'acupuncture) sont calculés dans build.py : structures présentes dans le plus de
convergences ET reliant des catégories différentes ; une liste de curations commentées complète le calcul.
"""
import json, os

ROOT = os.path.dirname(os.path.abspath(__file__))

FAMILIES = {
    'faire':   {'label': 'Faire ensemble',       'icon': '✦', 'desc': 'Des matières et des savoir-faire qui se répondent : textile, céramique, image, son.'},
    'public':  {'label': 'Mêmes publics',        'icon': '◉', 'desc': 'Des structures qui s’adressent aux mêmes personnes : familles, entreprises, artistes.'},
    'transition': {'label': 'Transition',        'icon': '❋', 'desc': 'Réparer, réemployer, transformer les organisations : le fil rouge du tiers-lieu.'},
    'lieu':    {'label': 'Vie du lieu',          'icon': '⌂', 'desc': 'Ce qui fait tourner le Sowatt au quotidien et ce qui pourrait y naître.'},
}

CONV = [
    dict(id='reparer', family='transition', title='Réparer, réemployer, prolonger',
         summary="Textile, objets tech, vêtements : quatre structures réparent ou prolongent la vie des choses, trois autres fabriquent à partir de l'existant.",
         potential="Un « samedi de la réparation » commun au Foyer (repair-café + retouches + tech), une boutique-dépôt de l'upcycling au RDC, une communication unique « Sowatt répare ».",
         members=[('madeleine', 'repair-café'), ('refill', 'retouches, remaillage'), ('laseconde', 'objets tech'), ('sunday', 'upcycling, sérigraphie'),
                  ('artkive', 'denim upcyclé'), ('selvamaris', 'vestiaire conscient'), ('diy', 'zéro déchet'), ('bonallure', 'livraison écologique')]),
    dict(id='transfo', family='transition', title='Transformer les organisations',
         summary="Gouvernance horizontale, transition écologique, RH, coaching systémique : une offre complète d'accompagnement des entreprises et collectivités, dispersée sur trois étages.",
         potential="Un collectif « transition des organisations » avec une porte d'entrée unique, des ateliers découverte ouverts aux entreprises du Sowatt, un programme commun avec Intermède.",
         members=[('ouichange', 'animation de la transformation'), ('opale', 'gouvernance'), ('antego', 'stratégie RH & transitions'), ('akynoxe', 'coaching systémique'),
                  ('intermede', 'coopérative du lieu'), ('aprobio', 'alimentation durable'), ('vif', 'santé publique'), ('confidentialistes', 'écoute en entreprise'), ('likeafree', 'rapports ESG')]),
    dict(id='image', family='faire', title='Image, son & production',
         summary="Photo, vidéo, drone, motion, scénographie numérique, studio son, studio d'enregistrement, cinéma : une chaîne de production audiovisuelle complète sur place.",
         potential="Un plateau partagé (lumière, fond, son), des productions croisées pour les occupant·e·s (portraits, teasers, podcasts), une projection annuelle au Kino.",
         members=[('bacprod', 'photo, vidéo, drone'), ('holy', 'vidéo, motion'), ('polaifos', 'studio photo'), ('caudron', 'photographie'), ('leflower', 'scénographie numérique'),
                  ('lafabric', 'identités sonores, podcasts'), ('coalline', "studio d'enregistrement"), ('studiocad', 'production digitale'), ('sneuf', 'photo, graphisme'),
                  ('kino', 'cinéma'), ('sinode', 'audiovisuel, jeux'), ('igwap', 'musique'), ('dauchy', 'podcasts')]),
    dict(id='marque', family='faire', title='Communication & marque',
         summary="Social media, conseil, branding, design éditorial, rédaction, sites et production : les briques d'une agence complète, réparties entre sept structures.",
         potential="Réponses groupées à des appels d'offres, une offre « lancement de marque » pour les créateurs du lieu (artisans, artistes), un annuaire de compétences.",
         members=[('buddy', 'social media'), ('lafoule', 'conseil'), ('likeafree', 'branding, éditorial'), ('vingtdeux', 'stratégie & visuel'), ('studiocad', 'digital'),
                  ('dauchy', 'rédaction, animation'), ('holy', 'motion'), ('bacprod', 'image'), ('sneuf', 'graphisme, illustration'), ('maze', 'formation')]),
    dict(id='scene', family='faire', title='Scène, récit & événement',
         summary="Conte, marionnettes, cirque, musique, murder parties, maquillage FX, perruques, accessoires : de quoi monter un spectacle de A à Z sans sortir du bâtiment.",
         potential="Une création collective annuelle, un pôle « arts de la scène » visible, des prestations événementielles groupées pour les entreprises.",
         members=[('errances', 'conte, marionnettes'), ('familyforme', 'cirque, danse'), ('igwap', 'musiciens'), ('coalline', 'musique'), ('lafabric', 'musique originale'),
                  ('sinode', 'murder parties'), ('ema', 'maquillage FX'), ('mishou', 'perruques'), ('caenen', 'accessoires de scène'), ('dauchy', 'écriture, animation'),
                  ('enluminance', 'parole, éducation populaire'), ('kino', 'projections'), ('leflower', 'installations visuelles'), ('consignerie', 'traiteur événementiel'), ('astreos', 'sécurité événementielle')]),
    dict(id='enfance', family='public', title='Enfance, familles & pédagogie créative',
         summary="LEGO, numérique, art-science-philo, céramique, aquarelle, couture, cirque, repair-café : une quinzaine d'ateliers pour enfants et familles, sans programmation commune.",
         potential="Un programme « mercredis du Sowatt » et des stages vacances mutualisés, un partenariat écoles / centres sociaux porté ensemble, une billetterie commune.",
         members=[('bricknum', 'LEGO & numérique'), ('craienco', 'moments créatifs'), ('artorium', 'art, science, philo'), ('familyforme', 'cirque, danse'), ('giselleetrose', 'illustration jeunesse'),
                  ('caenen', 'céramique enfants'), ('diy', 'DIY zéro déchet'), ('wierre', 'aquarelle'), ('atk', 'aquarelle'), ('helcou', 'couture'), ('verhaege', 'interventions scolaires'),
                  ('knapfla', 'interventions artistiques'), ('hamaide', 'pratiques artistiques'), ('vif', 'prévention santé'), ('errances', 'spectacles jeune public'), ('casamia', 'goûters céramique'), ('dupont', 'ateliers Poëtic Brindilles')]),
    dict(id='textile', family='faire', title='Mode, textile & accessoires',
         summary="Couture, retouches, sérigraphie, denim, sous-vêtements, accessoires, bijoux, perruques : un pôle mode-textile de fait, du vêtement à la photo de mode.",
         potential="Un défilé / marché des créateurs du Sowatt, un atelier machines partagé, des shootings communs avec les photographes du lieu.",
         members=[('helcou', 'couture, broderie'), ('refill', 'retouches'), ('sunday', 'sérigraphie, upcycling'), ('selvamaris', 'vestiaire'), ('maranta', 'accessoires tissu'),
                  ('lesgus', 'sous-vêtements'), ('artkive', 'denim'), ('licols', 'corderie'), ('mishou', 'perruques'), ('dahmani', 'bijoux 3D'), ('originalbijoux', 'joaillerie'),
                  ('aqualunia', 'bijoux pierres'), ('polaifos', 'photo mode'), ('madeleine', 'ateliers couture')]),
    dict(id='beaute', family='public', title='Beauté, nail art & arts du corps',
         summary="Quatre nail artists, une maquilleuse FX et une perruquière : le corps comme support de création, à la frontière de l'artisanat et de l'art.",
         potential="Un bar à ongles / studio beauté partagé avec vitrine commune, des collaborations avec les photographes et artistes du lieu, des formations croisées.",
         members=[('joonailz', 'nail art'), ('nininails', 'nail art'), ('unasdebruja', 'nail art'), ('zeste', 'prothésie ongulaire'), ('ema', 'maquillage'), ('mishou', 'perruques'), ('aqualunia', 'bien-être')]),
    dict(id='sante', family='public', title='Santé, corps & bien-être',
         summary="Thérapies par la parole, naturopathie, énergétique, art-thérapie, sport-santé, prévention : un parcours bien-être complet, du cabinet à la collectivité.",
         potential="Une « maison du bien-être » lisible au sein du Sowatt, des ateliers santé pour les occupant·e·s, une offre QVT groupée pour les entreprises du lieu.",
         members=[('thinkvitality', 'naturopathie, MTC'), ('confidentialistes', 'psychopratique'), ('therapie', 'thérapie analytique'), ('urbin', 'énergétique'),
                  ('familyforme', 'sport-santé'), ('vif', 'prévention'), ('hamaide', 'art-thérapie'), ('akynoxe', 'coaching'), ('exocer', 'prévention TMS')]),
    dict(id='batiment', family='faire', title='Bâtiment, espace & immobilier',
         summary="Propriétaire, gestionnaire, rénovation, architecture intérieure, design d'intérieur, relevé 3D, annuaire d'artisans, recrutement BTP : toute la chaîne de l'espace bâti.",
         potential="Un groupe projet pour l'évolution du site lui-même (Foyer, terrasse, signalétique), une offre « aménagement » pour les occupant·e·s, des chantiers démonstrateurs.",
         members=[('capstone', 'foncière'), ('intermede', 'gestion du lieu'), ('amv', 'rénovation'), ('hibourouge', 'architecture ERP'), ('letertre', "design d'intérieur"),
                  ('pland', 'dessin, relevé 3D'), ('bilik', "annuaire d'artisans"), ('harch', 'recrutement BTP'), ('exocer', 'manutention')]),
    dict(id='rh', family='public', title='RH, recrutement & accompagnement',
         summary="Recrutement, stratégie RH, coaching, gouvernance, écoute : six structures autour des mêmes DRH et dirigeants.",
         potential="Un cycle de petits-déjeuners RH co-animés, une offre « transition RH » combinant recrutement, organisation et accompagnement humain.",
         members=[('antego', 'stratégie RH'), ('willrh', 'recrutement'), ('harch', 'recrutement BTP'), ('akynoxe', 'coaching'), ('opale', 'gouvernance'), ('ouichange', 'animation'), ('confidentialistes', 'écoute'), ('vingtdeux', 'stratégie')]),
    dict(id='numerique', family='faire', title='Numérique, IA & innovation',
         summary="Adoption de l'IA, ESN, production digitale, scénographie interactive, 3D, exosquelettes, réemploi tech : le numérique sous toutes ses formes, du conseil à l'objet.",
         potential="Des ateliers IA / numérique pour les artistes et artisans du lieu, un fablab léger (3D, prototypage) adossé à Plan D et Fatima Dahmani, une veille partagée.",
         members=[('cyremia', 'IA'), ('soluxan', 'ESN'), ('studiocad', 'digital'), ('leflower', 'interactif'), ('bricknum', 'numérique ludique'), ('exocer', 'robotique'),
                  ('pland', '3D'), ('dahmani', 'conception 3D'), ('laseconde', 'réemploi tech'), ('bilik', 'plateforme')]),
    dict(id='finance', family='public', title='Assurance, patrimoine & gestion',
         summary="Courtage, gestion de patrimoine, expertise comptable, vitrage auto agréé assurances : les services « de confiance » dont tous les occupant·e·s ont besoin.",
         potential="Des permanences conseil pour les créateurs du lieu (statuts, assurance pro, compta), un guide « s'installer au Sowatt ».",
         members=[('assureetmoi', 'assurance'), ('aeg', 'patrimoine'), ('parez', 'comptabilité'), ('rcc', 'vitrage, assurances'), ('nexus', 'à préciser')]),
    dict(id='ateliers-art', family='faire', title="Collectif d'ateliers d'artistes",
         summary="Vingt-cinq artistes plasticien·ne·s, deux collectifs, une organisation de formation aux arts visuels : la plus grande communauté du lieu, surtout au 1er étage.",
         potential="Portes ouvertes des ateliers, une résidence croisée avec les communicants et artisans, un parcours de formation / professionnalisation avec Maze, une galerie au Foyer.",
         members=[('maillart', 'collectif'), ('bouillon', 'collectif'), ('maze', 'formation'), ('nivelle', ''), ('rowehy', ''), ('knapfla', ''), ('caudron', ''), ('dupont', ''),
                  ('coulon', ''), ('corman', ''), ('wagner', ''), ('lebars', ''), ('sneuf', ''), ('hamaide', ''), ('eugene', ''), ('analeina', ''), ('jalk', ''), ('meyer', ''),
                  ('verhaege', ''), ('boccia', ''), ('slawa', ''), ('wierre', ''), ('caenen', ''), ('giselleetrose', ''), ('lemahieu', ''), ('enluminance', ''), ('atk', 'ateliers')]),
    dict(id='table', family='lieu', title='Table, café & convivialité',
         summary="Café, traiteur engagé, alimentation durable, goûters céramique, pâtisserie fine : la table comme lien quotidien du lieu.",
         potential="Une cantine / café du Foyer tournante, des événements « table ouverte » mensuels, un marché alimentaire avec A PRO BIO.",
         members=[('litha', 'café'), ('consignerie', 'traiteur'), ('aprobio', 'alimentation durable'), ('casamia', 'goûters, apéros'), ('dupont', 'pâtisserie fine'), ('diy', 'cosmétique maison'), ('vif', 'nutrition')]),
    dict(id='faire-tourner', family='lieu', title='Faire tourner le lieu',
         summary="Propriétaire, gestionnaire, site web, livraison, stockage, sécurité, café : les fonctions support du Sowatt, aujourd'hui assurées par des occupant·e·s.",
         potential="Formaliser une « équipe du lieu » (conciergerie, logistique, communication) en s'appuyant sur les structures déjà présentes.",
         members=[('capstone', 'propriétaire'), ('intermede', 'gestion'), ('studiocad', 'site web'), ('bonallure', 'livraisons'), ('kpro', 'stockage'), ('astreos', 'sécurité'), ('litha', 'machines à café'), ('consignerie', 'événements')]),
]

# Curations : pourquoi ces structures sont des connecteurs (en plus du score calculé)
ACU_NOTES = {
    'intermede': "Gestionnaire du lieu : seul acteur en contact avec tout le monde. Tout programme transversal passe par là.",
    'maze': "Organisme de formation aux arts visuels au milieu de 25 artistes : le levier de professionnalisation le plus évident du lieu.",
    'studiocad': "Digital + communication + image : fait le pont entre les communicants, les producteurs d'image et le numérique, et réalise le site du lieu.",
    'dauchy': "Rédacteur, podcasteur, animateur : relie spectacle vivant, communication et culture ; un animateur naturel des rencontres du lieu.",
    'ouichange': "30 animateur·rice·s de la transformation écologique et sociale : la méthode pour faire travailler ensemble les autres convergences.",
    'leflower': "Scénographie numérique : point de contact entre artistes, producteurs d'image, événementiel et numérique.",
    'hamaide': "Artiste, art-thérapeute, formatrice : à la jonction des arts plastiques, du bien-être et de la transmission.",
    'vif': "Santé publique, enfance, alimentation, collectivités : un relais institutionnel pour les ateliers et le bien-être.",
    'familyforme': "Cirque, danse, sport-santé pour tous les âges : relie enfance, spectacle et bien-être — mais isolé dans le bâtiment B.",
    'consignerie': "Traiteur engagé : convivialité, événementiel et transition dans la même assiette.",
    'refill': "Atelier de retouches et lieu-ressource textile : le point d'entrée naturel d'un pôle réparation + mode.",
    'diy': "Ateliers zéro déchet pour particuliers, familles et entreprises : transition, enfance et transmission à la fois.",
}

if __name__ == '__main__':
    occ = {o['id'] for o in json.load(open(os.path.join(ROOT, 'occupants.json')))}
    for c in CONV:
        for m, _ in c['members']:
            assert m in occ, (c['id'], m)
    for k in ACU_NOTES:
        assert k in occ, k
    # micro-systèmes (niches.json, issus du passage sur les sites des structures, 24/10/2026)
    NICHES = json.load(open(os.path.join(ROOT, 'niches.json')))
    for c in NICHES['convergences']:
        for m in c['members']:
            assert m['id'] in occ, (c['id'], m['id'])
    data = dict(families=dict(FAMILIES, **NICHES['families']), convergences=[dict(c, members=[dict(id=m, role=r) for m, r in c['members']]) for c in CONV] + NICHES['convergences'], notes=ACU_NOTES)
    json.dump(data, open(os.path.join(ROOT, 'convergences.json'), 'w'), ensure_ascii=False, indent=1)
    from collections import Counter
    cnt = Counter(m['id'] for c in data['convergences'] for m in c['members'])
    print(len(data['convergences']), 'convergences (dont', len(NICHES['convergences']), 'micro-systèmes);', len(cnt), 'structures reliées;', 'hors convergence:', sorted(occ - set(cnt)))
    print(cnt.most_common(15))
