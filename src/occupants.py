# -*- coding: utf-8 -*-
"""Source de vérité des occupant·e·s du Sowatt.

Fusionne :
- le tableur "LISTE OCCUPANT.E.S" (onglet Actuels, export du 23/10/2026) → work/sowatt_raw.json
- la page https://sowatt-tierslieu.fr/les-occupant-e-s/ (descriptions, liens)
- les plans A3 (Canva, MAJ 20/10/2026) → étage réel + position (x,y) en points PDF sur la page de l'étage

Produit occupants.json (liste) via build.py.

Catégories (cat)  : couleur des points.
Thèmes (themes)   : taxonomie transversale (plusieurs par structure) → affinités + filtres.
Publics (publics) : à qui s'adresse l'activité.
"""
import json, re, os, unicodedata

ROOT = os.path.dirname(os.path.abspath(__file__))

CATS = {
    'ART':       'Artistes',
    'ATELIER':   'Ateliers créatifs',
    'ARTISANAT': 'Artisanat & création',
    'ASSO':      'Associations & collectifs',
    'COM':       'Communication & image',
    'SERV':      'Services aux entreprises',
    'BIENETRE':  'Bien-être & soin',
    'BAT':       'Bâtiment & immobilier',
    'RESTO':     'Restauration & alimentation',
}
THEMES = [
    'Arts visuels', 'Céramique, bijoux & matières', 'Mode, textile & upcycling', 'Image, vidéo & son',
    'Spectacle vivant & événementiel', 'Ateliers & transmission', 'Enfance & familles',
    'Transition écologique & sociale', 'Santé & bien-être', 'Beauté & soin', 'Communication & marque',
    'Numérique & IA', 'RH, organisation & gouvernance', 'Bâtiment, espace & immobilier',
    'Finance, assurance & gestion', 'Alimentation & restauration', 'Logistique, sécurité & mobilité',
]
PUBLICS = ['Particuliers', 'Entreprises', 'Enfants & familles', 'Collectivités & associations', 'Artistes & créatifs', 'Scolaires']
FLOORS = {'SS': 'Sous-sol', 'RDC': 'Rez-de-chaussée', 'R1': '1er étage', 'R2': '2e étage', 'R3': '3e étage', 'B': 'Bâtiment B', 'COUR': 'Cour extérieure'}
PLAN_PAGE = {'RDC': 0, 'R1': 1, 'R2': 2, 'R3': 3}

T = {t: t for t in THEMES}
AV, CER, MODE, IMG, SPEC, ATL, ENF, TRANS, SANTE, BEAU, COMM, NUM, RH, BATI, FIN, ALIM, LOG = THEMES
PART, ENT, FAM, COLL, CREA, SCOL = PUBLICS

