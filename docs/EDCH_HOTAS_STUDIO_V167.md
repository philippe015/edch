# EDCH BGS v1.6.7 — HOTAS Studio (Manjaro / X52 Pro)

**Statut : contribution non officielle, à tester sur le matériel de l'utilisateur.**
Base : branche `feat/commandes-intelligentes-v1.6.6-20261111`. Les fonctions BGS, traductions françaises, rapports HTML, crédits CMDR MDLuffy et Cyberpunk Philou, et la création de nouveaux profils `.binds` sont préservés.

## Fonctionnement ajouté

Dans **Commandes → Commandes PRO v1.6.6**, une nouvelle carte **HOTAS Studio v1.6.7** apparaît dans l'atelier d'affectation.

- Détection explicite des joysticks Linux `js0`, `js1`, etc. via `/sys/class/input` et leurs entrées de lecture `/dev/input/jsN`. Un nom contenant **X52** permet d'identifier un candidat Logitech/Saitek X52 ; un périphérique non trouvé n'est pas inventé.
- Capture sur demande d'une **pression sur un bouton** du joystick pendant 10 secondes. Les indices renvoyés par Linux commencent à zéro. L'application affiche le numéro brut et ne présume **jamais** que celui-ci est le numéro `Joy_n` d'Elite Dangerous sous Proton.
- Capture sur demande d'un mouvement **d'axe analogique** avec seuil anti-bruit, **diagnostic seulement**, sans possibilité d'édition d'axe dans cette version.
- Présentation visuelle schématique du joystick et de la manette des gaz. Les nombres affichés sont extraits du profil `.binds` sélectionné : ils ne doivent pas être interprétés comme un relevé matériel complet.
- Suggestions de correspondance `Joy_n` uniquement si le bouton proposé **existe déjà** dans les données `SaitekX52Pro` du fichier source, sans modificateur. Linux et Elite/Proton peuvent avoir une correspondance **directe ou +1** : toutes les correspondances compatibles apparaissent à choisir, jamais affectées automatiquement.
- Lorsque l'utilisateur sélectionne une correspondance, elle remplit simplement la sélection de l'éditeur v1.6.6. L'utilisateur choisit ensuite son action, l'ajoute au **brouillon**, l'examine et valide la création d'un **nouveau** profil `EDCHProNNN.4.x.binds`.

## Sécurité et compatibilité

- Pas d'injection de touches, d'interaction automatique avec la fenêtre Elite Dangerous ni de changement de périphérique à distance.
- La lecture matérielle est Linux uniquement. Windows, démo et accès distant ne sont **pas** annoncés compatibles.
- Les chemins sont limités aux noms `jsN` strictement validés et aux périphériques caractères `/dev/input/jsN` déjà identifiés par sysfs. Aucune écriture dans `/dev/input`, `/sys`, `/proc` ou dans le jeu.
- Les événements d'initialisation joydev, les relâchements et les bruits mineurs d'axe sont ignorés.
- Les données des anciens profils `.binds`, `StartPreset`, SQLite BGS, IndexedDB, traductions et historique ne sont pas modifiées.
- La capture nécessite des permissions Linux de lecture du joystick. Ne pas lancer EDCH avec `sudo` ; ne pas octroyer l'accès global à `/dev/input` sans examen de la configuration.

## Vérifier sur Manjaro

```bash
ls -l /dev/input/js* 2>/dev/null
ls -l /sys/class/input/js* 2>/dev/null
# Si aucun /dev/input/jsN alors que le HOTAS est connecté :
lsmod | grep joydev
# Un chargement temporaire, seulement si le module est disponible :
sudo modprobe joydev
```

Après compilation et lancement habituel d'EDCH sous X11 :

1. Ouvrir **Commandes**, sélectionner le profil `.binds` utilisé dans Elite Dangerous.
2. Dans **HOTAS Studio**, cliquer sur **Rechercher le HOTAS** ; confirmer le nom physique (ex. Saitek X52 Pro) et le statut de lecture.
3. Cliquer sur **Capturer un bouton** puis appuyer sur une touche du X52. L'application doit afficher `Bouton physique Linux n° ...`.
4. Si une ou plusieurs correspondances existent dans le `.binds`, sélectionner **Choisir cette touche** après vérification de la correspondance. Sinon aucune attribution ne sera préparée ; il faut créer l'affectation dans Elite Dangerous pour découvrir son identifiant et retester.
5. Choisir une commande et un emplacement principal/secondaire, puis **Ajouter au brouillon** et confirmer la création d'un **nouveau** profil (jeu fermé).
6. Redémarrer Elite Dangerous et choisir explicitement le profil créé dans **Options → Commandes → Préréglages**, pour la section concernée.

**Important :** le mapping `jsN bouton k → Elite Joy_n` dépend de Proton/DirectInput et n'est pas certifié par une capture Linux. Le bouton physique capturé doit être comparé aux commandes du jeu. Le X52 Pro est parfois exposé comme plusieurs entrées, sans garantie de correspondance individuelle joystick/manette des gaz.

## Commandes de test

```bash
npm install --no-package-lock
npm run build
node --test test/*.test.mjs
cargo test --manifest-path src-tauri/Cargo.toml
cargo check --manifest-path src-tauri/Cargo.toml
npm run app:build
```

Les tests Linux réellement exécutés sur le périphérique de l'utilisateur restent nécessaires avant d'affirmer la validation matérielle.
