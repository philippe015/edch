# EDCH BGS Manjaro — version communautaire complète v1.6.8.3

**Dépôt personnel :** [philippe015/edch](https://github.com/philippe015/edch)  
**Projet d'origine :** [BKNadir/edch](https://github.com/BKNadir/edch), créé par CMDR MDLuffy.  
**Extensions et adaptation Manjaro :** Cyberpunk Philou.  
**Licence :** conserver `LICENSE`, `NOTICE` et les crédits des projets tiers.  
**Statut :** version communautaire non officielle, distincte des versions publiées par l'auteur du projet d'origine.

Ce dépôt comprend **l'intégralité des contributions déjà publiées dans le fork sur GitHub**, depuis les correctifs BGS v1.4.9.2 jusqu'à v1.6.8.3, y compris l'historique Git des branches intermédiaires. Il ne prétend pas contenir d'éventuelles modifications non encore envoyées depuis les installations locales de Manjaro.

## Développements présents

| Série | Contenu |
| --- | --- |
| v1.4.x | Traduction française des commandes et périphériques, BGS Suivi & patrouilles, systèmes, visites, alertes et diagnostics |
| v1.5.x | Observateur journal, workspace BGS, agents COG locaux, file IndexedDB avec ACK, mémoire SQLite et alertes locales |
| v1.6.0–1.6.3 | Agents BGS, stabilisation, pagination et recherche d'alertes, priorités et suivi |
| v1.6.4–1.6.6 | Commandes PRO, inventaire HOTAS, comparaison de profils, export HTML, édition prudente et nouveaux préréglages `.binds` |
| v1.6.7 | HOTAS Studio : détection Linux `/dev/input/jsN`, lecture de pressions/axes, correspondances proposées et vérification utilisateur |
| v1.6.8 | Trois plans X52 Pro : navigation, combat, exploration/BGS, calibration du sélecteur et fiche HTML |
| v1.6.8.1 | Système des primes du journal, sans attribuer rétroactivement des activités non enregistrées |
| v1.6.8.2 | Factions des primes : `AwardingFaction` et `Rewards[].Faction`, historique préservé |
| v1.6.8.3 | Tableau des missions actives Odyssey/au sol dans BGS, issu de l'état réel du module Missions |

Les **modes physiques du X52 Pro ne remappent pas encore automatiquement les commandes** pendant le jeu : les trois positions sont calibrables sous Linux, mais la correspondance sous Proton/Elite reste à confirmer. Le volet Odyssey affiche les missions actives connues ; il ne reconstruit pas fictivement les missions antérieurement terminées.

## Installation Manjaro KDE

Installer au préalable Node.js/NPM, Rust/Cargo et les dépendances GTK/WebKitGTK de Tauri 2 adaptées à Manjaro.

```bash
git clone https://github.com/philippe015/edch.git
cd edch
npm install --no-package-lock
npm run build
node --test test/*.test.mjs
cargo test --manifest-path src-tauri/Cargo.toml
cargo build --release --manifest-path src-tauri/Cargo.toml
WEBKIT_DISABLE_DMABUF_RENDERER=1 GDK_BACKEND=x11 ./src-tauri/target/release/edch
```

Pour éviter de saturer la partition `/home` avec le build Rust Tauri :

```bash
df -h /home /mnt/disque6
# Uniquement si /mnt/disque6 est monté, inscriptible et dispose de suffisamment d'espace :
mkdir -p /mnt/disque6/edch-cargo-build
CARGO_TARGET_DIR=/mnt/disque6/edch-cargo-build cargo build --release --manifest-path src-tauri/Cargo.toml
# Le binaire sera alors dans /mnt/disque6/edch-cargo-build/release/edch
```

Le chemin `CARGO_TARGET_DIR` choisi doit être conservé pour les compilations suivantes. Les binaires et le cache `target/` ne sont pas publiés : ils se recompilent localement.

## Sécurité, données et limites

- Sauvegarder les activités CMDR en JSON avant une mise à jour ; ne jamais effacer les historiques pour résoudre une erreur d'affichage.
- Le moteur BGS ne transforme pas des sauts, missions ou primes en influence fictive. Les chiffres du jeu et les données communautaires sont distincts.
- Un changement de `.binds` doit créer un nouveau profil, être revu explicitement, et n'être effectué que quand le jeu et son lanceur sont fermés.
- La compilation `npm run build` + les tests Node ont un workflow GitHub Actions dédié. Le workflow historique `Build` peut échouer sur une dette de formatage Prettier antérieure ; consulter les vérifications du commit concerné.
- Les différences entre anciennes installations Manjaro (historiques locaux de 89 activités, puis 8/13/16) ne peuvent pas être résolues depuis le dépôt Git : ces données utilisateur ne sont pas synchronisées vers GitHub.
- Ne jamais publier d'API keys, de données personnelles, de journaux Elite complets ou de sauvegardes privées dans le dépôt public.

## Documentation détaillée

- [Index de développement](docs/EDCH_BGS_MANJARO_V1.4.9.2_PUBLICATION.md)
- [Architecture des versions v1.5.0–v1.6.0](docs/EDCH_BGS_MANJARO_V1.6.0_PUBLICATION.md)
- [HOTAS Studio v1.6.7](docs/EDCH_HOTAS_STUDIO_V167.md)
- [Plans X52 Pro v1.6.8](docs/EDCH_X52_MODES_V168.md)
- [Systèmes des primes](docs/EDCH_BGS_PRIMES_SYSTEMES_v1681.md)
- [Factions des primes](docs/EDCH_BGS_FACTIONS_PRIMES_v1682.md)
- [Missions Odyssey](docs/EDCH_BGS_MISSIONS_ODYSSEY_v1683.md)

Les contributions sont conservées dans les commits Git ; l'historique complet ne doit pas être écrasé par une copie ZIP ou un `git push --force`.
