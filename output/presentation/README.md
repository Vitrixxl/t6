# Support de soutenance

Diaporama React autonome pour l'oral du Titre 6. Il ne touche ni à l'API
UrbanFlow ni à un service distant : Bun regroupe la page, le code et les polices
en local. Aucune capture d'écran : la démonstration se fait sur le téléphone.

```sh
cd output/presentation
bun install
bun run presentation
```

Puis ouvrir http://localhost:4100/ (variable `PORT` pour changer de port).

## Clavier

| Touche                              | Action              |
| ----------------------------------- | ------------------- |
| → ↓ Espace Entrée Page suivante     | étape suivante, puis diapositive suivante |
| ← ↑ Retour arrière Page précédente  | diapositive précédente |
| Début / Fin                         | première / dernière |
| F                                   | plein écran         |

L'adresse porte le numéro de la diapositive (`#7`) : un rechargement revient au
même endroit.

## Contenu

`src/slides.tsx` suit le déroulé de `output/soutenance/01-deroule.html`,
section par section. Les transitions et les apparitions en cascade utilisent
`motion`. Les chiffres de la diapositive « Depuis la remise » sont relevés à la
main ; les recalculer avant l'oral :

```sh
git rev-list --count cf07f12..main
gh pr list --state merged --limit 100 | wc -l
bun run test
```
