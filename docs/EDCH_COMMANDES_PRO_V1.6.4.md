# EDCH v1.6.4 - Commandes PRO

Contribution non officielle pour la branche EDCH BGS v1.6.3, base exacte
`4196f6916e6ecaa83fbf337028ec9d9bb0fcf2cc`.

## Objectif

Consolider l'onglet **Commandes** sans écrire dans Elite Dangerous.

1. Inventaire par périphérique à partir des affectations XML `.binds` déjà chargées :
   nombre d'affectations, actions, entrées distinctes et axes.
2. Contrôle des touches utilisées par plusieurs actions dans un même groupe :
   **suggestion de vérification**, pas preuve d'un conflit dans le jeu.
3. Repérage de certaines actions du référentiel non affectées : leur absence
   est *optionnelle* et ne doit jamais bloquer le jeu.
4. Vérification du référentiel français explicite ; une traduction générique
   n'est pas une erreur et les codes techniques du jeu ne sont pas modifiés.
5. Comparateur local de deux fichiers `.binds` : ajouts, retraits,
   changements de touches, modificateurs, axes/inversions.
6. Export CSV des différences (protection contre les cellules-formules).
7. Export d'un **vrai PDF A4** du diagnostic, produit entièrement hors ligne.

## Contraintes techniques et limites

- Le fichier `.binds` est une description de configuration, **pas la preuve qu'un
  périphérique X52 Pro est actuellement connecté**. Aucune lecture HID directe.
- Les profils sont comparés fichier par fichier (pas fusion de profils `StartPreset`).
- Pas d'éditeur HOTAS, pas d'écriture du jeu, pas de changement d'affectation.
- Diagnostic limité aux premières 20 000 affectations, comparaison limitée à 1 500
  différences et 100 différences affichées pour garder l'interface réactive.
- Le PDF est en police PDF WinAnsi : certains caractères rares hors latin
  peuvent être remplacés par `?`.
- Aucun envoi internet, aucun journal personnel ou clé API.
- Les fonctions BGS v1.6.3 et les traductions françaises existantes restent intactes.
- Crédits : auteur original CMDR MDLuffy, contribution Cyberpunk Philou.

## Validation

Tests du moteur pur, CSV, PDF et contrôles d'intégration ajoutés.
La compilation native Tauri / Rust sous Manjaro doit être confirmée sur
la branche publiée ; ne pas annoncer de build natif réussi sans l'exécuter.
