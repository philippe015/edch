# EDCH Cyberpunk Philou v1.6.21 — Profils nommés et commandes À pied AZERTY étendues

## Diagnostic de la capture Odyssey (13 novembre 2026)

Dans **Elite Dangerous → Options → Commandes au sol**, le joueur voit `EDCHPRO001`, `EDCHPRO002`, `EDCHPRO003`, `EDCHPRO004`, tandis qu'**Avancer = W** (et non Z). Le jeu reconnaît les fichiers générés, mais les anciens profils ne garantissent pas qu'un ensemble AZERTY complet ait été préparé ou activé.

La v1.6.20 permettait la capture des touches P/S mais le moteur ne fournissait qu'environ 10–14 propositions clavier selon le style. La création du profil ajoutait un nombre à `EDCHProNNN` et pouvait conserver l'affectation W si la commande correspondante n'était pas incluse dans le brouillon.

## Nouveaux noms lisibles dans le jeu

Les quatre styles AZERTY À pied utilisent maintenant les **noms internes** suivants (visibles aussi dans la liste déroulante d'Odyssey) :

| Choix EDCH | PresetName et nom du fichier |
|---|---|
| À pied, AZERTY complet | `EDCH_PIED_AZERTY` |
| À pied, navigation | `EDCH_PIED_NAVIGATION` |
| À pied, combat | `EDCH_PIED_COMBAT` |
| À pied, exploration | `EDCH_PIED_EXPLORATION` |
| Modification manuelle | `EDCH_PIED_PERSONNALISE` |

Les autres catégories peuvent recevoir un nom de type `EDCH_VAISSEAU_X52_COMBAT`, `EDCH_SRV_AZERTY_NAV` ou `EDCH_PIED_XBOX_POLYVALENT`.

Le champ du nom est modifiable dans le brouillon, limité à **40 caractères ASCII** et préfixé `EDCH_`. Le nom est identique dans le fichier `.4.x.binds` et dans l'attribut XML `<Root PresetName="...">`.

Si un préréglage existe déjà, EDCH génère `EDCH_PIED_AZERTY_02`, puis `_03`, etc. Il ne réécrit ni ne supprime les précédents fichiers EDCHPRO. Pour éviter les doublons dans le menu, la recherche tient aussi compte des variantes de numéro de version Odyssey.

## Préparation AZERTY étendue

**40 actions clavier proposées** avec des codes du jeu validés (lorsque ces actions existent dans le `.binds` source), notamment :

| Action | Proposition Cyberpunk Philou |
|---|---|
| Avancer | `Z` |
| Reculer | `S` |
| Déplacement latéral gauche | `Q` |
| Déplacement latéral droit | `D` |
| Saut | Espace |
| Courir | Maj gauche |
| S'accroupir | Ctrl gauche |
| Interagir / interaction secondaire | E / F |
| Recharger une arme | R |
| Corps à corps | V |
| Lancer grenade | G |
| Arme principale / secondaire | 1 / 2 |
| Ranger l'arme | U |
| Lampe / vision nocturne / boucliers | T / N / C |
| Energy Link / analyseur / outil de combinaison | 3 / 4 / 5 |
| Roue d'équipement | Alt gauche |
| Batterie / soin | H / J |
| Mode outil / scanner | X / P |
| Accès à installation / marche | O / B |
| Carte galactique / système | F9 / F10 |
| Aide mission / roue d'émotes | F1 / F2 |
| Grenade suivante / précédente | F3 / F4 |
| EMP / fragmentation / bouclier | F6 / F7 / F8 |
| Communication / communications rapides | F11 / F12 |

Ces raccourcis sont **des propositions**, pas les réglages officiels. Ils doivent être inspectés puis confirmés par le joueur.

### Les autres commandes

Les métadonnées Odyssey du catalogue en comptent environ 79 dans le groupe `OnFoot`, dont les axes analogiques, les contrôles d'émotes et des fonctions spécialisées. Il serait dangereux de promettre une affectation unique et automatique à chacune.

Le nouveau panneau **Toutes les propositions À pied** énumère explicitement :
- chaque raccourci prévu et son affectation source ;
- les modifications réellement ajoutées au brouillon ;
- les commandes sans attribution ni proposition sûre, avec la raison de leur absence ;
- les touches indisponibles à cause de conflits ;
- les fonctions restantes modifiables individuellement par **P/S**.

La souris existante reste prioritaire pour le tir/visée. Les propositions souris supplémentaires sont intégrées **sans utiliser deux fois le même emplacement de commande**.

## Contrôle de cohérence et protection des profils

- Pour annoncer un profil AZERTY complet, le système doit vérifier que **Z/S/Q/D** sont réellement présents dans la configuration attendue (sources conservées + brouillon). Si une touche est bloquée par une autre action, la sauvegarde est **désactivée**, avec indication du conflit à corriger.
- Jusqu'à **64 modifications distinctes** peuvent être confirmées dans un seul nouveau profil (contre 40 auparavant).
- Chaque action et son emplacement restent explicitement validés côté TypeScript et Rust.
- Avant toute écriture, le moteur Rust construit le XML et **revérifie la correspondance finale de chaque touche avec son action**.
- Le nouveau profil porte son nom lisible à l'intérieur et à l'extérieur du XML.
- Un nouveau profil nommé peut être créé avec **zéro changement** uniquement lorsque la configuration existante correspond déjà au modèle sélectionné.
- Pas de suppression des anciens EDCHPRO001–004. Pas de modification du `StartPreset` ni d'injection de touches dans le jeu.
- Fichiers source `.binds`, axes, HOTAS X52 Pro, manettes Xbox, données BGS et SQLite préservés.

## Utilisation et vérification

1. Fermer Elite Dangerous et son lanceur.
2. Dans Cyberpunk Philou **Commandes → À pied → Clavier AZERTY + souris**, choisir un fichier source `.binds`.
3. Cliquer sur **Préparer · Polyvalent** (40 raccourcis définis, application selon disponibilité et conflits), ou sur le style désiré.
4. Ouvrir **Toutes les propositions À pied**, vérifier **Avancer = Key_Z**, **Reculer = Key_S**, **Gauche = Key_Q**, **Droite = Key_D**. Corriger les éventuels conflits avant création.
5. Vérifier le nom `EDCH_PIED_AZERTY` dans le panneau du brouillon.
6. Cliquer **Créer un nouveau profil pour Elite Dangerous** ; le fichier existant n'est pas modifié.
7. Démarrer Odyssey, ouvrir **Options → Commandes → Au sol**, choisir **EDCH_PIED_AZERTY** puis **Appliquer**.
8. Contrôler les touches effectivement affichées par le jeu, notamment **Avancer : Z**.
9. Si l'affichage ne correspond pas, utiliser **Relire les réglages faits dans le jeu** et vérifier le fichier actif. Ne pas supprimer les anciens profils avant confirmation.

## Tests

- `npm run build`
- `node --test test/*.test.mjs`
- `cargo test --manifest-path src-tauri/Cargo.toml`
- `cargo check --manifest-path src-tauri/Cargo.toml`

Tests dédiés `test/foot-complete-named-v1621.test.mjs` : régression W→Z, collisions, conservation du matériel, 40 suggestions, noms affichables, XML final.

Branche : `feat/profils-nommes-commandes-sol-completes-v1.6.21-20261113`.
