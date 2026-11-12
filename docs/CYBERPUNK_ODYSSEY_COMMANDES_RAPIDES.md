# Cyberpunk Philou — Réglage rapide des commandes à pied (Odyssey)

## Accès
Dans **Commandes → À pied**, la section « Réglage rapide · commandes à pied » apparaît avant les éditeurs experts.

## Configurer une touche

1. Utiliser les onglets Essentielles, Déplacement, Combat, Équipement ou Autres ; ou rechercher une action en français.
2. Repérer la commande, la touche principale (**P**) et secondaire (**S**) affichées.
3. Cliquer sur **Changer P** ou **Changer S**, puis appuyer sur la touche voulue.
4. Répéter autant que nécessaire. Les touches modifiées restent uniquement dans un **brouillon**.
5. Examiner les éventuelles collisions. Retirer les affectations indésirables.
6. **Fermer Elite Dangerous** avant toute sauvegarde. Cliquer sur « Créer le profil EDCHFoot » et confirmer la création.
7. Redémarrer Elite Dangerous → Options → Commandes → À pied → sélectionner le nouveau préréglage **EDCHFoot…** → Appliquer.

Pour annuler une capture, appuyer sur **Échap**. Si un emplacement appartient à la souris, à la manette ou au HOTAS, le bouton correspondant est désactivé : le profil original n'est pas modifié.

## Suggestions AZERTY

Le bouton « Préparer des touches AZERTY » propose les touches ZQSD, saut, course, accroupissement, interaction, rechargement et lampe torche. Il **n'applique rien automatiquement** et ignore les touches déjà utilisées, les actions absentes du fichier et les emplacements qui protègent la souris ou le HOTAS.

Une touche non proposée n'est pas forcément un bogue : elle peut être déjà configurée ou occupée. L'utilisateur peut alors choisir une autre touche directement.

## Limites

- Capture des touches clavier standard (lettres, chiffres, F1–F12, flèches, touches courantes et jusqu'à deux modificateurs).
- Les affectations souris/HOTAS existantes ne sont pas modifiées dans l'éditeur simplifié.
- L'application crée un nouveau fichier `.binds`, n'écrase pas `Custom` et ne modifie pas `StartPreset`.
- L'application ne déclenche aucune commande dans le jeu, n'injecte pas de touches et ne change pas les commandes de vol.
- Les recommandations sont locales et déterministes, **sans Mistral** ; un modèle IA n'est pas requis pour paramétrer un clavier.

## Tests et diagnostic

```bash
npm run build
node --test test/foot-quick-odyssey.test.mjs
```

Test manuel recommandé sous Manjaro : charger un profil Odyssey `Custom.4.*.binds`, ouvrir « À pied », capturer une touche sur un emplacement Keyboard, enregistrer un nouveau `EDCHFoot...`, contrôler le XML et l'application des commandes dans le jeu. Ne jamais effectuer ce test pendant que le jeu tourne.

La CI historique Prettier de la base peut signaler des fichiers préexistants non formatés. Elle doit être traitée séparément et non contournée.