# (raw sheet name | None, id, display name, cat, themes, publics, floor, room, plan pos (x,y) or None, overrides{})
# pos = coordonnées en points PDF sur la page de l'étage (842 × 1190), issues des logos / libellés du plan.
ROWS = [
    ('AEG Patrimoine', 'aeg', 'AEG Patrimoine', 'SERV', [FIN], [PART, ENT], 'R2', '236', (353, 731), {}),
    ('Agence Buddy', 'buddy', 'Agence Buddy', 'COM', [COMM, NUM], [ENT], 'R2', '213', (485, 273), {}),
    ('aKynoxe', 'akynoxe', 'aKynoxe', 'SERV', [RH, ATL], [ENT], 'R1', '133', (323, 850), {'website': 'https://www.linkedin.com/company/akynoxe'}),
    ('Albane Urbin', 'urbin', 'Albane Urbin', 'BIENETRE', [SANTE], [PART], 'RDC', '052', (413, 1025), {'desc': 'Praticienne énergétique.'}),
    ('Alexis Nivelle', 'nivelle', 'Alexis Nivelle', 'ART', [AV], [PART, ENT], 'R2', '203', (414, 250), {'website': 'https://alexisnivelle.fr'}),
    ('AMV', 'amv', 'AMV', 'BAT', [BATI], [PART, ENT], 'RDC', '005-006-007', (452, 289), {}),
    ('Analeïna', 'analeina', 'Analeïna (Adelaïde François)', 'ART', [AV], [PART], 'R1', '112', (486, 198), {}),
    ('Antego', 'antego', 'Antego', 'SERV', [RH, TRANS], [ENT, COLL], 'R2', '235', (340, 794), {}),
    ('Aprobio', 'aprobio', 'A PRO BIO', 'ASSO', [ALIM, TRANS], [COLL, ENT, PART], 'R1', 'aile gauche (165)', (210, 1040), {}),
    ('Aqualunia', 'aqualunia', 'Aqualunia', 'ARTISANAT', [CER, SANTE], [PART], 'RDC', '053', (449, 1023), {'website': 'https://aqualunia.com'}),
    ('Ar(tk)ive', 'artkive', 'Ar(tk)ive', 'ARTISANAT', [MODE, TRANS], [PART], 'R3', '313', (487, 266), {'website': 'https://artkive.shop'}),
    ('Artorium', 'artorium', 'Artorium', 'ATELIER', [ATL, ENF, AV], [FAM, SCOL], 'R2', '215', (467, 387), {}),
    ('Assure&moi', 'assureetmoi', 'Assure & moi', 'SERV', [FIN], [PART, ENT], 'R1', '134', (333, 804), {'website': 'https://assureetmoi.com'}),
    ('Astreos Security', 'astreos', 'Astreos Security', 'SERV', [LOG, SPEC], [ENT], 'R2', '274', (780, 1024), {}),
    ('Atelier Bouillon', 'bouillon', 'Atelier Bouillon', 'ART', [AV, IMG, CER], [PART, CREA], 'R1', '106-107-108', (374, 401), {'website': 'https://tierslieu-aufildesoi.org'}),
    ('Atelier Helcou', 'helcou', 'Atelier Helcou', 'ATELIER', [MODE, ATL], [PART, FAM], 'R2', '212', (500, 213), {'website': 'https://atelierhelcou.fr'}),
    ('Ateliers DIY', 'diy', 'Ateliers DIY', 'ATELIER', [ATL, TRANS, ENF], [PART, ENT, FAM], 'R2', '217', (444, 445), {}),
    ('Bac Prod', 'bacprod', 'BAC Prod', 'COM', [IMG, COMM], [ENT], 'R1', '103', (414, 241), {}),
    ('Bilik', 'bilik', 'Bilik', 'BAT', [BATI, NUM], [PART], 'R2', '237', (364, 686), {'website': 'https://bilik.fr'}),
    ("Bon'Allure", 'bonallure', "Bon'Allure", 'SERV', [LOG, TRANS], [ENT], 'COUR', 'cour extérieure', None, {}),
    ('Brick&Num', 'bricknum', 'Brick&Num', 'ATELIER', [ENF, ATL, NUM], [FAM, SCOL], 'R3', '3e étage (plan) · 204 au tableur', (368, 444), {}),
    ('Cabinet Parez', 'parez', 'Cabinet Parez', 'SERV', [FIN], [ENT], 'RDC', '064', (561, 1036), {'website': 'https://cabinet-parez.fr'}),
    ('Café n°3 / Litha espresso', 'litha', 'Café n°3 · Litha Espresso', 'RESTO', [ALIM], [ENT], 'RDC', '069', (407, 1094), {}),
    ('Capstone', 'capstone', 'Capstone', 'BAT', [BATI], [ENT], 'RDC', '014', (355, 1024), {}),
    ('Casa Mia Créations', 'casamia', 'Casa Mia Créations', 'ATELIER', [CER, ATL, ALIM], [PART, FAM], 'R3', '302 + 312', (462, 212), {'website': 'https://www.instagram.com/casamia.creations'}),
    ('Clément Corman', 'corman', 'Clément Corman', 'ART', [AV], [PART, ENT], 'R2', '202', (429, 194), {'website': 'https://clement-corman.fr'}),
    ('Coal Line Entertainement', 'coalline', 'Coal Line Entertainment', 'ASSO', [IMG, SPEC], [CREA], 'R1', '172', (757, 961), {'website': 'https://www.instagram.com/coallineentertainment'}),
    ('Collectif errances', 'errances', 'Collectif errances', 'ASSO', [SPEC, ENF], [FAM, COLL], 'R1', '136', (354, 720), {}),
    ('Coralie Hamaide', 'hamaide', 'Coralie Hamaide', 'ART', [AV, ATL, SANTE, CER], [PART, SCOL, COLL], 'R3', '315', (424, 531), {}),
    ("Craie 'N Co", 'craienco', "Craie'n'Co", 'ATELIER', [ATL, ENF], [FAM], 'RDC', '049', (114, 920), {'website': 'https://craienco.com'}),
    ('Cyremia', 'cyremia', 'Cyremia', 'SERV', [NUM, ATL], [ENT], 'R1', '125', (326, 752), {}),
    ('Edouard Rowehy', 'rowehy', 'Edouard Rowehy', 'ART', [AV], [PART, ENT], 'R2', '218', (435, 495), {'website': 'https://ed-ou-art.com'}),
    ('Ema Make-up Artist', 'ema', 'Ema Make-up Artist', 'ARTISANAT', [BEAU, SPEC, ATL], [CREA, PART], 'R3', '317', (443, 454), {}),
    ('Enluminance', 'enluminance', 'Enluminance (Eric Gouwy)', 'ART', [SPEC, ATL], [PART, COLL], 'SS', '011', None, {}),
    ('EXOCER', 'exocer', 'Exocer', 'SERV', [NUM, LOG], [ENT], 'RDC', '001 + 002', (517, 150), {'website': 'https://exocer.com'}),
    ('Family Forme', 'familyforme', 'Family Forme', 'ASSO', [SANTE, SPEC, ENF], [FAM, PART], 'B', 'bâtiment B', None, {}),
    ('Fatima Dahmani', 'dahmani', 'Fatima Dahmani', 'ARTISANAT', [CER, NUM], [PART, ENT], 'R2', '244', (80, 1010), {'website': 'https://fatimadahmani.com'}),
    ('Florence Wierre', 'wierre', 'Florence Wierre', 'ART', [AV, ATL], [PART, FAM], 'R2', '211', (511, 164), {'website': 'https://www.instagram.com/flo_wierre'}),
    ('Giselle et Rose', 'giselleetrose', 'Giselle et Rose', 'ART', [AV, ENF], [FAM, ENT], 'R3', '315', (465, 360), {'website': 'https://giselleetrose.com'}),
    ('Harch', 'harch', 'Harch', 'SERV', [RH, BATI], [ENT], 'R1', '126', (298, 704), {'website': 'https://harch-rh.fr'}),
    ('Hibou Rouge', 'hibourouge', 'Hibou Rouge', 'BAT', [BATI], [ENT, COLL], 'R2', '275', (765, 1070), {}),
    ('Holy Studio', 'holy', 'Holy Studio', 'COM', [IMG, COMM], [ENT], 'R2', '202', (522, 120), {}),
    ('IGWAP', 'igwap', 'IGWAP', 'ASSO', [IMG, SPEC], [PART], 'RDC', 'salle vidéo (sous-sol au tableur)', (214, 900), {'website': 'https://igwap.fr'}),
    ('Intermède', 'intermede', 'Intermède', 'ASSO', [TRANS, BATI, RH], [ENT, COLL], 'RDC', '014', (542, 1023), {'website': 'https://intermede.co'}),
    ('Jérôme Boccia', 'boccia', 'Jérôme Boccia', 'ART', [AV], [PART], 'R2', '205', (396, 330), {'website': 'https://jeromeboccia.net', 'desc': 'Artiste (bureau 205). Pas de descriptif dans le tableur.', 'approx': True}),
    ('Joonailz', 'joonailz', 'Joonailz', 'ARTISANAT', [BEAU, AV], [PART], 'R1', '135', (342, 761), {'website': 'https://www.instagram.com/joonailz'}),
    ('K-pro services', 'kpro', 'K-pro services', 'SERV', [LOG], [ENT], 'SS', '015', None, {}),
    ('Kino Ciné', 'kino', 'Kino Ciné', 'ASSO', [IMG, SPEC], [PART, SCOL], 'RDC', '067', (543, 1093), {'website': 'https://kino-cine.com', 'desc': "Association qui gère le cinéma Art & Essai Kino, au sein de l'université de Lille (campus Pont-de-Bois)."}),
    ('KNAPFLA', 'knapfla', 'Knapfla', 'ART', [AV, ATL], [PART, FAM], 'R1', '117', (443, 437), {}),
    ("L'atelier Sunday par Sunday Surfers", 'sunday', "L'atelier Sunday · Sunday Surfers", 'ARTISANAT', [MODE, TRANS, ATL], [PART, ENT], 'R2', '207', (366, 440), {'website': 'https://sundaysurfers.fr'}),
    ('La Consignerie', 'consignerie', 'La Consignerie', 'RESTO', [ALIM, TRANS, SPEC], [ENT], 'RDC', '059', (695, 990), {'website': 'https://consignerie.com'}),
    ('La Fabric', 'lafabric', 'La Fabric', 'COM', [IMG, COMM], [ENT], 'R3', '3e étage', (521, 1046), {}),
    ('La Foule', 'lafoule', 'La Foule', 'COM', [COMM], [ENT], 'R2', '219', (421, 545), {'website': 'https://lafoule.com'}),
    ('La petite Madeleine', 'madeleine', 'La petite Madeleine', 'ASSO', [TRANS, ATL, MODE], [PART], 'SS', '013', None, {}),
    ('La Seconde', 'laseconde', 'La Seconde', 'ASSO', [TRANS, NUM], [PART, ENT], 'RDC', '047', (121, 1094), {'website': 'https://la-seconde.fr'}),
    ('Laurent Verhaege', 'verhaege', 'Laurent Verhaege', 'ART', [AV, ATL], [SCOL, COLL, PART], 'R3', '308', (360, 490), {}),
    ('Leflower Studio', 'leflower', 'Leflower Studio', 'COM', [IMG, NUM, SPEC], [ENT, COLL], 'R1', '127', (308, 660), {'website': 'https://leflower-studio.fr'}),
    ('Leidy Jalkbarrios', 'jalk', 'Leidy Jalk-Barrios', 'ART', [AV, ATL], [PART, COLL], 'R1', '112', (514, 198), {}),
    ('Les Gus', 'lesgus', 'Les Gus', 'ARTISANAT', [MODE], [PART], 'R1', '123', (267, 838), {'website': 'https://lesgus.com'}),
    ('Licols And Co', 'licols', 'Licols And Co', 'ARTISANAT', [MODE], [PART], 'R1', '129', (332, 571), {'website': 'https://licolsandco.com'}),
    ('LIKE A FREE', 'likeafree', 'Like a Free', 'COM', [COMM, TRANS], [ENT], 'R3', '3e étage', (615, 941), {'website': 'https://likeafree.fr'}),
    ('Luis Meyer', 'meyer', 'Luis Meyer', 'ART', [AV, ATL], [PART, SCOL], 'R1', '112', (500, 214), {}),
    ("Maill'Art", 'maillart', "Maill'Art", 'ART', [AV, ATL], [PART, CREA], 'R1', '111 + 115 + 119', (436, 332), {}),
    ('Maison Selva Maris', 'selvamaris', 'Maison Selva Maris', 'ARTISANAT', [MODE, TRANS], [PART], 'R2', '208', (357, 487), {'website': ''}),
    ('Maranta Couture', 'maranta', 'Maranta Couture', 'ARTISANAT', [MODE], [PART], 'R1', '175', (686, 1058), {'website': 'https://marantacouture.com'}),
    ('Marina Caudron', 'caudron', 'Marina Caudron', 'ART', [IMG, AV], [PART, ENT], 'R1', '104', (426, 185), {'website': 'https://marinacaudron.fr'}),
    ('Mathieu Dauchy', 'dauchy', 'Mathieu Dauchy', 'COM', [SPEC, COMM, IMG], [ENT, COLL, CREA], 'R1', '137', (363, 677), {}),
    ('Maze', 'maze', 'Maze', 'SERV', [ATL, AV], [CREA], 'R2', '227', (305, 693), {}),
    ('Mishou Wigs', 'mishou', 'Mishou Wigs', 'ARTISANAT', [BEAU, SPEC, MODE], [CREA, PART], 'R2', '216', (456, 397), {}),
    ('Natasha Dupont', 'dupont', 'Natasha Dupont · Poëtic Brindilles', 'ART', [AV, ATL, ALIM], [PART, FAM], 'R1', '113', (488, 243),
        {'desc': "Artiste plasticienne. Sous le nom Poëtic Brindilles, ateliers créatifs sur des thèmes variés, associés à la pâtisserie fine de Julie Dillies (sowatt-tierslieu.fr)."}),
    ('Nathalie Coulon', 'coulon', 'Nathalie Coulon', 'ART', [AV], [PART], 'R1', '114', (478, 287), {}),
    ('Nexus', 'nexus', 'Nexus · NSP', 'SERV', [], [ENT], 'RDC', '060', (743, 977), {'desc': "Activité non renseignée (Nexus Synergh Partners d'après le logo du plan)."}),
    ('Nininails', 'nininails', 'Nininails', 'ARTISANAT', [BEAU], [PART], 'R1', '138', (387, 583), {'website': 'https://www.instagram.com/nininails____'}),
    ('Original BIJOUX', 'originalbijoux', 'Original Bijoux', 'ARTISANAT', [CER], [PART], 'R1', '139', (375, 634), {}),
    ('OuiChange Corp', 'ouichange', 'Oui Change Corp', 'ASSO', [TRANS, ATL, RH], [ENT, COLL], 'R1', '155', (491, 999), {}),
    ('Pauline Caenen', 'caenen', 'Pauline Caenen', 'ART', [CER, ATL, SPEC, ENF], [FAM, PART, CREA], 'R3', '3e étage (plan) · 217 au tableur', (523, 119), {'website': 'https://www.instagram.com/pauline.caenen'}),
    ('Plan D', 'pland', 'Plan D', 'BAT', [BATI, NUM], [ENT], 'RDC', '057', (633, 960), {}),
    ('Polaifos', 'polaifos', 'Polaifos', 'COM', [IMG, MODE], [ENT, CREA], 'R3', '313', (569, 278), {}),
    ('RCC Groupe - France Pare-Brise', 'rcc', 'RCC Groupe · France Pare-Brise', 'SERV', [LOG, FIN], [PART, ENT], 'R2', '241-242-243', (115, 1076), {'website': 'https://franceparebrise.fr'}),
    ('REFILL Atelier', 'refill', 'Refill Atelier', 'ARTISANAT', [MODE, TRANS, ATL], [PART], 'RDC', '060', (693, 1072), {'website': 'https://www.instagram.com/refill_atelier'}),
    ('Rita Wagner', 'wagner', 'Rita Wagner', 'ART', [AV], [PART], 'R1', '118', (432, 480), {}),
    ('Romain Eugène', 'eugene', 'Romain Eugène', 'ART', [AV, ATL], [PART, FAM], 'R3', '315', (418, 557), {'website': 'https://www.instagram.com/romain_eugene_art'}),
    ('Rosy Le Bars', 'lebars', 'Rosy Le Bars', 'ART', [AV, ATL], [PART, SCOL], 'R1', '104', (400, 297), {}),
    ('Sarl Sens - Les Confidentialistes®', 'confidentialistes', 'Les Confidentialistes', 'BIENETRE', [SANTE, RH], [PART, ENT], 'R2', '221', (247, 940), {}),
    ('Sinode Baba', 'sinode', 'Sinode Baba', 'ASSO', [SPEC, IMG], [PART, ENT], 'R1', '131', (298, 943), {'website': 'https://sinodebaba.fr'}),
    ('Slawa', 'slawa', 'Slawa (Manon Danappe)', 'ART', [AV], [PART], 'R3', '318', (470, 470), {'website': 'https://www.instagram.com/slawa_fr', 'approx': True}),
    ('Sneuf', 'sneuf', 'Sneuf', 'ART', [AV, IMG, COMM], [PART, ENT], 'R1', '105', (391, 336), {}),
    ('Sociétés Opale', 'opale', 'Sociétés Opale', 'ASSO', [RH, TRANS], [ENT, COLL], 'RDC', '047', (118, 1077), {}),
    ('Soluxan', 'soluxan', 'Soluxan', 'SERV', [NUM], [ENT], 'R2', '228', (320, 629), {}),
    ('Sophie Letertre', 'letertre', 'Sophie Letertre', 'BAT', [BATI], [PART, ENT], 'R2', '219', (408, 560), {'approx': True}),
    ('Studio ATK', 'atk', 'Studio ATK', 'ATELIER', [AV, ATL], [PART, FAM], 'R1', '116', (450, 401), {}),
    ('Studio CAD', 'studiocad', 'Studio CAD', 'COM', [NUM, COMM, IMG], [ENT, COLL], 'RDC', '061 + 062', (793, 1034), {}),
    ('Thérapie Analytique', 'therapie', 'Thérapie Analytique', 'BIENETRE', [SANTE], [PART], 'R1', '121', (242, 929), {}),
    ('Think Vitality', 'thinkvitality', 'Think Vitality', 'BIENETRE', [SANTE], [PART], 'R1', '110', (523, 107), {'website': 'https://think-vitality-therapeute.fr'}),
    ('Unas de Bruja', 'unasdebruja', 'Uñas de Bruja', 'ARTISANAT', [BEAU, AV], [PART], 'R1', '132', (311, 896), {'website': 'https://www.instagram.com/unas.de.bruja'}),
    ('Vingt-deux de Cœur', 'vingtdeux', 'Vingt-deux de Cœur', 'COM', [COMM, RH], [ENT], 'R1', '124', (276, 796), {}),
    ('Vivons en Forme', 'vif', 'Vivons en Forme', 'ASSO', [SANTE, ENF, ALIM, TRANS], [COLL], 'RDC', '049 + 044', (145, 1020), {'website': 'https://vivonsenforme.org'}),
    ('Will RH', 'willrh', 'Will RH', 'SERV', [RH], [ENT], 'R3', '341', (747, 1009), {'website': 'https://will-rh.com'}),
    # Présents sur le site ou le plan, absents du tableur
    (None, 'zeste', "Zeste d'Amande", 'BIENETRE', [BEAU], [PART], 'R1', '170 (plan)', (770, 1013),
        {'desc': 'Prothésiste ongulaire (sowatt-tierslieu.fr).', 'website': 'https://www.instagram.com/zestedamande_bar_a_ongles', 'source': 'site + plan'}),
    (None, 'lemahieu', 'Henri Lemahieu', 'ART', [AV], [PART], 'R2', 'à côté du 203 (plan)', (402, 298),
        {'desc': 'Présent sur le plan du 20 octobre 2026, pas encore dans le tableur ni sur le site.', 'source': 'plan'}),
]

