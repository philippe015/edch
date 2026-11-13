# EDCH Cyberpunk Philou v1.6.21 — Profils nommés et préréglages étendus Odyssey

## Diagnostic de la capture (13/11/2026)

Dans **Elite Dangerous → Options → Commandes au sol → Préréglages**, le menu montre des fichiers historiques `EDCHPRO0001` à `EDCHPRO0004`. Le profil sélectionné conserve **Avancer [W]**, **Reculer [S]**, **Déplacement gauche [Q]**, **Déplacement droite [D]**.

Ces anciennes entrées proviennent de noms numérotés : l'ancienne commande Rust nommait chaque nouvel enregistrement `EDCHProNNN`. Les propositions AZERTY préparées auparavant ne réaffectaient qu'une dizaine d'actions ; tous les raccourcis non touchés étaient copiés depuis le fichier source. Une capture ne permet pas de savoir quel fichier exact a produit chaque ancienne entrée.

## Nouveaux noms stables dans le jeu

L'éditeur propose un nom qui reste identique lors des mises à jour :

- **À pied, clavier AZERTY, polyvalent** : `EDCH_PIED_AZERTY_POLY`
- **À pied, clavier AZERTY, navigation** : `EDCH_PIED_AZERTY_NAV`
- **À pied, clavier AZERTY, combat** : `EDCH_PIED_AZERTY_COMBAT`
- **À pied, clavier AZERTY, exploration** : `EDCH_PIED_AZERTY_EXPLORATION`
- Les profils Xbox, X52 Pro, Vaisseau et SRV suivent le même schéma `EDCH_<MODE>_<PÉRIPHÉRIQUE>_<USAGE>`, en ASCII.

Le nom peut être édité : il doit commencer par `EDCH_`, contenir seulement **A–Z, 0–9, _**, jusqu'à **40 caractères**. Le nom est utilisé à la fois comme nom de fichier et dans `<Root PresetName="...">` : **le jeu affiche le bon nom, pas EDCHPro001, EDCHPro002, etc.**

Lorsqu'un fichier nommé existe déjà, un bloc visible propose une **mise à jour explicite**. Sans confirmation, le moteur refuse le remplacement. Lorsqu'il est autorisé et lorsque le jeu ET le lanceur sont fermés :

1. Le nouveau XML est composé et toutes les modifications sont validées **avant** toute opération sur disque.
2. L'ancienne version du profil nommé est déplacée dans `Bindings/EDCH_Backups/`.
3. La nouvelle version est placée sous le même nom. En cas d'échec, le moteur tente de restaurer la précédente.
4. Les modifications sont vérifiées à nouveau en relisant le fichier enregistré.

Aucun fichier `Custom`, aucun fichier `Saitek X52`, aucun ancien `EDCHProNNN` n'est remplacé par cette opération. Les fichiers `.binds` d'origine restent inchangés, sauf lorsqu'on choisit **explicitement de mettre à jour** un profil nommé `EDCH_...`, avec sauvegarde.

**Versions d'Odyssey :** si plusieurs fichiers de versions mineures différentes portent le même nom (par exemple `EDCH_...4.1.binds` et `EDCH_...4.2.binds`), le moteur refuse le mélange et demande un archivage explicite du doublon. Pas de fausse fusion automatique.

## Nouveaux préréglages À pied AZERTY

Une bibliothèque étendue couvre les commandes à pied existantes du référentiel Odyssey : déplacements, combat, recharge d'arme, borne Energy Link, interactions, outils, grenades, soins, cartes, communications, roues d'objets, émotes, raccourcis et fonctions avancées.

- **Déplacement : Z / Q / S / D** et non W / Q / S / D pour le modèle français affiché dans l'éditeur.
- **Saut : Espace ; course : Maj gauche ; accroupissement : Ctrl gauche.**
- **Interaction : E ; recharger l'arme : R ; lampe : F ; sortir Energy Link : 3.**
- **Tir : souris gauche ; visée : souris droite ; interaction secondaire : clic molette**, uniquement si les codes souris sont déjà présents et disponibles dans le profil source.
- **Armes 1/2, outils 4/5/6, soins 7, énergie 8, grenades 9 et 0**, ainsi que les fonctions F1–F12 et le pavé numérique, selon les actions disponibles et les conflits.
- Les axes de la souris, les axes HOTAS X52 Pro, les commandes de vaisseau/SRV et les entrées manette ne sont jamais réécrits par le préréglage AZERTY à pied.

