# Brancher la carte So Watt ! sur le planning des salles

Ce petit script permet à la page « Réserver une salle » de la carte des occupant·e·s de lire le tableur **Réservation des espaces communs** et d'y inscrire les réservations. Le tableur reste la seule référence : les réservations faites à la main continuent de fonctionner comme aujourd'hui.

À faire une fois, par le compte propriétaire du tableur (intermededrive@gmail.com), environ 5 minutes.

## 1. Coller le script

1. Ouvrir le tableur « Réservation des espaces communs ».
2. Menu **Extensions → Apps Script**.
3. Effacer le contenu de `Code.gs`, coller le contenu du fichier `Code.gs` fourni, enregistrer.

## 2. Choisir le code occupant·e

1. Dans Apps Script : **Paramètres du projet** (roue dentée) → **Propriétés du script** → **Ajouter une propriété**.
2. `CODE` = un mot de passe simple à partager aux occupant·e·s (par exemple sur le Slack). Sans lui, personne ne peut écrire dans le tableur depuis la carte.
3. Facultatif : `NOTIFY` = l'adresse à prévenir à chaque réservation (par exemple zoe.ducrocq@intermede.co).

## 3. Déployer

1. **Déployer → Nouveau déploiement** → type **Application Web**.
2. Exécuter en tant que : **moi** · Qui a accès : **Tout le monde**.
3. Autoriser l'accès au tableur quand Google le demande.
4. Copier l'**URL de l'application Web** (elle finit par `/exec`) et l'envoyer à Studio CAD, qui la colle dans la carte.

## Ce que le script fait et ne fait pas

- Il lit les onglets mensuels nommés comme aujourd'hui (« NOVEMBRE 2026 »…), salle par salle, semaine par semaine, matin / après-midi / soir. Créer l'onglet du mois suivant comme d'habitude suffit pour ouvrir les réservations de ce mois.
- Il ne publie **jamais** le texte des cases : la carte ne voit que les horaires occupés, pas qui réserve.
- Une réservation s'écrit dans la case du créneau sous la forme `9h-11h : Structure (Nom) – objet`, à la suite des réservations existantes si les horaires ne se chevauchent pas. Une case sans horaire (« A PRO BIO ») compte comme créneau entier pris.
- Une note est ajoutée sur la case quand l'événement accueille du public extérieur.
- Pour annuler une réservation, il suffit d'effacer la ligne dans le tableur.
