# EDCH BGS v1.6.8.1 — Systèmes des primes

## Cause
Le journal Elite Dangerous omet souvent `StarSystem` dans `Bounty`, `FactionKillBond` et `RedeemVoucher`. La version précédente regardait seulement le champ de l'événement et affichait « non indiqué ».

## Correctif
- Corrélation uniquement en ordre chronologique avec `Location`, `FSDJump`, `CarrierJump` et `Docked`.
- Séparation stricte des sessions et commandants ; pas de corrélation à travers un `Shutdown`, `LoadGame` ou un début de saut hyperspatial.
- Pas de contexte au-delà de 24 heures ou venant du futur.
- Pour `Bounty` et `FactionKillBond`, système du combat si observé ; pour `RedeemVoucher`, lieu d'encaissement uniquement.
- Au démarrage, les événements historiques sont analysés **seulement pour compléter un système absent sur une activité déjà enregistrée**, en conservant la clé, la date, la faction et les crédits. Aucune nouvelle activité BGS historique, visite ou point d'influence n'est inventé.
- Source de localisation (explicite / contexte) conservée pour la traçabilité.

## Installation
Installer sur la branche v1.6.8, fermer EDCH, sauvegarder son historique CMDR JSON, compiler avec `npm run build && node --test test/bgs-primes-systemes-v1681.test.mjs && cargo test --manifest-path src-tauri/Cargo.toml && npm run app:build`, puis démarrer le binaire Linux.

**Limite :** si le journal ancien ne contient aucune localisation fiable avant la prime, la valeur reste « non indiqué ». L'encaissement ne révèle pas automatiquement le système du combat.
