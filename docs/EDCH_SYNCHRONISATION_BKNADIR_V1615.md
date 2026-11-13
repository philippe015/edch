# EDCH Cyberpunk Philou v1.6.15 — Synchronisation sélective BKNadir/edch

## Sources vérifiées (13 novembre 2026)

- Dépôt officiel : https://github.com/BKNadir/edch — branche `main`, version stable `v0.10.12` (commit `7ee7e56ca720`, 13/11/2026).
- Préversion officielle : `v0.10.13-pre.113` — ne pas assimiler à une version stable.
- Dépôt personnalisé : https://github.com/philippe015/edch, branche `feat/manette-xbox-graphique-profils-intelligents-v1.6.14-20261113`.
- Comparaison GitHub entre les deux branches : **18 commits amont non incorporés** et **104 commits personnalisés**, à la date de la comparaison. Une fusion globale automatique serait risquée.

## Changements réellement intégrés dans cette branche

### A. Catalogue Elite Dangerous actualisé

- Source : commit amont `ccf87003a9a0` (EDRefCard2, maintenu par brammmers/edrefcard2).
- `public/data/binds.json` actualisé : **420 actions** (391 avant) et **111 correspondances de templates** (68 avant). Le delta de **43 IDs** inclut des variantes VID/PID : ce n'est pas forcément 43 modèles physiques différents.
- Les identifiants de commandes existants sont conservés.
- Nouveau référentiel `tools/sources/edrefcard/{bindingsData.py,controlsData.py,COMMIT,PICTURES}`, générateur `tools/gen_binds.py` actualisé.
- Aucun code d'entrée vers Elite Dangerous ajouté, aucun changement aux affectations du joueur.
- L'URL des images de périphériques pointe vers l'amont EDRefCard2. Notre fork **ne possède pas encore** la nouvelle fonctionnalité de cache local haute qualité des images mise en place dans BKNadir.

### B. Missions de massacre en zone de conflit

- Source : commit amont `060a7d0bb8e`.
- Événement `FactionKillBond` : la faction de la victime, si elle est renseignée dans le journal, est maintenant utilisée pour avancer la progression des missions de massacre correspondantes.
- Les primes `Bounty` continuaient déjà à le faire. Un correctif ne remplace pas la règle du jeu ; l'événement doit contenir une faction victime connue.
- Les missions de plusieurs donneurs d'ordre sont conservées dans leur ordre logique.
- Tests amont `test/massacre.test.mjs` repris.
- **Attention : ce correctif ne constitue PAS un compteur du nombre de CZ terminées**. Le nombre de zones terminées nécessiterait une analyse différente des événements de session BGS.

### C. NVIDIA / Manjaro

- Amont : commit `81f5e0685c1f`.
- Le fork avait **déjà** une détection du pilote NVIDIA dans `src-tauri/src/main.rs` et active `WEBKIT_DISABLE_DMABUF_RENDERER=1` si nécessaire. **Pas de copie dupliquée**.

## Améliorations officielles identifiées, NON encore intégrées

| Priorité | Amélioration | Risque et conduite |
|---|---|---|
| Haute | Durcissement ZIP/HTTP/redirections/accès distant/mises à jour (commit `c1e98eb52adb`) | Revue de sécurité séparée, modifications réparties entre Rust/TS et état de l'application |
| Haute | Éditeur Configure, capture de commande, préréglages intégrés (commit `7c6601377260`) | Réconciliation avec nos nouveaux éditeurs AZERTY/X52/Xbox et moteur .binds non destructif |
| Moyenne | Cache sur disque des images manettes à pleine qualité | Ajouter ensemble bridge, gestionnaire Tauri et code de chargement ; ne pas simplement copier le frontend |
| Moyenne | Icônes de stations (commit `b7993c7208d8`) | Dépendances de ressources et mentions légales SpyTec/EDAssets à incorporer |
| Moyenne | Colonisation et porte-vaisseaux (commit `11f9faf07bec`) | Tests contre le suivi BGS personnalisé et données persistantes |
| Basse | Animation de chargement EDAssets (commit `29e3452e68b7`) | Visuel accessoire, dépend des assets et crédits |
| À part | Hailport, assistant vocal (branche expérimentale/pre-release) | Pas de fusion sans étude et accord spécifiques |

## Préservation

Cette branche NE modifie PAS :
- Le code et les données BGS personnalisés, ni les fichiers SQLite historiques.
- Les profils clavier AZERTY, HOTAS X52 Pro, Xbox, ou les fichiers `.binds` sauvegardés.
- L'exécutable local installé sous `/mnt/disque4/EDCH/compilation-cyberpunk/release/edch`.
- Les outils de copie/sauvegarde ni le fichier de démarrage du jeu.

L'intégration est hébergée en **PR brouillon** et ne doit être installée sur Manjaro qu'après validation TypeScript, JS, Rust et du générateur des données, plus une compilation locale réussie.

## Tests

Workflow : `.github/workflows/edch-upstream-v1615.yml`
- `npm run build`.
- `node --test test/*.test.mjs`.
- `python3 tools/gen_binds.py` puis `git diff --exit-code -- public/data/binds.json`.
- `cargo test --manifest-path src-tauri/Cargo.toml`.
- `cargo check --manifest-path src-tauri/Cargo.toml`.

Les nouvelles sources et les crédits EDRefCard2 sont identifiés dans `NOTICE`.
