# EDCH BGS v1.6.1 — Stabilisation PRO (contribution non officielle)

Base précise : `philippe015/edch`, commit `e3e9a4bf63b87caf9718918c216315810cd4e8df` (branche prototype v1.6.0, en amont de ce correctif). Les versions v1.x sont internes au fork, et ne sont **pas** des releases de BKNadir.

## Correctifs

- Un Worker répond désormais immédiatement avec `batch-error` à un lot de taille invalide ou contenant un élément rejeté. Aucun traitement partiel n'est acquitté et la file durable demeure intacte.
- Le panneau de coordination reflète **l'état vivant** du Worker (`stopped`, `starting`, `ready`, `retry`, `paused`). Un diagnostic réussi avant un redémarrage n'est plus présenté comme valable.
- Après cinq échecs consécutifs, l'agent suspend sa reprise automatique afin d'éviter une boucle infinie. L'utilisateur peut choisir « Relancer le traitement ». Les données non acquittées restent en IndexedDB.
- La boîte de sortie est retirée de manière durable **avant** d'émettre ses notifications. Cela empêche les doubles notifications après redémarrage, avec une contrepartie : une fermeture exactement après l'acquittement et avant l'affichage peut faire manquer une notification. Les reçus et informations des événements restent dans la file des événements traités. **Ce n'est pas une garantie d'exactly-once delivery**.
- Diagnostic local en lecture seule : état des agents, mode de stockage, tailles de file, erreurs, nombre de doublons. Aucun journal brut, identifiant personnel ou secret n'est inclus.
- SQLite : `VACUUM INTO` produit une copie cohérente même si la base source utilise WAL. Les copies restent dans le répertoire de données local d'EDCH (`agent-memory-backups/`), en dehors du dépôt Git. Intégrité vérifiée par `PRAGMA quick_check`. Fichiers sans écrasement ni lien symbolique.
- Restauration : seules les copies du répertoire géré, au nom contrôlé, sont acceptées. **Une copie de l'état courant est créée avant restauration** ; suppression puis import sont couverts par la même transaction SQLite. Les fichiers de journaux, `.binds`, BGS et les paramètres restent inchangés.
- GitHub Actions : tests TypeScript/Node existants, vérification des sauvegardes SQLite, tests Rust, `cargo check`, tentative de compilation native Linux/Tauri.

## Tests

Tests isolés à la création : 56 tests JavaScript (réussis), 1 test d'intégration SQLite/Python (réussi), TypeScript strict (réussi). Validation CI complète et build natif Rust/Tauri : à confirmer sur GitHub Actions et Manjaro, non exécutés dans cet environnement.

## Installation Manjaro (branche publiée)

```bash
git fetch origin feat/bgs-stabilisation-pro-v1.6.1-20261110
git checkout -b feat/bgs-stabilisation-pro-v1.6.1-20261110 origin/feat/bgs-stabilisation-pro-v1.6.1-20261110
npm install --no-package-lock
npm run build
node --test test/*.test.mjs
cargo test --manifest-path src-tauri/Cargo.toml
npm run app:build
WEBKIT_DISABLE_DMABUF_RENDERER=1 src-tauri/target/release/edch
```

**Avant toute mise à jour**, fermer EDCH et conserver une copie du projet et de son dossier de données. Cette version ne modifie pas volontairement les fichiers de jeu ou historiques BGS. La restauration de mémoire SQLite concerne l'ensemble des commandants et factions contenus dans la base `edch-agent-memory-v153.sqlite3` ; elle demande une confirmation explicite.

## Limitations

- Pas de calcul exact de l'influence BGS personnelle, pas de contrôle automatique de la carte du jeu, pas de Mistral ni d'accès shell aux agents.
- Les snapshots SQLite restent sur ce PC ; leur confidentialité dépend du disque et des sauvegardes système.
- Les fonctionnalités Windows et l'intégration réelle Elite Dangerous/Steam/Proton n'ont pas encore été validées pour ce correctif.
