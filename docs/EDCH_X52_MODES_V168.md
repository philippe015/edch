# EDCH v1.6.8 — Profils des trois modes X52 Pro

## Objectif

Préparer **trois plans de configuration** pour Logitech X52 Professional H.O.T.A.S. à partir du profil `.binds` effectivement chargé dans EDCH. Les assignations de l'utilisateur, axes, touches, état BGS et autres réglages ne sont pas modifiés.

| Mode physique | Plan proposé | Commandes contrôlées (si présentes dans le profil) |
| --- | --- | --- |
| Mode 1 | Pilotage et navigation | FSD/supercroisière, boost, train, cartes, panneaux, ciblage de navigation |
| Mode 2 | Combat | Tir principal/secondaire, points d'emport, ciblage, contre-mesures, distribution d'énergie |
| Mode 3 | Exploration et BGS | FSS/DSS, scanners, cartes, itinéraires, FSD, gestion d'interface |

**Attention :** le sélecteur physique du X52 Pro et les profils du jeu sont deux mécanismes différents. Les profils `.binds` générés par EDCH ne basculent **pas automatiquement** avec la molette du HOTAS. La commutation à chaud nécessiterait soit des combinaisons de touches/mode vérifiées et reconnues par Elite Dangerous, soit un remappage compatible sous Linux, hors de la portée de cette version. Ne pas confondre cette évolution avec une prise en charge du SST Windows sous Proton.

## Utilisation dans EDCH

1. Lancez EDCH v1.6.8 sur Manjaro/X11 et ouvrez **Commandes → Commandes PRO**.
2. Choisissez le fichier `.binds` source, par exemple `Custom.4.2.binds`.
3. Ouvrez **Profils des trois modes · v1.6.8**. Le module présente les commandes pertinentes effectivement présentes, les affectations existantes et les suggestions prudentes.
4. Cliquez sur **Préparer ce mode** pour transmettre ses recommandations à l'éditeur. Si aucune suggestion sûre n'existe, les commandes existantes restent inchangées : choisissez alors les affectations manuellement avec **P/S**.
5. Après examen, créez **un nouveau** profil EDCHPro dans l'éditeur, puis choisissez-le **manuellement** dans Elite Dangerous. Recommencez pour un autre mode si besoin.
6. Cliquez sur **Enregistrer les 3 fiches en HTML** pour conserver un document autonome, imprimable, sous `Documents/EDCH/rapports` ou dans les téléchargements du navigateur.

## Vérification des trois positions matérielles (facultative)

Le manuel Logitech documente trois modes matériels, et jusqu'à six avec la fonction Pinkie/SST. Sur certains modèles Linux, le sélecteur se manifeste par les **boutons joydev 27, 28 et 29** (indices démarrant à 0) ; ce n'est **pas une règle garantie sur chaque noyau/périphérique**.

Pour chaque position :

1. Placer la molette sur une autre position.
2. Cliquer sur **Tester la molette** pour le mode souhaité.
3. Tourner ensuite vers ce mode avant la fin des 10 secondes.
4. Noter l'indice reçu, puis comparer aux deux autres positions ; toute capture accidentelle doit être refaite.

**Un événement détecté reste un index Linux brut** ; même `27` ne prouve pas une correspondance avec `SaitekX52Pro Joy_27` dans Elite Dangerous sous Proton. Seule une vérification dans les commandes du jeu permet de la confirmer. Le module ne choisit pas de correspondance ambiguë et n'applique aucune attribution automatiquement.

## Tests et limites

- Les sources TypeScript compilent dans le banc strict v1.6.7 + v1.6.8.
- Tests des trois plans, correspondances et exports HTML.
- L'export HTML échappe noms de profils et données du jeu, n'inclut pas de scripts externes.
- Pas de modification des axes analogiques, de `StartPreset`, des profils originaux ni du logiciel de programmation du fabricant.
- Pas de capture ni de validation du sélecteur physique réel depuis l'environnement de test : **à vérifier sur Manjaro avec votre X52 Pro**.

Références : manuel Logitech X52 Professional, documentation libx52 et pilotes d'entrée Linux (joydev).

Crédits : EDCH original CMDR MDLuffy, extension BGS/HOTAS Cyberpunk Philou.
