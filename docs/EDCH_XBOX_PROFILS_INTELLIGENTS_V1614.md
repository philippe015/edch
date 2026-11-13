# EDCH Cyberpunk Philou v1.6.14 — Graphique Xbox et profils intelligents

## Nouveautés dans Commandes

Choisir **Commandes → Vaisseau / SRV-VRS / À pied → Manette Xbox**. Un schéma de manette vectoriel et interactif apparaît sous les cartes de profils préparés.

La vue affiche :
- Boutons **A/B/X/Y**, **LB/RB**, **LT/RT**, **View/Menu/Xbox**.
- Sticks gauche/droit : **LS/RS**, clics L3/R3 et axes **X/Y** (s'ils existent dans le .binds).
- Croix directionnelle : haut/bas/gauche/droite.
- Couleurs : bleu-vert = entrée actuellement affectée ; orange = proposition du brouillon ; gris = non reconnue dans ce contexte.
- Clic ou activation au clavier : détails des affectations, actions, principale/secondaire, axes, inversions et modificateurs.
- Les codes non reconnus sont listés à part et ne sont jamais présentés comme un bouton physique arbitraire.

**Le contrôleur n'est pas écouté en direct**. Seules les informations du fichier .binds sélectionné sont affichées. Le schéma n'envoie aucune pression de bouton au jeu.

## Profils intelligents (heuristiques locales)

Chaque contexte dispose de quatre styles :
1. Polyvalent — commandes essentielles.
2. Navigation / BGS — sauts, cartes, navigation.
3. Combat — tir, ciblage, tourelle ou combat à pied.
4. Exploration — scanners, éclairage, exploration ou exobiologie.

L'analyse est **déterministe et locale**, et non une IA connectée ou générative. Elle procède ainsi :

1. Lit uniquement les actions et les entrées de la manette réellement présentes dans le `.binds` choisi.
2. Identifie les boutons Xbox par leurs codes `Pad_*` et `GamePad_*` reconnus.
3. Préfère reprendre un bouton déjà attribué à une fonction équivalente dans un autre contexte de jeu (avec justification affichée).
4. À défaut, propose une disposition conventionnelle pour le style demandé seulement si le bouton correspondant existe réellement dans les affectations du source et qu'il est libre dans le contexte cible.
5. Écarte les actions absentes, les emplacements déjà occupés et les doublons de touches dans le même contexte.
6. Ne touche ni aux axes analogiques ni aux assignations existantes. Ne combine pas plusieurs périphériques dans le même profil préparé.
7. Place les propositions dans un brouillon. Le joueur décide de retirer ou de modifier les choix avant de créer volontairement un **nouveau** `EDCHProNNN.4.x.binds`.

**Les profils ne sont pas les configurations officielles de Frontier.** Ils n'installent aucune commande automatiquement. Les propositions peuvent être limitées si peu d'affectations Xbox existent dans le fichier source. Dans ce cas, configurer des boutons dans Elite Dangerous, sauvegarder, puis actualiser EDCH.

## Sécurité et compatibilité

- Aucun changement aux fichiers `.binds` originaux, StartPreset, configurations HOTAS X52 Pro, clavier AZERTY, données BGS ou bases SQLite.
- Les emplacements déjà affectés ne sont jamais écrasés par les profils intelligents.
- Le code Rust d'enregistrement du profil est inchangé : pas d'écriture automatique, confirmation, arrêt du jeu exigé, nouveau fichier `create_new(true)`.
- Le schéma et le moteur de recommandation n'ont pas accès à Internet ni aux entrées physiques.
- Si les boutons proviennent d'une manette non identifiable, EDCH les laisse sans correspondance graphique au lieu d'inventer une numérotation.

## Tests

Workflow `.github/workflows/edch-xbox-v1614.yml` :
- `npm run build` — TypeScript.
- `node --test test/*.test.mjs` — tests JS, y compris schéma, axes, reconnaissance Xbox, suggestions et conservation des sources.
- `cargo test --manifest-path src-tauri/Cargo.toml` — vérification native du générateur de profils.
- `cargo check --manifest-path src-tauri/Cargo.toml` — vérification de compilation.

## Manjaro

Branche : `feat/manette-xbox-graphique-profils-intelligents-v1.6.14-20261113`.

Exécutable déjà installé :
`/mnt/disque4/EDCH/compilation-cyberpunk/release/edch`

Toujours compiler/tester les sources dans un répertoire temporaire sur **/mnt/disque4**, sauvegarder l'exécutable actuel dans `~/.local/share/edch-cyberpunk-philou/sauvegardes/` avant de remplacer, et vérifier `ldd` sur le binaire final. Ne pas supprimer `~/.local/share/EDCompanionHelper`.

Le résultat de CI GitHub n'est pas une preuve que les boutons matériels d'une manette particulière ont été détectés. Les codes manette de Steam/Proton doivent correspondre à ceux du profil source.
