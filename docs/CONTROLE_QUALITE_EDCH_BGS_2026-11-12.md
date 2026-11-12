# Rapport de contrôle qualité — EDCH BGS Manjaro v1.6.8.3

**Date :** 12 novembre 2026  
**Dépôt audité :** [philippe015/edch](https://github.com/philippe015/edch)  
**Base auditée :** `main` après fusion des PR #13 et #14 (commit `11149d178ea8ca9fe932a9937e0b668ae6f71650`).  
**Nature :** revue du code, des tests et des workflows GitHub Actions. **Pas de test sur l'ordinateur Manjaro, dans Elite Dangerous ou avec le HOTAS physique.**

## Synthèse

Le projet est **compilable** et ses tests automatisés dédiés passent. Les livrables d'installation multi-plateforme ne sont **pas validés par le workflow historique** à cause d'un échec de formatage. Les risques principaux concernent la **récupération des historiques CMDR**, la **vérification complète des missions Odyssey** et la **calibration du HOTAS sous Proton**.

**Statut recommandé : préversion communautaire**, pas encore version stable officiellement qualifiée.

## Résultats établis

| Domaine | Constat | Source |
| --- | --- | --- |
| TypeScript | Build réussi | [CI dédiée #43168472928](https://github.com/philippe015/edch/actions/runs/43168472928) |
| Tests Node.js | **279 tests réussis, 0 échec** | Même CI |
| Tests Rust | **34 tests réussis, 0 échec** | Même CI |
| `cargo check` | Réussi | Même CI |
| Compilation native Linux Tauri | Réussie | Même CI |
| Formatage Prettier | **52 fichiers non conformes** | [Build #43168473012](https://github.com/philippe015/edch/actions/runs/43168473012) |
| Installeurs multi-plateformes | Jobs ignorés à cause du job `test` historique échoué | Même Build |
| Dépendances Rust | `src-tauri/Cargo.lock` versionné et fusionné via PR #14 (519 paquets) | [PR #14](https://github.com/philippe015/edch/pull/14) |
| Licences/crédits | `LICENSE`, `NOTICE` et attribution originale conservés | Dépôt |
| Essais réels Odyssey / HOTAS / Proton | Non effectués par cet audit | Limite de méthode |

Le workflow `Build` exécute `npm test`, qui enchaîne `npm run build && npm run lint && node --test ...`. Comme `prettier --check .` échoue, ce workflow n'atteint pas ses tests Node et ne lance pas les jobs de distribution. **La CI dédiée effectue séparément les tests, qui réussissent.** Il ne faut pas confondre ces deux résultats.

## Constats détaillés et priorité

### P1 — Pipeline de distribution bloqué (confirmé)

**Sources :** `.github/workflows/build.yml`, `package.json`, journaux [#43168473012](https://github.com/philippe015/edch/actions/runs/43168473012).

- 52 fichiers signalés par Prettier : CSS, TypeScript, tests et vues.
- Le workflow historique `Build` s'arrête avant packaging Windows/Linux/ARM/Flatpak.
- La compilation native Linux de la CI dédiée est réussie, **mais ne prouve pas la génération correcte des installateurs AppImage/DEB/RPM**.

**Critères de sortie :** correction de formatage dans une PR séparée ; `npm test` réussi ; `cargo fmt --check` et `cargo clippy --all-targets -- -D warnings` ; vérification des artefacts Linux réellement produits. Éviter de mélanger un reformatage massif à des changements métier.

### P1 — Historique personnel CMDR : sauvegarde et restauration incomplètes (confirmé par le code)

**Sources :** `src/features/bgs/commander.ts` ; `src/views/bgs/index.ts`.

- L'historique BGS personnel est enregistré en `localStorage` avec une clé par CMDR, 1 200 entrées au maximum.
- `readCommanderLog` renvoie silencieusement un historique vide si le JSON est absent, trop grand (plus de 1,5 Mo) ou invalide, sans message permettant de distinguer ce cas d'un véritable historique vide.
- L'interface permet **CSV, sauvegarde JSON et suppression**, mais ne propose pas de restauration/fusion contrôlée du JSON exporté.
- Les compteurs observés dans les installations Manjaro sont passés de 89 à 8, 13 puis 16 activités ; la **cause de cette différence n'est pas établie** à partir des copies d'écran seules.

**Critères de sortie :** sauvegarde indépendante à chaque migration ; import JSON strictement validé ; aperçu avant restauration ; fusion par `key` sans doublons ; tests sur changement d'installation / redémarrage ; alerte si le stockage local est illisible ; jamais de suppression automatique sans confirmation.

### P1 — Missions Odyssey au sol : couverture fonctionnelle encore partielle (confirmé par le code)

**Sources :** `src/views/bgs/index.ts`, `src/game/activity/missions.ts`, `test/bgs-missions-odyssey-v1683.test.mjs`.

- La nouvelle section BGS montre les **missions actives du module Missions**, jusqu'à 40 éléments.
- Le type Odyssey est annoncé lorsque le nom de mission contient explicitement `OnFoot` ou `Odyssey`. Les autres restent « Non précisé », y compris certaines missions au sol.
- Les tests v1.6.8.3 inspectent principalement la présence de chaînes dans le code source ; ils ne rejouent pas de bout en bout un journal Odyssey pour vérifier la page BGS.
- Une mission terminée dans les faits n'est pas forcément `MissionCompleted` avant sa remise définitive au donneur.

**Critères de sortie :** jeux d'événements réels ou anonymisés `Missions`, `MissionAccepted`, `MissionCompleted`, redirections et destinations d'établissements ; tests d'intégration de la chaîne journal → état Missions → vue BGS ; scénario manuel Mission au sol acceptée → accomplie → remise.

### P2 — HOTAS X52 Pro : fonctions encore manuelles (confirmé)

**Sources :** `src/views/controls/x52ModesPanel.ts`, `src-tauri/src/hotas.rs`.

- Le code lit des événements Linux `/dev/input/jsN` et propose des plans pour les trois modes X52.
- La calibration des positions est tenue dans l'état de la vue et n'est pas enregistrée dans une configuration persistante.
- **Il n'existe pas de changement automatique de profil Elite Dangerous à la rotation du sélecteur**.
- L'équivalence entre indices Linux et identifiants `Joy_N` sous Proton n'est pas validée automatiquement.

**Critères de sortie :** persistance/chargement de la calibration liée à l'identité du périphérique ; tests des positions Linux 27/28/29 observées sur ce X52 Pro ; validation sous Proton/Elite avant toute tentative de remappage ; interdire une bascule non désirée dans les commandes du jeu.

### P2 — Version et reproductibilité

**Sources :** `package.json`, `src-tauri/tauri.conf.json`, `.gitignore`.

- La version des packages amont est `0.10.11`, tandis que le titre de fenêtre annonce la variante communautaire `BGS v1.6.8.3`.
- `Cargo.lock` est maintenant présent, mais le projet exclut `package-lock.json` : les dépendances NPM restent résolues au moment de l'installation.
- Risque de confusion pour nommer les artefacts, comparer les versions et configurer les mises à jour automatiques.

**Critères de sortie :** définir une version de distribution distincte et cohérente ; politique de versions et signatures du fork ; choisir une stratégie explicite pour verrouiller les dépendances Node sans casser la compatibilité amont.

### P2 — Sécurité : renforcement recommandé, aucun incident établi

**Sources :** `src-tauri/tauri.conf.json`, `src-tauri/src/http.rs`, `src-tauri/src/bgs_db.rs`, `src-tauri/src/controls_preset.rs`.

**Bonnes pratiques constatées :**
- Le backend HTTP restreint ses URL à une liste d'hôtes HTTPS autorisés et interdit les redirections.
- Les exports BGS natifs sont bornés et les fichiers .binds existants ne sont pas écrasés par l'éditeur de préréglages.
- Les requêtes SQLite sont paramétrées ; présence du journal WAL et du contrôle `quick_check`.

**À renforcer :**
- La politique CSP contient `script-src 'unsafe-inline'` et autorise les connexions vers `localhost:*` ; vérifier la nécessité de ces permissions.
- Aucun workflow dédié à `cargo audit`, l'audit des dépendances Node ou CodeQL n'apparaît dans `.github/workflows/`.
- Absence de validation de l'impact des dépendances nouvellement verrouillées sur les plateformes de distribution autres que Linux CI.

**Critères de sortie :** revue de surface d'attaque des commandes Tauri ; scan de dépendances avec traitement des faux positifs ; durcissement CSP après tests ; ne pas annoncer l'absence de vulnérabilités sur la seule base des tests fonctionnels.

## Vérifications recommandées sur Manjaro

Effectuer ces opérations **sans supprimer de dossiers ni écraser de sauvegardes** :

```bash
cd ~/EDCH-BGS-Manjaro-v1683
git fetch origin
git status --short
git log -1 --oneline
df -h / /home /mnt/disque6
```

Pour les tests : `npm run build`, `node --test test/*.test.mjs`, `cargo test --locked --manifest-path src-tauri/Cargo.toml` ; si l'espace disque est suffisant, faire ensuite une compilation vers un `CARGO_TARGET_DIR` situé sur un volume adapté. Ne pas lancer de deuxième instance EDCH simultanément pendant les essais sur le journal et les sauvegardes.

## Décision qualité

- **Base de développement : ACCEPTABLE**, avec tests TypeScript/Node/Rust validés et code principal versionné.
- **Release communautaire stable : NON QUALIFIÉE pour le moment**, notamment parce que le pipeline de packaging échoue avant de générer ses installeurs et que les tests en situation réelle sont incomplets.
- **Priorité immédiate :** sécuriser la restauration des historiques CMDR, assainir le workflow Build, confirmer les missions Odyssey sur Manjaro, puis valider la calibration X52.

Aucune donnée personnelle, clé API ni historique CMDR n'a été téléchargé ou copié lors de cet audit.

*Crédits du projet : BKNadir / CMDR MDLuffy ; contributions communautaires : Cyberpunk Philou.*