# Relations déclarées (hors affinités calculées) : (a, b, libellé)
RELATIONS = [
    ('capstone', 'intermede', 'propriétaire du site / coopérative gestionnaire'),
    ('maillart', 'maze', "formation d'artistes plasticiens"),
    ('dupont', 'atk', 'ateliers créatifs voisins'),
    ('polaifos', 'lesgus', 'présentés ensemble sur le site Sowatt'),
    ('litha', 'consignerie', 'café + traiteur : offre événementielle du RDC'),
    ('refill', 'madeleine', 'réparation textile : atelier + repair-café'),
    ('laseconde', 'madeleine', 'réparation : objets tech + repair-café'),
    ('ouichange', 'intermede', 'transformation écologique et sociale'),
    ('studiocad', 'intermede', 'site web du tiers-lieu'),
]


def slug(s):
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode()
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')


def clean_phone(p):
    if not p:
        return ''
    p = str(p).strip()
    if re.fullmatch(r'\d+\.0', p):
        p = p[:-2]
    d = re.sub(r'\D', '', p)
    if len(d) == 9:
        d = '0' + d
    if len(d) == 10:
        return ' '.join(d[i:i + 2] for i in range(0, 10, 2))
    return p


def clean_url(u):
    if not u:
        return ''
    u = u.strip()
    if u.lower() in ('en cours',) or ' ' in u and not u.startswith('http'):
        return ''
    u = u.split('  -  ')[0].split(' - ')[0].strip()
    if not re.match(r'https?://', u):
        if '.' not in u:
            return ''
        u = 'https://' + u
    return u


