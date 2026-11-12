# Publication EDCH BGS Manjaro v1.4.9.2 sur GitHub

## État

La branche `feat/bgs-manjaro-v1.4.9.2-complet-20261108` a été créée dans le fork `philippe015/edch` à partir du commit de la PR amont #2 (`ed240d3569954dc4deeb39d01a0f9b7fd2cef9ce`). Elle contient donc déjà les fonctionnalités BGS de la v1.4.2. **Les modifications locales postérieures à la v1.4.2 ne se trouvent pas sur GitHub tant que le script de publication n'a pas été exécuté sur Manjaro.**

ChatGPT ne peut pas lire automatiquement les fichiers courants de `~/EDCH-BGS-Manjaro`. Les archives de correctifs générées antérieurement ont permis de connaître les fichiers à publier, mais **les fichiers installés et compilés sur le Manjaro de l'utilisateur sont la référence**. La publication complète doit donc partir de cette copie locale.

## Exécution (Manjaro)

Télécharger `EDCH_PUBLICATION_GITHUB_v1492.zip` et exécuter :

```bash
cd ~/Téléchargements
unzip -o EDCH_PUBLICATION_GITHUB_v1492.zip
cd EDCH_PUBLICATION_GITHUB_v1492
./publier_edch_v1492_manjaro.sh --check
./publier_edch_v1492_manjaro.sh --publish 2>&1 | tee ~/edch-github-v1492.log
```

Le script clone une **copie indépendante** de la branche GitHub existante dans `/tmp/edch-publication-v1492-*`, puis y copie **31 fichiers autorisés** du prototype local. Aucun fichier `.binds`, sauvegarde, base SQLite, journal du jeu, répertoire personnel, `.env` ou jeton n'est ajouté. Il utilise la session déjà connectée de `gh`, vérifie la présence des modules v1.4.9.2, lance `npm test` et `cargo check`, puis fait le commit et le push **uniquement si ces tests réussissent**. Optionnel : `EDCH_TEST_NATIVE=1 ./publier_edch_v1492_manjaro.sh --publish` lance aussi `npm run app:build` dans la copie indépendante.

Une Pull Request en brouillon est créée sur **le fork** (vers `philippe015/edch:main`) si elle n'existe pas. La PR amont [BKNadir/edch#2](https://github.com/BKNadir/edch/pull/2) reste inchangée. Vérifier le diff sur GitHub avant toute fusion.

## Fonctions incluses dans la publication

- v1.4.2 déjà dans GitHub : BGS, suivi CMDR, historique d'influence, patrouilles, systèmes de faction, contrôles et traductions.
- v1.4.3 : véritables PDF BGS.
- v1.4.4 : éditeur clavier Odyssey « À pied » et préréglage distinct du HOTAS.
- v1.4.8 : notifications à l'endroit ; correction des 20 traductions manquantes.
- v1.4.9 : sauvegarde JSON BGS native et diagnostic PDF.
- v1.4.9.1 : missions d'escadrille avec confirmation manuelle, explicitement non vérifiée par le journal.
- v1.4.9.2 : changement de faction sans écraser les données des autres factions.

## Contrôles, limites et journal

Le fichier `publier_edch_v1492_manjaro.sh` vérifie seulement les sources. Pour vérifier l'état des données et les comportements du jeu, il faut des essais fonctionnels dans EDCH sur le PC et avec les membres d'escadrille. Le script refusera la publication si un module requis manque ou si la compilation de contrôle échoue ; en cas d'échec, consulter les dernières lignes de `~/edch-github-v1492.log` et le dossier temporaire affiché par le script. Ne pas mettre ce journal en ligne sans en retirer les informations privées.