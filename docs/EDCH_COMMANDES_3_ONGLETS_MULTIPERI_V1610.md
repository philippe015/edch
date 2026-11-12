# EDCH Cyberpunk Philou — Commandes v1.6.10 · 3 onglets et périphériques

**Contribution non officielle**, basée sur la branche AZERTY v1.6.9 du fork `philippe015/edch`.

## Interface principale

La page **Commandes** affiche maintenant trois onglets principaux :

- **Vaisseau** : pilotage, hyperespace, ciblage et armes.
- **SRV / VRS** : conduite, tourelle, éclairage, exploration planétaire.
- **À pied** : Odyssey, équipement, navigation et combat terrestre.

Dans chaque contexte, un deuxième niveau permet de choisir **Clavier AZERTY**, **HOTAS X52 Pro / X56** ou **Manette Xbox**, puis **Équilibré**, **Navigation / BGS**, **Combat** ou **Exploration**.

Les commandes sont affichées en français avec affectations **principale/secondaire**, recherche, choix du bouton observé, brouillon, avertissements de conflits et création d'un **nouveau** profil `EDCHProNNN.4.x.binds` après confirmation. Le panneau **À pied** conserve l'éditeur indépendant `EDCHFoot` et les profils AZERTY ZQSD de v1.6.9.

Les diagrammes matériels, diagnostics, sauvegarde ZIP et commandes complémentaires **Interface / cartes** sont préservés dans **Affichage des touches, diagnostics et sauvegardes avancés**. Les affichages du BGS, les traductions françaises, l'historique et SQLite ne sont pas modifiés.

## Profils intelligents : limites importantes

- Le calcul se fait **localement**, sans modèle externe.
- Clavier AZERTY : une combinaison n'est proposée que si son identifiant existe déjà dans le `.binds` source. Pour créer des touches ZQSD à pied absentes du source, utiliser l'éditeur AZERTY `EDCHFoot` dédié.
- HOTAS et Xbox : les boutons sont repris **exclusivement de commandes équivalentes présentes dans le profil source** ; aucune touche `Joy_N` ou XInput n'est inventée, notamment à cause des variations Proton/Linux.
- Les affectations préexistantes de souris, clavier, joystick et manette sont conservées ; les propositions ciblent uniquement des emplacements libres et préviennent des collisions dans le même contexte.
- L'expression « HOTAS X54 » n'identifie pas un périphérique vérifié. L'interface traite les périphériques reconnus comme X52 Pro ou X56, et présente le nom et les boutons contenus dans le profil du jeu.
- Les axes analogiques, courbes, zones mortes, les fichiers originaux et `StartPreset` ne sont pas modifiés.
- Il faut fermer Elite Dangerous avant de confirmer l'enregistrement de tout nouveau `.binds`. Le jeu et le lanceur ne sont pas pilotés automatiquement.

## Compilation Manjaro sans écraser Cyberpunk Philou

**Exécutable actuellement utilisé par l'utilisateur :**
`/mnt/disque4/EDCH/compilation-cyberpunk/release/edch`

Cette voie est un **binaire**, pas un chemin de dépôt source confirmé. Ne pas le supprimer, le déplacer ou le remplacer pendant les tests.

```bash
cd /mnt/disque4/EDCH
git clone --single-branch \
  --branch feat/commandes-3-onglets-multiperi-v1.6.10-20261112 \
  https://github.com/philippe015/edch.git \
  EDCH-Commandes-v1610-src
cd EDCH-Commandes-v1610-src
npm install --no-package-lock
npm run build
node --test test/controls-*.test.mjs test/foot-*.test.mjs
node --test test/*.test.mjs
cargo test --manifest-path src-tauri/Cargo.toml
cargo check --manifest-path src-tauri/Cargo.toml
npm run app:build
```

Démarrer **uniquement ce nouveau binaire de test** :

```bash
WEBKIT_DISABLE_DMABUF_RENDERER=1 GDK_BACKEND=x11 \
  /mnt/disque4/EDCH/EDCH-Commandes-v1610-src/src-tauri/target/release/edch
```

**Avant tout test en jeu**, effectuer une sauvegarde des fichiers `.binds` et des données EDCH, puis vérifier le parcours complet Vaisseau/SRV/À pied et la conservation du profil d'origine. La compilation de GitHub Actions ne remplace pas les essais matériels du clavier, du HOTAS et de la manette Xbox sur Manjaro.

## Tests continus

Le workflow `.github/workflows/edch-commandes-multiperi-v1610.yml` exécute :

- TypeScript strict (`npm run build`) ;
- tests des commandes, des trois onglets et des profils AZERTY/HOTAS/Xbox ;
- suite complète JavaScript ;
- tests Rust des writers `.binds` et `cargo check`.

Ne fusionner la pull request qu'après validation CI et essai sur le PC concerné.
