# EDCH Cyberpunk Philou v1.6.17 — Energy Link dans Commandes à pied

## Commande manquante dans l'interface

Dans **Elite Dangerous: Odyssey**, sortir l'outil de transfert d'énergie pour recharger la combinaison à une prise/borne correspond à l'action XML :
`HumanoidSwitchToRechargeTool`.

Le raccourci **par défaut de Frontier en configuration clavier classique est 3**. Dans un profil personnel ou AZERTY, il peut être différent : EDCH affiche **les affectations réellement lues dans le fichier .binds**, sans les remplacer arbitrairement.

## Fonction ajoutée

**Commandes → À pied → Recharge de la combinaison · Energy Link**

Cette section, présente avec Clavier AZERTY + souris ainsi que pour les vues Xbox/HOTAS, affiche les quatre commandes du même geste :
- `HumanoidSwitchToRechargeTool` : sortir Energy Link (par défaut **3**).
- `HumanoidPrimaryFireButton` : maintenir le tir principal pour transférer l'énergie en visant un connecteur vert d'une borne alimentée (souvent clic gauche).
- `HumanoidToggleToolModeButton` : changer le mode de l'outil. Pour la recharge de combinaison, rester en **mode transfert**, pas surcharge.
- `HumanoidBattery` : utiliser une cellule d'énergie consommable, **différent** de la borne de recharge.

Chaque commande affiche ses touches actuelles (clavier, souris ou manette) ou indique qu'elle est non attribuée / absente. Le bouton **Voir / configurer** sélectionne directement l'action concernée dans l'éditeur. Il ne lance aucune commande dans le jeu.

## Suggestions sécurisées

Les quatre profils préparés **À pied** incluent désormais une proposition de `Key_3` pour `HumanoidSwitchToRechargeTool`, **uniquement si** :
- cette action existe dans le .binds sélectionné ;
- la touche 3 n'est pas déjà utilisée par une autre action du contexte À pied (y compris en modificateur) ;
- un emplacement de commande est disponible ou, dans les modèles AZERTY, un remplacement de touche clavier est explicitement affiché dans le brouillon.

Le panneau Energy Link possède également **Préparer Energy Link sur la touche 3**. Ce raccourci individuel est plus conservateur : il ne propose **aucun remplacement** de touche déjà configurée ; si une touche de clavier existe, EDCH en affiche le nom au lieu d'en ajouter une seconde.

Pour permettre une suggestion clavier `Key_3` même lorsqu'aucune action ne l'utilisait auparavant, la même liste blanche a été mise à jour dans le frontend TypeScript et dans la validation native Rust.

Aucune modification d'axe analogique, HOTAS, Xbox, d'autres fichiers .binds, BGS ou SQLite. Le programme crée uniquement un **nouveau profil** `EDCHProNNN.4.x.binds` après confirmation explicite.

## Procédure dans le jeu
1. À pied, s'approcher d'une borne alimentée (prise verte).
2. Sélectionner l'Energy Link avec sa touche (par défaut **3**).
3. Vérifier que l'outil est en **mode transfert**.
4. Viser la prise et **maintenir le tir principal** pour recharger la combinaison.
5. Une cellule d'énergie relève de `HumanoidBattery` et ne nécessite pas la borne.

## Vérifications
CI GitHub : `npm run build`, `node --test test/*.test.mjs`,
`cargo test --manifest-path src-tauri/Cargo.toml`, `cargo check --manifest-path src-tauri/Cargo.toml`.

Sources documentaires :
- https://elite-dangerous.fandom.com/wiki/Suit_Recharge_Socket
- https://elite-dangerous.fandom.com/wiki/Energy_Link
- https://github.com/mhwlng/dashboard-elite (identifiant XML de l'Energy Link)

Branche GitHub : `feat/odyssey-energylink-raccourci-v1.6.17-20261113`.
Aucune modification de l'exécutable Manjaro local tant que l'utilisateur n'installe pas la nouvelle version après compilation et tests.
