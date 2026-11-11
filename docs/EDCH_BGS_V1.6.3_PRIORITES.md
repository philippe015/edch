# EDCH BGS v1.6.3 — Priorités & clarté des alertes

Branche de contribution non officielle basée sur v1.6.2, sans fusion vers `main`.

## Pourquoi

Le tableau affichait `0 Alertes à vérifier` alors que le panneau Agent COG affichait 306 alertes actives. Ce ne sont pas les mêmes indicateurs : le premier comptait uniquement des variations récentes de tendance, le second inclut les visites anciennes et les données communautaires périmées, généralement classées comme « Suivi ».

## Modifications

- La carte globale est renommée `Variations récentes à vérifier` pour dire ce qu'elle compte réellement, sans modifier l'algorithme de tendances.
- Dans Agent COG, la répartition exacte des alertes **non masquées** indique `Priorité élevée`, `À vérifier` et `Suivi`.
- Une explication explicite distingue les alertes informatives des urgences possibles et ne confond pas horodatages Spansh et tick Frontier.
- Bouton `Réinitialiser recherche et filtres` : remet les critères v1.6.2 à zéro **uniquement pour cette vue**. Les paramètres d'alertes, les alertes masquées, l'historique BGS, IndexedDB et la mémoire SQLite sont inchangés.
- Test de régression des compteurs, du cas 306 suivis / 0 prioritaires, de l'absence de mutation et de la terminologie du tableau de bord.

## Compatibilité / sécurité

Les 4 onglets BGS, le menu original EDCH, les traductions françaises, les crédits CMDR MDLuffy et Cyberpunk Philou, la file Worker et la mémoire SQLite sont conservés. Pas de Mistral, pas d'écriture de commandes dans le jeu, pas d'estimation arbitraire d'influence.

## Tests

`npm run build && node --test test/*.test.mjs` (projet complet), puis `cargo test --manifest-path src-tauri/Cargo.toml` et `npm run app:build` dans Manjaro. Le test isolé et la CI de la branche de contribution sont distincts des tests natifs de Manjaro. L'ancienne CI `npm test` peut toujours échouer si le formatage Prettier de l'amont n'est pas corrigé.
