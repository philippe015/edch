# EDCH Cyberpunk Philou v1.6.18 — Configurer les commandes à pied dans le jeu

## Fonction

Dans **Commandes → À pied**, un nouveau panneau **Configurer les commandes à pied directement dans le jeu** apparaît. Il permet de suivre le chemin réellement pris en charge par Elite Dangerous: Odyssey et d'importer les modifications faites par le jeu.

### Parcours d'utilisation

1. Dans EDCH, sélectionner un fichier `.binds` personnel, puis préparer ses commandes à pied (AZERTY + souris, Xbox, etc.).
2. Fermer Elite Dangerous et son lanceur avant de créer un nouveau fichier. Cliquer sur **Créer un nouveau profil pour Elite Dangerous**.
3. EDCH crée un profil unique `EDCHProNNN.4.x.binds` dans le répertoire de configuration du jeu (pas dans le dossier du projet EDCH). Le nouveau nom est visible dans la section d'activation.
4. Démarrer **Elite Dangerous: Odyssey**. Dans **Options → Commandes → À pied → Préréglages**, choisir **EDCHProNNN** puis **Appliquer**.
5. Pour personnaliser une touche **dans le jeu**, sélectionner la commande à pied puis presser le bouton clavier, souris ou manette voulu. Enregistrer.
6. De retour dans EDCH, cliquer sur **Relire les réglages faits dans le jeu**. Cela cherche le préréglage À pied actif et relit les affectations réelles. Il est normal qu'Odyssey puisse passer sur le préréglage `Custom` après une modification.

### Boutons dans l'éditeur

- **Ouvrir le dossier des profils .binds** : demande au système d'ouvrir l'emplacement réel du fichier de commandes, via `optionsDir` et `revealPath`. Pas de chemin Steam/Proton déduit arbitrairement.
- **Vérifier le profil À pied actif** : lit uniquement `StartPreset.4.start` (ou son équivalent existant), quatrième ligne correspondant à `OnFoot`. Affiche le profil réellement enregistré comme actif et s'il correspond au dernier profil créé.
- **Relire les réglages faits dans le jeu** : relit les fichiers Odyssey, sélectionne le fichier `.binds` correspondant au préréglage À pied actif si disponible, recharge les touches dans l'interface. Si un brouillon non enregistré existe, une confirmation est exigée avant de l'abandonner.

### Restrictions et sauvegarde

- EDCH **ne peut pas cliquer automatiquement dans les menus du jeu** et **ne modifie pas `StartPreset`**. L'activation du préréglage s'effectue volontairement par le joueur dans Odyssey.
- Les catégories **Général / Vaisseau / SRV / À pied** disposent de choix de préréglages indépendants. Appliquer EDCHPro uniquement à **À pied** préserve les sélections Vaisseau/SRV.
- L'éditeur écrit un **nouveau** profil et refuse les modifications directes du fichier source ; il faut fermer le jeu pour la création du fichier.
- Les axes HOTAS, les configurations clavier et Xbox, les fichiers BGS et SQLite ne changent pas.
- En cas d'absence de `StartPreset`, EDCH indique « non vérifiable » au lieu de déclarer à tort un préréglage actif.

## Vérifications
Workflow `.github/workflows/edch-ingame-foot-v1618.yml` :
`npm run build`, `node --test test/*.test.mjs`, `cargo test`, `cargo check`.

Branche de développement : `feat/odyssey-commandes-configurables-jeu-v1.6.18-20261113`.
Installation prévue sur `/mnt/disque4/EDCH/compilation-cyberpunk/release/edch` après sauvegarde du binaire actuel.

## Références
- https://github.com/RealDogDad/elitedangerousbinds
- https://github.com/Ambient-Impact/Elite-Dangerous-bindings
- https://spacejock.com.au/EliteKeybinds.html
