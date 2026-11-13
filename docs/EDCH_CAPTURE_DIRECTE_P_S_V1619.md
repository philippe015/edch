# EDCH Cyberpunk Philou v1.6.19 — P / S : capture directe au clavier et à la souris

## Problème corrigé
Avant v1.6.19, dans **Commandes → À pied → Clavier AZERTY + souris**,
cliquer **P** ou **S** choisissait seulement la commande à éditer.
Appuyer ensuite sur une touche ne lançait aucune capture, contrairement
à l'attente du joueur.

## Nouveau fonctionnement
1. Cliquer **P** (principale) ou **S** (secondaire) sur une commande À pied.
2. Une fenêtre de capture apparaît immédiatement et reçoit le focus.
3. Appuyer sur la touche du clavier ou cliquer avec le bouton de souris voulu.
4. L'entrée est convertie en code Elite Dangerous (exemple : **Z → Key_Z**, **3 → Key_3**, **clic gauche → Mouse_1**).
5. Si l'emplacement est déjà utilisé, EDCH affiche l'ancien code et exige une confirmation de remplacement **dans le nouveau profil uniquement**.
6. Si la touche est déjà associée à une autre commande du même contexte À pied, EDCH refuse le doublon et invite à choisir une autre touche.
7. La proposition apparaît immédiatement dans **Brouillon à valider**.
8. Cliquer **Créer un nouveau profil pour Elite Dangerous**, jeu et lanceur fermés.
9. Dans **Elite Dangerous: Odyssey → Options → Commandes → À pied**, choisir le nouveau profil **EDCHProNNN** puis **Appliquer**.

**Échap** ou **Annuler** ferme la capture sans modification.

Un bouton **Appuyer sur une touche (clavier / souris)** reste accessible dans le panneau Modifier une attribution pour recommencer sans chercher la ligne de commande.

## Entrées gérées
- Caractères latins A–Z respectant le clavier AZERTY par lecture de `KeyboardEvent.key` ; le code physique QWERTY n'est pas confondu avec le caractère imprimé.
- Chiffres 0–9 de la première ligne via `KeyboardEvent.code` (prend en charge la disposition française).
- F1–F12, pavé numérique 0–9, Espace, Tab, Entrée, Retour arrière, Suppr, Inser, Début/Fin, Page haut/bas, flèches.
- Touches Maj/Ctrl/Alt lorsqu'elles sont pressées seules.
- Souris : clic gauche, clic droit, clic molette, boutons latéraux 4/5 **seulement si le code existe déjà dans le fichier .binds source**.

## Limitations explicites
- Pas de raccourcis combinés Ctrl/Alt/Maj + autre touche dans la capture directe.
- Les touches de ponctuation complexes, certaines touches internationales, les axes souris, la molette et les boutons HOTAS/Xbox ne sont pas capturés par ce mode ; ceux-ci restent configurables via l'éditeur spécialisé ou le jeu.
- Le clic de souris a lieu dans la fenêtre de capture ; aucun clic n'est transmis au jeu.
- La capture n'est activée automatiquement que dans **À pied → Clavier AZERTY + souris** ; les autres contextes utilisent leur éditeur spécialisé.
- EDCH ne change pas le fichier `StartPreset` ni le profil en cours de jeu. L'activation reste volontaire dans Odyssey.

## Sécurité
- Correspondance strictement contrôlée des touches clavier autorisées côté TypeScript et Rust.
- Aucune fabrication de numéros de boutons HOTAS/Xbox/souris.
- Confirmation explicite avant remplacement d'une affectation occupée.
- Collisions du même contexte bloquées.
- Le fichier `.binds` source n'est jamais écrasé ; un nouveau `EDCHProNNN.4.x.binds` est créé par `create_new(true)` après la validation du brouillon.
- Les fichiers BGS et SQLite et les configurations Vaisseau/SRV restent inchangés.

## Tests
Workflow `.github/workflows/edch-foot-direct-capture-v1619.yml` :
- `npm run build`
- `node --test test/*.test.mjs`
- `cargo test --manifest-path src-tauri/Cargo.toml`
- `cargo check --manifest-path src-tauri/Cargo.toml`

Branche : `feat/capture-touches-directe-p-s-v1.6.19-20261113`.
