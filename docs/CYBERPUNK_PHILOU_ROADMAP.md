# Cyberpunk Philou — feuille de route du fork EDCH BGS

Date de démarrage : 12 novembre 2026. Dépôt de développement : https://github.com/philippe015/edch

## Objectif

Faire évoluer le fork personnel EDCH BGS en copilote Cyberpunk Philou pour Elite Dangerous sur Manjaro : pilotage **assisté**, suivi des factions, missions Odyssey, itinéraires, HOTAS X52 Pro, commandes vocales et agents spécialisés.

Le projet évolue indépendamment des décisions de fusion de BKNadir. Le code initial reste sous licence MIT : conserver LICENSE, NOTICE, les attributions du projet d'origine et celles des données tiers. Ne jamais prétendre être une édition officielle de Frontier.

## État du premier jalon

- Identité Cyberpunk Philou dans la barre supérieure et le titre de fenêtre.
- Thème Cyberpunk sélectionnable et nouveau thème par défaut **pour les nouveaux profils uniquement** ; les réglages des profils existants sont préservés.
- Copilote BGS local dans l'onglet Agent COG : commandes simples (prochaine cible, itinéraire, statut), suggestion établie sur le plan de patrouille existant, copie volontaire d'une destination.
- Pas de touche envoyée au jeu, de déplacement du curseur, de saut FSD, de lecture de mémoire du processus ni d'interface privée.
- L'identifiant Tauri EDCompanionHelper reste inchangé pour préserver les données locales.
- Vérification des mises à jour dirigée vers le fork personnel plutôt que vers les publications de BKNadir. Aucune distribution n'est validée tant que le workflow historique échoue.
- Les agents COG existants restent déterministes : **ne pas les présenter comme des agents Mistral déjà connectés**.

## Prochaines étapes techniques

### P1 — Stabilisation
Corriger la CI historique et Prettier, tester les sauvegardes et restaurations SQLite / localStorage, sécuriser la gestion des clés API et vérifier les historiques BGS. Ne pas perdre les données existantes.

### P2 — Agents supervisés
Créer un orchestrateur séparant Observateur (journal + Status.json), Analyste BGS, Planificateur, Vérificateur et Exécutant de commandes **autorisées localement**. Toute proposition garde sa source, son horodatage, son niveau de confiance et un journal d'audit.

Commencer en mode règles locales. Ajouter éventuellement Mistral uniquement sur activation explicite avec clé stockée hors des bundles et des dépôts Git, consentement sur les champs transmis et validation stricte de chaque réponse. Les appels à un modèle ne sont pas des preuves d'événements de jeu.

### P3 — Interactions joueur
Afficher une fenêtre compacte ou un HUD externe ; lecture vocale des alertes ; préparation de trajet et copie de noms de systèmes ; raccourcis d'ouverture de pages et de réglages dans le compagnon. La destination est saisie/confirmée par le joueur sur la carte galactique.

### P4 — Automatisations permises
Automatiser le classement de l'historique, les priorités de patrouille, les rappels de tick, les alertes de missions et la préparation de rapports. Aucun bot de jeu autonome, aucune injection mémoire, aucun contournement de protection ni simulation de joueur.

## Limite technique et juridique

Le Journal et Status.json sont des fichiers générés par Elite Dangerous, adaptés à un compagnon en lecture seule. Leur contenu ne constitue pas une API permettant d'ordonner un tracé de route sur la carte galactique.

Les règles Frontier restreignent les logiciels d'automatisation non autorisés et les bots. Les fonctions qui agiraient réellement dans le client du jeu ne doivent pas être présentées comme compatibles sans vérification d'autorisation expresse.

## Critères de validation

1. Le navigateur démo et l'application Tauri démarrent, sans modification du répertoire de données existant.
2. Les quatre tests du copilote réussissent, sans réseau ni accès au jeu.
3. Aucun ancien historique CMDR, cache BGS, preset HOTAS ou profil SQLite n'est supprimé.
4. La CI historique et la compilation Linux sont vérifiées séparément ; un échec préexistant n'est pas masqué.
5. Les fonctionnalités futures passent par un mode test, un interrupteur et des validations explicites avant activation.
