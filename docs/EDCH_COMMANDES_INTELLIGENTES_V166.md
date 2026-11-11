# EDCH — Commandes v1.6.6 · Présentation proche du jeu et profils conseillés

## But

La page **Commandes** conserve son audit X52 Pro, l'affichage français et les sauvegardes existants. Un nouvel atelier « Commandes PRO · v1.6.6 » est organisé en colonnes et catégories analogues à celles du jeu : **Tout, Vaisseau, VRS, À pied, Interface/cartes**. Les affectations **principale** et **secondaire** sont affichées dans une table, avec une action P/S permettant de sélectionner l'emplacement exact à changer.

## Édition et profils

1. Fermer Elite Dangerous et son lanceur (précondition vérifiée côté Rust).
2. Sélectionner un fichier source `.binds` de l'extension Odyssey (v4), puis une catégorie.
3. Cliquer sur **P** ou **S** près de la commande, choisir un bouton/touche **réellement présent dans le fichier source**. Pour remplacer un emplacement déjà attribué, cocher l'autorisation explicite.
4. La commande s'ajoute au **brouillon** ; plusieurs modifications peuvent être préparées et annulées.
5. La section « Profils intelligents proposés » permet de préparer les suggestions **Équilibré, Navigation BGS, Combat, Exploration**. Le moteur déterministe local ne propose que les correspondances prudentes connues (ex. `HyperSuperCombination` et `Key_J`) et seulement si l'entrée est connue et disponible dans le contexte ; aucune touche aléatoire, aucun axe analogique inventé.
6. Corriger les touches partagées signalées, confirmer le brouillon, puis créer **un seul nouveau profil** `EDCHProNNN.4.x.binds` dans `Options/Bindings`.
7. Redémarrer le jeu et choisir `EDCHProNNN` dans les préréglages de la catégorie concernée. Odyssey peut demander une sélection distincte pour Général / Vaisseau / VRS / À pied.

L'écriture est effectuée **uniquement après confirmation**. Elle n'envoie pas de touches dans un jeu actif et ne modifie ni le fichier source, ni `StartPreset`, ni les bases BGS. Le profil `EDCHProNNN` est créé de façon non destructive avec `create_new(true)` et `sync_all`. Si le profil existait, un autre nom est recherché.

## Limites connues

- L'éditeur opère sur **un fichier `.binds` à la fois**. Si Odyssey utilise plusieurs fichiers selon la catégorie, l'opération peut être répétée pour chaque profil.
- L'application ne prouve pas la connexion matérielle du X52 Pro. La présence d'un identifiant dans `.binds` n'est pas un test physique du joystick.
- Les axes analogiques, courbes, zones mortes et paramètres HID avancés ne sont **pas** modifiés.
- Le moteur « intelligent » est **déterministe et local**, pas un modèle d'IA externe. Si aucune correspondance sûre n'existe, aucune suggestion n'est fabriquée.
- Les propositions ne sont pas des affectations officielles ni des recommandations garanties pour tous les vaisseaux ; elles nécessitent une vérification par le joueur.
- Le thème visuel est une évocation technique originale, sans images ni éléments graphiques copiés d'Elite Dangerous.
- La compilation native Tauri doit être testée sous Manjaro avant usage réel ; ne jamais considérer les tests statiques comme preuve de bon fonctionnement dans le jeu.

## Développement et vérifications

Sources ajoutées ou modifiées : `src/features/controls/presetAdvisor.ts`, `src/views/controls/presetEditor.ts`, `src-tauri/src/controls_preset.rs`, `src/platform/bridge.ts`, `src-tauri/src/lib.rs`, `public/controls-pro.css`, `public/index.html`, tests de non-régression.

Commandes recommandées :

```bash
npm install --no-package-lock
npm run build
node --test test/*.test.mjs
cargo test --manifest-path src-tauri/Cargo.toml
cargo check --manifest-path src-tauri/Cargo.toml
npm run app:build
```

Exécuter EDCH sous Manjaro X11 avec :

```bash
WEBKIT_DISABLE_DMABUF_RENDERER=1 GDK_BACKEND=x11 ./src-tauri/target/release/edch
```

Auteurs : projet EDCH original — CMDR MDLuffy ; contribution BGS / Commandes — **Cyberpunk Philou**.
