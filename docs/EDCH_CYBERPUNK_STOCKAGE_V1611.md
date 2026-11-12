# EDCH Cyberpunk Philou v1.6.11 — Stockage et intégrité

**Branche de contribution** : `feat/cyberpunk-philou-diagnostic-stockage-v1.6.11-20261112`

## Pourquoi cette amélioration ?

Sur Manjaro, le dossier installé de Cyberpunk Philou mesure environ **8,3 Mo** dans l'environnement utilisateur observé le 12 novembre 2026. Les bases locales occupent séparément environ **2,7 Mo** sous `~/.local/share/EDCompanionHelper`. L'exécutable ne reflète donc pas toute l'utilisation de stockage.

## Nouveau panneau

Dans **Paramètres → Avancé → Stockage et sauvegardes**, cliquer sur **Analyser mon stockage** :

- Taille du binaire **réellement exécuté** (pas celle d'une ancienne compilation) ;
- taille du dossier local `app_local_data_dir` (BGS, mémoire des agents, logs, stockage WebView) ;
- taille de `app_config_dir` ;
- rapports et sauvegardes dans `~/Documents/EDCH` ;
- fichiers `.binds` dans le répertoire configuré par Elite Dangerous, quand détecté ;
- présence, taille et date de modification des bases `edch-bgs.sqlite3` et `edch-agent-memory-v153.sqlite3` ;
- nombre et dernière modification des sauvegardes SQLite des agents ;
- test de cohérence de la base BGS avec `PRAGMA quick_check` par le bouton **Tester l'intégrité BGS SQLite**.

Cliquer sur **Copier chemin** pour copier un emplacement sans ouvrir de dossier ni modifier un fichier.

Les tailles affichées sont lues au moment du clic. L'estimation de stockage ne comprend pas les bibliothèques et dépendances système partagées, le cache Steam complet ou d'autres données du jeu. Une analyse partielle affiche « Total partiel », pas une valeur faussement complète.

## Confidentialité et sécurité

- **Aucune suppression** et aucune création automatique de sauvegardes.
- **Aucune analyse complète du disque** : seuls les emplacements que l'application connaît déjà sont inspectés.
- Les liens symboliques sont ignorés ; nombre d'entrées et profondeur limités.
- Les chemins et tailles ne sont envoyés à aucun service externe.
- Fonctions disponibles **uniquement dans l'application locale**, jamais depuis le téléphone connecté.
- La présence d'une sauvegarde ne certifie pas que son contenu est restaurable. La vérification BGS s'applique à la base BGS courante ; elle ne valide pas les sauvegardes mémoire des agents.
- Les données SQLite, BGS, historiques, commandes, profils et réglages restent au même emplacement. Aucune migration de données.

## Tests

`npm run build`, `node --test test/*.test.mjs`, `cargo test --manifest-path src-tauri/Cargo.toml`, `cargo check --manifest-path src-tauri/Cargo.toml`.

Le workflow GitHub Actions `.github/workflows/edch-storage-v1611.yml` exécute les vérifications en continu. Les vérifications GitHub ne prouvent pas la disponibilité de tous les emplacements sur un PC Manjaro particulier.

## Installation et conservation de l'existant

L'installation cible uniquement l'emplacement déjà utilisé par l'utilisateur :
`/mnt/disque4/EDCH/compilation-cyberpunk/release/edch`

**Ne pas modifier l'exécutable avant un build réussi et une sauvegarde vérifiée.** Ne jamais effacer `~/.local/share/EDCompanionHelper`, `~/Documents/EDCH` ni les fichiers `.binds` d'Elite Dangerous.

Un build séparé peut être testé depuis un dossier temporaire ; après tests, l'installateur Cyberpunk Philou est le seul à devoir remplacer le binaire de `release/`, avec sauvegarde de l'ancien hors du répertoire d'installation.
