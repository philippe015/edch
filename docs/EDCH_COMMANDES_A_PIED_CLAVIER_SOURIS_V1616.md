# EDCH Cyberpunk Philou v1.6.16 — Commandes à pied : Clavier AZERTY + Souris

## Nouvelle interface

Ouvrir **Commandes → À pied → Clavier AZERTY + souris**, choisir le fichier `.binds` personnel. L'éditeur affiche :

- Le clavier AZERTY complet de la v1.6.13 avec ses touches attribuées ou proposées.
- Un schéma de la **souris** : clic gauche (`Mouse_1`), clic droit (`Mouse_2`), clic molette (`Mouse_3`), boutons latéraux (`Mouse_4`, `Mouse_5`), molette en haut/bas, axes X/Y.
- Couleur **bleu-vert** : affectation existante dans le .binds ; **orange** : projet de modification ; **gris** : sans affectation connue.
- Un clic sur un bouton de la souris affiche les actions du mode **À pied** qui lui sont attribuées, y compris l'emplacement principal/secondaire, les modificateurs et les axes.
- Si un bouton numérique est réellement enregistré dans le `.binds`, cliquer dessus le présélectionne pour **Modifier une attribution**. Choisir l'action et l'emplacement principal ou secondaire avant l'ajout au brouillon.
- **Aucune entrée matérielle en direct** ; aucun clic n'est envoyé à Elite Dangerous.

## Profils préparés avec souris (facultatif)

Lorsqu'un profil **À pied / AZERTY** est préparé, les trois suggestions ci-dessous sont étudiées séparément des commandes clavier :

| Action Odyssey | Proposition | Prérequis |
|---|---|---|
| `HumanoidPrimaryFireButton` (tir) | `Mouse_1` (clic gauche) | Code déjà présent dans le .binds et libre à pied |
| `HumanoidZoomButton` (zoom) | `Mouse_2` (clic droit) | Code déjà présent et libre |
| `HumanoidSecondaryInteractButton` (interaction secondaire) | `Mouse_3` (clic molette) | Code déjà présent et libre |

Ce sont des **suggestions Cyberpunk Philou**, pas des raccourcis officiels garantis du jeu.

Une commande absente du `.binds` est ignorée. Si l'action possède déjà une touche souris, si ses deux emplacements sont occupés ou si le bouton est utilisé ailleurs dans le contexte À pied, EDCH ne propose aucun remplacement.

Une commande séparée **Préparer les boutons souris** permet également de ne préparer que la souris.

## Protection des données

- Les mouvements de souris et les axes sont en lecture seule. Ils ne sont pas inclus dans les modifications proposées.
- Les boutons inventés et non reconnus ne sont jamais affectés.
- Pas de changement sur les fichiers `.binds` originaux ; toute écriture passe par la création explicite d'un nouveau `EDCHProNNN.4.x.binds`, après confirmation.
- Les profils Xbox, le HOTAS X52 Pro, les autres modes de jeu, les bases BGS, les données SQLite, les diagnostics et le catalogue officiel récupéré dans la v1.6.15 sont conservés.

## Vérifications

Workflow GitHub `.github/workflows/edch-foot-mouse-v1616.yml` :
- `npm run build`
- `node --test test/*.test.mjs`
- `cargo test --manifest-path src-tauri/Cargo.toml`
- `cargo check --manifest-path src-tauri/Cargo.toml`

## Installation Manjaro

Branche de développement : `feat/commandes-a-pied-clavier-souris-v1.6.16-20261113`.
Installer uniquement après tests et compilation locale, avec sauvegarde de l'exécutable courant :
`/mnt/disque4/EDCH/compilation-cyberpunk/release/edch`.
