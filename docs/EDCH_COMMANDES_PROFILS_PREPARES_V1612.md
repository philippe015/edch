# EDCH Cyberpunk Philou v1.6.12 — Commandes façon Elite Dangerous

## Principe
L'éditeur **Commandes** conserve les trois contextes **Vaisseau**, **SRV / VRS** et **À pied**. Il affiche les commandes du fichier Elite Dangerous sélectionné sous forme de rubriques (pilotage, navigation/FSD, combat, scanners, conduite SRV, exploration, déplacements à pied).

Il propose **quatre profils préparés par contexte et par famille de périphériques** : polyvalent, navigation/BGS, combat, exploration.

### Clavier AZERTY
Les douze modèles couvrent des affectations concrètes préparées à partir des identifiants de commandes du jeu.

Exemples :
- **Vaisseau polyvalent** : propulseurs ZQSD, R/F pour les propulseurs verticaux, J pour FSD, L pour train, T pour cible, H pour soute.
- **Vaisseau combat** : T cible, Y cible hostile suivante, C leurres, U déploiement d'armes, Tab boost.
- **Vaisseau exploration** : J FSD, M carte galactique, N carte système, V scanner FSS (si cette commande existe dans le fichier source).
- **SRV polyvalent** : Z/S accélération/freinage, Q/D direction, Espace frein à main, T tourelle, F éclairage.
- **À pied essentiel** : ZQSD, E interaction, R rechargement, F lampe, Espace saut.

Ces affectations sont **des propositions Cyberpunk Philou, et non les touches officielles par défaut**. L'utilisateur doit les examiner selon ses préférences et vérifier leur disponibilité dans le jeu.

Les modèles ne proposent une commande que si celle-ci est présente dans le `.binds` personnel Odyssey avec un emplacement principal ou secondaire éditable. Aucune action inventée n'est créée.

Si le clavier occupe déjà un emplacement, l'éditeur privilégie l'emplacement libre. Si les deux sont occupés, seul un emplacement clavier peut être réaffecté **dans le nouveau brouillon** ; aucune attribution HOTAS, manette, souris ou axe n'est écrasée.

Une touche utilisée par une autre action du même contexte est rejetée, sauf si elle est libérée par une modification de ce même brouillon. Les profils restent consultables même si certaines suggestions doivent être ignorées.

### HOTAS X52 Pro et Xbox
Les profils prêts à préparer utilisent uniquement les boutons **déjà présents dans le .binds d'Elite Dangerous**. Les numéros Linux des joysticks et les noms XInput ne sont pas convertis arbitrairement en codes de jeu.

Si aucun bouton sûr n'est détecté, le programme l'indique et n'invente aucune affectation. L'utilisateur peut configurer une action directement dans Elite Dangerous puis actualiser les commandes EDCH.

### Création d'un profil
1. Fermer Elite Dangerous pour l'enregistrement.
2. Aller dans **Commandes**, choisir l'onglet Vaisseau, SRV ou À pied.
3. Sélectionner le fichier `.binds` personnel (Custom ou autre).
4. Choisir Clavier AZERTY, HOTAS X52 Pro ou Xbox.
5. Cliquer sur une carte **Préparer · ...**.
6. Examiner la liste des ajouts et remplacements, les avertissements, et retirer toute attribution non désirée.
7. Confirmer la création. EDCH crée un **nouveau** fichier `EDCHProNNN.4.x.binds` sans toucher au fichier source.
8. Dans Elite Dangerous, sélectionner ce nouveau préréglage dans Options → Commandes. Le jeu peut disposer de catégories de préréglages distinctes.

**Ne pas effacer** les anciens profils, le dossier `~/.local/share/EDCompanionHelper`, les journaux ni les fichiers Steam/Proton.

## Sécurité
- L'éditeur n'envoie pas de touches en direct au jeu.
- Aucun fichier source n'est écrasé. Nouveau profil avec écriture `create_new`.
- L'enregistrement est interdit pendant que le jeu ou le lanceur sont détectés en cours d'exécution.
- Une liste blanche étroite de codes AZERTY connus est autorisée pour les modèles clavier.
- Les identifiants HOTAS/Xbox ne sont **jamais** inventés : les candidats doivent exister dans le source.
- Les axes analogiques ne sont pas modifiés.
- Les historiques BGS et données SQLite ne sont pas touchés.

## Vérifications
Workflow GitHub `.github/workflows/edch-controls-v1612.yml` :
`npm run build`, `node --test test/*.test.mjs`, `cargo test --manifest-path src-tauri/Cargo.toml`, `cargo check --manifest-path src-tauri/Cargo.toml`.

### Installation Manjaro
L'installation peut remplacer uniquement l'exécutable dans :
`/mnt/disque4/EDCH/compilation-cyberpunk/release/edch`

La branche de développement est :
`feat/elite-commandes-profils-prepares-v1.6.12-20261112`

Elle n'est pas installée automatiquement sur le PC. Conserver une sauvegarde horodatée du binaire actuel, puis ne remplacer qu'après compilation et tests réussis.
