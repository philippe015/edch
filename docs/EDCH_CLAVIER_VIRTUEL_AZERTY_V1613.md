# EDCH Cyberpunk Philou v1.6.13 — Clavier virtuel AZERTY

## Fonction ajoutée
Dans **Commandes → Vaisseau / SRV-VRS / À pied**, sélectionner **Clavier AZERTY**. Un clavier français virtuel ISO apparaît directement sous les cartes de profils préparés.

Le clavier représente :
- les touches de fonction **Échap et F1–F12** ;
- le pavé alphanumérique **AZERTY**, avec **ZQSD** ;
- **Espace, Maj, Ctrl, Tab, Alt, Alt Gr et Entrée** ;
- les touches de navigation, les flèches directionnelles et le pavé numérique.

### Voir les affectations
- **Vert/bleu** : une ou plusieurs commandes réellement enregistrées dans le fichier `.binds` choisi pour le contexte.
- **Orange** : une nouvelle affectation dans le brouillon préparé (pas encore enregistrée).
- **Gris** : aucune affectation connue pour cette touche dans le contexte.
- Les touches affectées portent un **petit libellé de la première commande** et un compteur.
- **Clic sur une touche** : afficher la liste complète des actions, le caractère principal/secondaire, et si elle sert de modificateur.
- Lorsqu'un brouillon remplace un raccourci, l'ancienne touche n'est pas faussement présentée comme toujours active dans l'aperçu.

### Fonctionnement
Les touches affichées sont établies d'après le référentiel de clavier déjà présent dans le projet (`KEY_IDS.azerty` et `KEY_CAPS.azerty`). Les données sont celles du **fichier .binds personnel réellement sélectionné**, pas des réglages inventés.

Ce clavier est un **visualiseur** : cliquer ne simule pas de frappe dans Elite Dangerous, n'attribue pas automatiquement une touche et ne modifie aucun fichier. Pour préparer un nouveau préréglage, utiliser les cartes de profils et le brouillon existants, puis confirmer explicitement la création d'un **nouveau** `EDCHProNNN.4.x.binds`.

**Note :** si le jeu déclare un clavier QWERTY dans la source, EDCH affiche son avertissement existant. Vérifier la disposition AZERTY dans le jeu avant d'appliquer un profil.

### Données préservées
- Fichiers d'origine `.binds`, fichiers StartPreset, commandes HOTAS X52 Pro et Xbox.
- BGS, bases SQLite, fichiers de journaux et rapports.
- Diagnostics du stockage de la v1.6.11.
- Profils préparés de la v1.6.12.

## Installation Manjaro
Branche : `feat/commandes-clavier-azerty-virtuel-v1.6.13-20261113`.
Compiler et tester d'abord dans un répertoire provisoire **sur /mnt/disque4**. Ne remplacer l'exécutable `/mnt/disque4/EDCH/compilation-cyberpunk/release/edch` qu'après compilation et vérification des bibliothèques, avec sauvegarde datée de l'exécutable existant. Ne pas effacer `~/.local/share/EDCompanionHelper`.

## Tests
Workflow `.github/workflows/edch-virtual-azerty-v1613.yml` :
- `npm run build`
- `node --test test/*.test.mjs`

Les tests de non-régression couvrent la disposition AZERTY, l'affichage contextuel, les raccourcis avec modificateurs, la différence entre profil actuel et brouillon, et l'absence de modification des commandes par le visualiseur.
