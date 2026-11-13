# EDCH Cyberpunk Philou v1.6.20 — Clavier AZERTY visible pendant l'attribution P/S

## Défaut constaté

Le joueur cliquait sur **P** ou **S** dans **Commandes → À pied** puis voyait la fenêtre « Attribution directe » au milieu de l'écran. Le clavier virtuel existait déjà dans la page mais **restait masqué derrière le fond assombri**, et souvent plus bas que la zone visible. Les clics gauche de souris sur cette fenêtre risquaient aussi d'être confondus avec `Mouse_1`.

## Correction

Lorsqu'on clique sur **P** ou **S** dans **À pied → Clavier AZERTY + souris** :

1. Une grande fenêtre d'attribution présente **immédiatement le clavier virtuel AZERTY** complet (touches F1–F12, lettres, chiffres, majuscules, Espace, flèches, navigation et pavé numérique).
2. **Cliquer directement sur une touche du clavier affiché** sélectionne cette touche pour la commande en cours.
3. Il reste possible d'**appuyer sur le clavier physique** sans utiliser la souris.
4. Les touches réservées, non reconnues ou non prises en charge par le moteur de validation sont **grisées et désactivées** ; elles ne créent pas de raccourci fictif.
5. Les touches déjà utilisées sont colorées conformément à la vue AZERTY existante, avec leur premier libellé et leur nombre d'affectations.
6. Pour attribuer un **bouton physique de souris**, cliquer dans une **zone Souris** dédiée, située sous le clavier. Les clics sur le clavier virtuel, les textes et le bouton Annuler **ne sont plus capturés comme souris gauche**.
7. **Échap** ou **Annuler** ferme sans modification.
8. Après détection et contrôle de conflit, la commande entre dans le brouillon EDCH. Le jeu n'est pas modifié tant que l'utilisateur n'a pas créé un **nouveau profil .binds** puis activé EDCHPro dans Odyssey.

## Affichage

La fenêtre est plus large, avec hauteur maximale adaptée à l'écran. Le clavier peut défiler horizontalement et le panneau entier verticalement, y compris sur un petit écran Manjaro.

## Limites

- Pas de capture de combinaisons Ctrl/Alt/Maj + autre touche via la fenêtre directe.
- Certaines touches spéciales, symboles ISO et touches internationales sont grisées plutôt que de produire un code incorrect.
- Les boutons souris nécessitent d'être connus dans le profil `.binds` source.
- Les axes et les périphériques HOTAS/Xbox gardent leurs propres outils.
- Aucun appui clavier n'est simulé dans Elite Dangerous.
- Les fichiers `.binds` d'origine, BGS et SQLite sont conservés.

## Validation

Workflow GitHub `.github/workflows/edch-azerty-modal-v1620.yml` :
- `npm run build`
- `node --test test/*.test.mjs`
- `cargo test --manifest-path src-tauri/Cargo.toml`
- `cargo check --manifest-path src-tauri/Cargo.toml`

Nouveaux tests : `test/azerty-visible-capture-v1620.test.mjs` (correspondance AZERTY, touches cliquables, touches interdites grisées, séparation des clics souris et conservation du brouillon).

Branche : `feat/clavier-azerty-visible-capture-v1.6.20-20261113`. Le programme installé sur Manjaro n'est pas modifié tant que l'utilisateur n'exécute pas l'installation locale.