def build():
    raw = json.load(open(os.path.join(ROOT, 'sowatt_raw.json')))['Actuels']
    by_name = {r['Structure'].strip(): r for r in raw}
    out = []
    for rawname, oid, name, cat, themes, publics, floor, room, pos, ov in ROWS:
        r = by_name.get(rawname, {}) if rawname else {}
        if rawname and not r:
            raise SystemExit('introuvable dans le tableur: ' + rawname)
        people = re.sub(r'\s*\n\s*', ', ', (r.get('Nom') or '').strip())
        people = re.sub(r'\s{2,}', ' ', people)
        desc = (r.get('Descriptif') or '').strip() or ov.get('desc', '')
        if ov.get('desc') and r.get('Descriptif') and ov['desc'] not in desc:
            desc = ov['desc']
        mail = (r.get('Mail') or '').strip()
        if ov.get('mail'):
            mail = ov['mail']
        mails = [m.strip() for m in re.split(r'\s*/\s*|\s*;\s*|\n', mail) if '@' in m]
        o = dict(
            id=oid, name=name, cat=cat, catLabel=CATS[cat], themes=themes, publics=publics,
            people=people, desc=desc,
            floor=floor, floorLabel=FLOORS[floor], room=room,
            page=PLAN_PAGE.get(floor), px=pos[0] if pos else None, py=pos[1] if pos else None,
            approx=bool(ov.get('approx')),
            website=clean_url(ov.get('website', r.get('Site internet', ''))),
            mails=mails, phone=clean_phone(r.get('Téléphone', '')),
            source=ov.get('source', 'tableur' + (' + plan' if pos else '')),
            logo=None,
        )
        out.append(o)
    ids = {o['id'] for o in out}
    for a, b, _ in RELATIONS:
        assert a in ids and b in ids, (a, b)
    return out


if __name__ == '__main__':
    data = build()
    json.dump(data, open(os.path.join(ROOT, 'occupants.json'), 'w'), ensure_ascii=False, indent=1)
    print(len(data), 'occupant·e·s')
    from collections import Counter
    print(Counter(o['cat'] for o in data))
    print(Counter(t for o in data for t in o['themes']).most_common())
    print(Counter(o['floor'] for o in data))
    print('sans position:', [o['id'] for o in data if o['px'] is None])
    print('sans site:', len([o for o in data if not o['website']]))
