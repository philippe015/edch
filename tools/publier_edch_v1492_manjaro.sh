#!/usr/bin/env bash
# Publication contrôlée des sources EDCH BGS v1.4.9.2 depuis Manjaro.
# Ne fait aucun commit ni checkout dans le répertoire du prototype local.
set -Eeuo pipefail

FORK='philippe015/edch'
BRANCH='feat/bgs-manjaro-v1.4.9.2-complet-20261108'
SOURCE="${EDCH_ROOT:-$HOME/EDCH-BGS-Manjaro}"
MODE="${1:---check}"

FILES=(
  public/styles.css
  public/locales/en.json public/locales/fr.json public/locales/de.json
  public/locales/es.json public/locales/pt.json public/locales/ru.json
  src/platform/bridge.ts src/state/store.ts src/services/wing.ts
  src/features/missions/live.ts src/features/missions/wingManual.ts
  src/views/missions/index.ts src/ui/notifier.ts
  src/views/bgs/index.ts src/features/bgs/reportPdf.ts
  src/features/bgs/reliability.ts src/features/bgs/factionChoice.ts
  src/views/controls/index.ts src/views/controls/footEditor.ts
  src/features/controls/footEdit.ts
  src-tauri/src/lib.rs src-tauri/src/bgs_pdf.rs
  src-tauri/src/foot_binds.rs src-tauri/src/bgs_backup.rs
  src-tauri/tauri.conf.json
  test/bgs-pdf-export.test.mjs test/foot-editor-v1-4-4.test.mjs
  test/bgs-reliability-v1-4-9.test.mjs test/wing-manual-v1491.test.mjs
  test/bgs-faction-choice-v1-4-9-2.test.mjs
)
REQUIRED=(
  src/features/bgs/core.ts src/features/bgs/reportPdf.ts
  src/features/bgs/reliability.ts src/features/bgs/factionChoice.ts
  src/features/missions/wingManual.ts src/views/controls/footEditor.ts
  src-tauri/src/bgs_pdf.rs src-tauri/src/foot_binds.rs
  src-tauri/src/bgs_backup.rs
)

fail() { printf 'ERREUR : %s\n' "$*" >&2; exit 1; }
[[ "$MODE" == '--check' || "$MODE" == '--publish' ]] || fail 'Usage : script --check | --publish'
[[ -f "$SOURCE/package.json" && -d "$SOURCE/src" ]] || fail "Projet EDCH absent : $SOURCE"
for f in "${REQUIRED[@]}" "${FILES[@]}"; do
  [[ -f "$SOURCE/$f" && ! -L "$SOURCE/$f" ]] || fail "Fichier source manquant ou lien : $f"
  [[ $(stat -c %s "$SOURCE/$f") -le 2500000 ]] || fail "Fichier trop volumineux : $f"
done
# Ne jamais copier .env, secrets, journaux, bases, fichiers de jeu ou données du joueur.
for f in "${FILES[@]}"; do
  if grep -Eq 'gh[pousr]_[A-Za-z0-9_]{25,}|github_pat_[A-Za-z0-9_]{25,}|sk-[A-Za-z0-9_-]{30,}' "$SOURCE/$f"; then
    fail "Chaîne ressemblant à un secret dans $f : vérification manuelle requise"
  fi
done
printf 'OK : %s fichiers source explicitement autorisés ; aucun répertoire personnel ou journal.\n' "${#FILES[@]}"
if [[ "$MODE" == '--check' ]]; then
  printf 'Contrôle terminé, aucun fichier modifié ni publié.\n'
  printf 'Publication : %s, branche %s\n' "$FORK" "$BRANCH"
  exit 0
fi

for tool in git gh npm node cargo; do
  command -v "$tool" >/dev/null || fail "Commande manquante : $tool"
done
gh auth status >/dev/null || fail 'Authentification GitHub absente : gh auth login'
[[ "$(gh api user --jq .login)" == 'philippe015' ]] || fail 'Le compte gh actif doit être philippe015'
[[ -n "$(gh repo view "$FORK" --json nameWithOwner --jq .nameWithOwner)" ]] || fail 'Fork GitHub inaccessible'
TEMP="$(mktemp -d "${TMPDIR:-/tmp}/edch-publication-v1492-XXXXXXXX")"
printf 'Copie temporaire : %s\n' "$TEMP"
# Une copie propre de la branche précréée sur GitHub, jamais le projet local.
gh repo clone "$FORK" "$TEMP" -- --branch "$BRANCH" --single-branch
for f in "${FILES[@]}"; do
  mkdir -p "$TEMP/$(dirname "$f")"
  cp -- "$SOURCE/$f" "$TEMP/$f"
done
cd "$TEMP"
git add -- "${FILES[@]}"
git diff --cached --check || fail 'Erreurs dans le diff Git ; aucune publication'
CHANGED="$(git diff --cached --name-only)"
[[ -n "$CHANGED" ]] || { printf 'Déjà à jour : aucune modification à publier.\n'; exit 0; }
printf '\nFichiers préparés :\n%s\n' "$CHANGED"
printf '\nRésumé du diff :\n'
git diff --cached --stat
if [[ -f package-lock.json ]]; then
  npm ci
else
  npm install --no-package-lock
fi
# Mise en forme uniquement dans la copie temporaire : évite que les anciennes
# versions de Prettier bloquent la publication des fichiers ajoutés à GitHub.
FORMAT_FILES=(docs/EDCH_BGS_MANJARO_V1.4.9.2_PUBLICATION.md)
for f in "${FILES[@]}"; do
  case "$f" in *.ts|*.mjs|*.json|*.css) FORMAT_FILES+=("$f");; esac
done
node_modules/.bin/prettier --write "${FORMAT_FILES[@]}"
git add -- docs/EDCH_BGS_MANJARO_V1.4.9.2_PUBLICATION.md "${FILES[@]}"
git diff --cached --check
npm test
(cd src-tauri && cargo check)
# Compiler un binaire complet pour tester aussi Tauri : EDCH_TEST_NATIVE=1.
if [[ "${EDCH_TEST_NATIVE:-0}" == 1 ]]; then npm run app:build; fi
NAME="$(git config user.name || true)"
EMAIL="$(git config user.email || true)"
[[ -n "$NAME" ]] || git config user.name 'philippe015'
if [[ -z "$EMAIL" ]]; then
  GH_ID="$(gh api user --jq .id)"
  git config user.email "${GH_ID}+philippe015@users.noreply.github.com"
fi
git commit -m 'feat(bgs): publish complete Manjaro prototype v1.4.9.2'
git push origin "HEAD:refs/heads/$BRANCH"
if [[ "$(gh pr list -R "$FORK" --head "$BRANCH" --json number --jq 'length')" == 0 ]]; then
  gh pr create -R "$FORK" --base main --head "$BRANCH" --draft \
    --title 'EDCH BGS Manjaro v1.4.9.2 — intégration complète (brouillon)' \
    --body 'Version de travail non officielle issue du prototype Manjaro : BGS et patrouilles, rapports PDF, éditeur À pied, notifications corrigées, sauvegardes natives, confirmation manuelle des missions d’escadrille et changement de faction. Tests npm et cargo check exécutés avant publication. Les effets BGS ne sont pas une preuve d’influence. La PR amont BKNadir/edch#2 reste indépendante. À relire avant fusion.'
fi
printf '\nPUBLICATION RÉUSSIE : https://github.com/%s/tree/%s\n' "$FORK" "$BRANCH"
printf 'Voir la PR du fork : https://github.com/%s/pulls\n' "$FORK"

