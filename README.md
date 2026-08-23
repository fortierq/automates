# Automates — entraînement MPI

Atelier web pour dessiner et tester des automates finis, puis s’entraîner à passer d’un langage à un automate et d’un automate à une expression régulière.

## Fonctions

- création, déplacement et suppression d’états ;
- états initiaux et finaux ;
- transitions étiquetées et test de mots ;
- sauvegarde locale automatique ;
- export TikZ/LaTeX par copie ou téléchargement ;
- deux premiers exercices avec correction immédiate ;
- emplacements prévus pour la déterminisation, Glushkov et l’élimination des états.

## Développement

Prérequis : Node.js 22 et pnpm.

```bash
pnpm install
pnpm dev
```

La vérification de production se lance avec `pnpm build`.

## Choix techniques

React et TypeScript, React Flow pour le plan de travail, Zustand pour la sauvegarde locale. Le déploiement est assuré par OpenAI Sites ; le workflow GitHub vérifie chaque contribution sans maintenir une seconde chaîne de publication.
