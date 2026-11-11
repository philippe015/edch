# EDCH BGS v1.6.5 — Commandes jeu + rapports HTML

Contribution expérimentale sur la base v1.6.4, sans intégration Mistral ni automatisation des touches du jeu.

## Transfert des commandes au jeu

Depuis **Commandes → Configuration Elite Dangerous · v1.6.5** :

1. Choisir un **fichier source** `.binds` déjà présent (Odyssey 4.x).
2. Choisir l'action Elite (traduction française et identifiant), puis l'emplacement Principal ou Secondaire.
3. Choisir une touche/bouton identifié dans le **même fichier source** (clavier, souris ou HOTAS X52 Pro).
4. Si l'emplacement est déjà occupé, cocher l'autorisation de remplacement **dans le nouveau profil uniquement**.
5. **Fermer Elite Dangerous et son lanceur**, puis cliquer sur « Créer le profil pour Elite Dangerous » et confirmer.
6. EDCH produit `EDCHPro001.4.2.binds` (suffixes/version adaptés) **sans écraser** les fichiers existants. Redémarrer le jeu et sélectionner `EDCHPro001` sous **Options → Commandes → Préréglages**, puis appliquer dans la catégorie Général, Vaisseau, VRS ou À pied souhaitée.

Cette transmission se fait **par fichier de configuration**; aucune commande ne s'exécute dans le jeu en temps réel. Les commandes avec axes analogiques ne sont pas modifiables. La sélection est limitée aux identifiants d'entrée réellement déjà observés dans les fichiers source ; le nouveau profil ne modifie pas `StartPreset` automatiquement.

**Sécurité** : contrôle Rust de l'action, du format de fichier, du matériel/entrée existants, du format Odyssey v4, des modificateurs, de l'occupation de l'emplacement, du jeu arrêté et des chemins; création atomique avec `create_new`. Pas de suppression de profils, pas de modification de la mémoire BGS, pas de changement du X52 Pro réel.

## Exports HTML autonomes

Les boutons PDF des extensions **BGS** et **Commandes PRO** sont remplacés par l'export de rapports HTML hors connexion, mis en page pour l'impression A4 et avec un contenu échappé et une politique CSP restrictive. Sur desktop Tauri, les rapports sont créés dans `Documents/EDCH/rapports/`. En mode navigateur/accès distant, ils sont proposés comme téléchargements `.html`.

Les anciens exports PDF déjà sauvegardés ne sont **pas convertis ou supprimés**. Les anciennes fonctions internes de lecture/enregistrement PDF restent dans le code pour compatibilité historique, mais leurs boutons ne les déclenchent plus. Les exports CSV, JSON, l'éditeur Odyssey et les sauvegardes existantes restent disponibles.

## Tests et limites

- `npm run build` et `node --test test/*.test.mjs` après intégration.
- `cargo test --manifest-path src-tauri/Cargo.toml` et `cargo check --manifest-path src-tauri/Cargo.toml`.
- `npm run app:build` sous Manjaro (Tauri/WebKitGTK).
- Essais manuels : fermer le jeu, dupliquer un profil Custom, configurer une touche non occupée, sélectionner `EDCHPro***` dans Elite, contrôler que l'ancien profil est intact; tester un bouton X52 Pro en jeu; vérifier les HTML enregistrés.
- Aucun test automatique ne peut démontrer que le jeu a réellement chargé un préréglage sur la machine de l'utilisateur.

Original EDCH : CMDR MDLuffy. Contribution communautaire BGS, Manjaro et Commandes : Cyberpunk Philou.
