# EDCH Commandes à pied — profils intelligents AZERTY (v1.6.9 expérimentale)

**Base :** fork `philippe015/edch`, branche `release/edch-bgs-manjaro-v1.6.8.3-complet-20261112`.

Cette contribution améliore **Commandes → À pied (Odyssey)**. Elle ne modifie ni les commandes du vaisseau/VRS, ni les fichiers historiques, ni les bases BGS et SQLite, ni les affectations HOTAS/X52 Pro.

## Profils disponibles

| Profil | Objectif | Affectations proposées (si compatibles) |
|---|---|---|
| AZERTY essentiel | Déplacement standard français | Z/Q/S/D, E interaction, R recharge, Espace saut, Maj course, Ctrl accroupi, F lampe |
| Combat Odyssey | Actions rapides au sol | ZQSD, R recharge, V mêlée, G grenade, H bouclier, 1/2 armes |
| Exploration et exobiologie | Scanner et équipements | ZQSD, V scanner, T panneau, F lampe, N vision nocturne, C analyseur, X outil |
| Confort | Commandes proches et simples | ZQSD, E, R, F, T, X, Tab roue d'équipement |

Ces affectations sont des *propositions*, pas des commandes officielles d'Elite Dangerous. Elles sont calculées localement, sans IA externe et sans injection de touches dans le jeu.

## Fonctionnement sûr

1. **Fermer Elite Dangerous et son lanceur**, puis ouvrir EDCH → Commandes → À pied.
2. Choisir un fichier Odyssey `.4.x.binds` qui contient réellement les actions OnFoot.
3. Dans **Profils intelligents · clavier français AZERTY**, sélectionner un profil.
4. Vérifier les propositions, les commandes déjà conformes et les éventuelles affectations écartées. Si `KeyboardLayout` n'indique pas une famille AZERTY, contrôler la disposition du jeu.
5. Cliquer **Préparer ce profil (sans enregistrer)**. Toutes les modifications restent en mémoire et peuvent être retirées.
6. Cliquer **Créer le profil EDCHFoot**, confirmer la boîte de dialogue et sélectionner le nouveau profil dans les options du jeu après redémarrage.

Les propositions n'écrasent jamais un emplacement utilisé par un joystick ou une souris. Une touche AZERTY déjà attribuée à une autre action à pied inchangée est ignorée pour éviter une collision. Les touches clavier déjà correctement attribuées sont conservées. Les affectations clavier différentes ne sont modifiées **que dans le nouveau profil**, après confirmation.

La source `.binds` et le fichier `StartPreset` ne sont jamais modifiés. Il est possible de supprimer le nouveau préréglage sans perdre l'ancien. Si un préréglage est déjà présent, Rust choisit le prochain nom `EDCHFootNNN` libre.

## Garanties et limites

- Le moteur ne prétend pas connaître le clavier branché : la correspondance **AZERTY dépend aussi du réglage clavier du jeu/OS**.
- Les commandes absentes du fichier source sont ignorées ; aucune création fictive de commande ou de bouton HOTAS.
- Le créateur Rust existant ne change que les slots `Primary/Secondary` des actions Odyssey, conserve les autres éléments XML et refuse d'écraser les boutons non-clavier.
- Le diagnostic des collisions est limité aux commandes du contexte OnFoot ; il ne remplace pas une vérification réelle en jeu.
- La branche est une **contribution non officielle**, pas une version publiée par les mainteneurs d'EDCH.
- Aucun APK ou binaire Linux n'est inclus ; une compilation Manjaro reste nécessaire avant utilisation.

## Tests

```bash
npm install --no-package-lock
npm run build
node --test test/foot-editor-v1-4-4.test.mjs test/foot-azerty-profiles-v169.test.mjs
node --test test/*.test.mjs
cargo test --manifest-path src-tauri/Cargo.toml foot_binds::tests
cargo check --manifest-path src-tauri/Cargo.toml
```

Le workflow dédié `.github/workflows/edch-foot-azerty-v169.yml` vérifie les tests TypeScript/Node et les tests Rust de l'éditeur de fichiers .binds.

Conserver une copie des profils personnels avant toute mise à jour de l'application.
