# EDCH v1.6.8.2 — Factions des primes BGS

## Constat
Les systèmes des primes sont correctement affichés dans v1.6.8.1, mais « Faction(s) nommée(s) : non attribuée » peut persister.
Les événements de combat `FactionKillBond` fournissent normalement `AwardingFaction` et `VictimFaction`. Seul **AwardingFaction** désigne la faction attributrice. Les événements `Bounty` utilisent `Rewards[].Faction` et peuvent comporter plusieurs payeurs.

## Correctif
- Lire `AwardingFaction` de `FactionKillBond`, et les `Rewards[].Faction` de `Bounty`.
- Ne jamais attribuer `VictimFaction`, la faction contrôlant le système ni la faction suivie, comme faction bénéficiaire par simple supposition.
- Maintenir les clés d'événements v1.6.8.1 pour éviter les doublons.
- À la relecture des journaux au démarrage : **enrichir uniquement les entrées locales déjà enregistrées** dont la clé correspond. Aucun événement historique n'est ajouté.
- Préserver dates, montants, systèmes et factions déjà mentionnées dans les lignes sauvegardées.
- Les statistiques « événements liés à la faction suivie » se recalculent uniquement à partir des noms explicites du journal, sans estimations d'influence.

## Précautions
1. Avant installation, sauvegarder « activités CMDR JSON » et conserver le fichier dans un emplacement sûr.
2. Ne pas utiliser « Effacer mon historique CMDR ».
3. Fermer l'ancienne version EDCH avant de lancer celle-ci.
4. Ouvrir BGS → Systèmes et vérifier la colonne Faction(s) nommée(s) sur les 13 primes du 11/11/2026.
5. Si la colonne reste vide, fournir un extrait anonymisé du journal contenant `FactionKillBond` (en conservant `AwardingFaction`, `VictimFaction`, `Reward`, `timestamp`).

## Limites
Le journal peut ne plus être disponible sur la machine : dans ce cas EDCH n'invente pas une faction. Ce correctif ne fusionne pas les historiques locaux de différentes installations; comparer les exports séparément (89 vs 13 événements).

Crédits : auteur original CMDR MDLuffy ; extensions BGS/HOTAS Cyberpunk Philou.