Les propositions sont des **choix Cyberpunk Philou**, pas les touches officielles Frontier. La liste `FULL_FOOT_AZERTY_RULES` fournit les choix de touches ; seules les actions réellement présentes dans le `.binds` peuvent être modifiées.

### Compte rendu avant création
La section **Couverture des commandes à pied** affiche :
- le nombre d'actions reconnues ;
- les propositions clavier/souris, les affectations déjà conformes ;
- les axes préservés ;
- les commandes encore sans affectation ;
- les modifications refusées pour action absente, bouton inconnu ou conflit.

Ce rapport évite d'affirmer à tort que « toutes les touches » sont configurées lorsqu'il manque des actions ou qu'un conflit nécessite un réglage manuel. Les propositions sont consultables dans le brouillon et peuvent être retirées avant l'enregistrement.

### AZERTY et jeu
La génération d'un profil explicitement `À pied → Clavier AZERTY` renseigne `<KeyboardLayout>fr-FR</KeyboardLayout>` dans **le nouveau fichier seulement**, quand la balise existe dans le source. Les autres profils conservent le clavier déclaré par leur source.

Après enregistrement, quitter EDCH si nécessaire, lancer Odyssey, ouvrir **Options → Commandes → Au sol / À pied → Préréglages** et choisir le **nom exact** affiché (exemple `EDCH_PIED_AZERTY_POLY`). Ne pas sélectionner une ancienne entrée `EDCHPRO0003`.

La touche réellement reconnue dans le jeu est prioritaire : si une touche semble erronée, contrôler `Bindings/BindingLoadingErrors.log`, le clavier sélectionné, et les avertissements de conflits.

## Archiver les anciens EDCHPro numérotés

La section **Nom du préréglage dans le jeu** indique les anciens profils `EDCHPro001` et `EDCHPRO0004` détectés.

Bouton : **Archiver les anciens EDCHPro inutilisés**. L'action nécessite confirmation, jeu et lanceur fermés. Le moteur :
1. lit les fichiers `StartPreset` pour identifier les noms actifs dans les quatre catégories ;
2. refuse d'archiver la sélection actuelle et les préréglages actifs ;
3. accepte uniquement les fichiers `EDCHPro[0-9]{3,5}.4.x.binds` (racine `PresetName` correspondante, fichiers non symboliques et taille bornée) ;
4. déplace les anciens fichiers vers `Bindings/EDCH_Backups` en les renommant `.binds.bak`.

**Ce n'est pas une suppression :** l'utilisateur peut restaurer ces fichiers depuis le dossier de sauvegarde. Si `StartPreset` est absent, le nettoyage est **refusé**.

Pour réduire le menu du jeu au minimum, **activer d'abord le nouveau profil nommé**, fermer le jeu, puis demander l'archivage des anciens. Un `EDCHPro` toujours actif restera visible jusqu'à ce qu'il soit désélectionné.

## Sécurité et confidentialité

- Travail local, pas d'envoi de fichiers de commandes à un service externe.
- Pas d'injection de touches, de clics dans les menus du jeu, ni de modification de `StartPreset` à la place du joueur.
- Les fichiers d'origine, BGS, bases SQLite, données HOTAS et commandes existantes restent conservés ; écriture du profil nommé seulement sur confirmation.
- Le générateur vérifie les codes d'entrée sur liste autorisée, le chemin et le format du fichier, puis l'exactitude des écritures. Les fichiers / liens symboliques suspects sont refusés.
- 96 changements maximum pour une génération nommée (les anciens générateurs restent compatibles).

## Validation

Workflow `.github/workflows/edch-named-odyssey-v1621.yml` :
`npm run build`, `node --test test/*.test.mjs`, `cargo test --manifest-path src-tauri/Cargo.toml`, `cargo check --manifest-path src-tauri/Cargo.toml`.

Branche :
`feat/profils-nommes-complets-odyssey-v1.6.21-20261113`.

Le test automatisé de réécriture de fichier ne remplace pas un contrôle visuel de la liste de préréglages dans Elite Dangerous sous Manjaro/Proton.
