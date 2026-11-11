# EDCH BGS v1.6.8.3 — Affichage des missions Odyssey
## Problème
Le tableau BGS ne présente actuellement que les événements MissionAccepted / MissionCompleted enregistrés *en direct*. Il ne montre pas les missions actives du module Missions, reconstruites au démarrage depuis le journal Elite Dangerous.

## Correction
Ajout dans **BGS → Systèmes → Mon CMDR** du tableau **Missions actives · Odyssey / au sol inclus**. Il affiche toutes les missions actives réelles de l'état `activity.missions` (jusqu'à 40 lignes), avec :
- nom tel que fourni par le journal ;
- faction attributrice, si connue ;
- système et station/établissement de destination, si fournis ;
- état actif ou objectif modifié ;
- identification explicite Odyssey seulement si un marqueur OnFoot/Odyssey est présent.

Les missions au sol sans marqueur identifiable ne sont plus invisibles : elles restent dans la liste comme « Non précisé ».

## Limites et vérification
- Le journal `Missions` reconstruit les **missions actives**, mais pas toutes les missions déjà terminées hors EDCH.
- `MissionCompleted` est généralement généré à la remise finale auprès du donneur de mission, pas forcément à la fin de l'objectif.
- Aucune inférence d'influence BGS ; aucun historique local réinitialisé ; aucun champ `.binds` modifié.
- Vérifier les journaux `MissionAccepted`, `Missions` et `MissionCompleted` si le tableau reste vide.
- La liste garde un plafond visuel de 40 missions, avec le nombre total clairement annoncé.
## Installation
Branch GitHub `fix/bgs-missions-odyssey-v1.6.8.3-20261111`, dérivée de la correction BGS v1.6.8.2. Compiler dans un dossier séparé sous Manjaro.
Crédits : CMDR MDLuffy (EDCH original) ; Cyberpunk Philou (extensions).
