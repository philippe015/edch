# EDCH BGS v1.6.2 — Alertes PRO (contribution non officielle)

**Base :** `philippe015/edch` — branche `feat/bgs-stabilisation-pro-v1.6.1-20261110`, commit `8822a8b0f3f0b9c9ca27b064ed4c132aa8de1242`.
Les versions internes v1.6.x ne sont pas des publications officielles de BKNadir.

## Fonctions ajoutées

- Recherche par système ou observation (insensible aux accents/majuscules).
- Filtrage indépendant par sévérité et type d'alerte.
- Pagination de 20, 40 ou 80 alertes par page : **toutes les alertes calculées** sont consultables, plus seulement les 80 premières.
- Nombre total de résultats filtrés, plage visible et navigation sur toutes les pages.
- Export CSV **de tous les résultats filtrés**, et pas uniquement de la page courante ; cellules protégées des formules tableur.
- Préférences de consultation conservées durant la session dans la mémoire de l'interface (non écrites sur disque).
- Règles d'alerte et historique **inchangés** : aucun appel réseau supplémentaire, aucune supposition de tick ou d'influence personnelle.
- Crédits « Cyberpunk Philou », auteur original CMDR MDLuffy, traductions FR et données des versions antérieures conservés par la branche de base.

## Limites

- Le moteur v1.5.4 construit au maximum **500 alertes** par analyse ; la pagination affiche l'intégralité de cette liste, mais ne lève pas la limite du moteur.
- Si le stockage local est indisponible, l'interface existante l'indique ; la pagination elle-même est en mémoire.
- L'export utilise un fichier CSV local et ne modifie aucune donnée d'Elite Dangerous.

## Vérification locale

```bash
npm install --no-package-lock
npm run build
node --test test/*.test.mjs
cargo test --manifest-path src-tauri/Cargo.toml
npm run app:build
```

La CI historique `npm test` peut encore échouer sur Prettier (dette de formatage antérieure). Une réussite des seuls tests JS ne prouve pas la réussite de cette CI ni de la compilation native Linux.

## Installation

Utiliser la nouvelle branche GitHub, ou le patch autonome `apply_v162.py` sur une copie de la v1.6.1, avec sauvegarde automatique des sources remplacées. Le script refuse les fichiers divergents et les liens symboliques ; il ne touche ni `.binds`, ni SQLite, ni les journaux, ni la configuration du jeu.
