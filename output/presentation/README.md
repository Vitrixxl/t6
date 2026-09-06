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

## Téléphone

Glisser vers la gauche avance, vers la droite revient à la diapositive précédente.
Le geste fonctionne en portrait et en paysage, même dans les marges autour du
diaporama. Les petits mouvements, les gestes verticaux et le zoom à deux doigts
ne changent pas de diapositive. Les liens restent cliquables. Le paysage est
plus lisible ; le cadrage suit la rotation sans modifier la mise en page.

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
section par section. Les transitions, les apparitions en cascade et les formes de fond qui se
déplacent d'une diapositive à l'autre (`src/Backdrop.tsx`) utilisent `motion`. Les chiffres de la diapositive « Depuis la remise » sont relevés à la
main ; les recalculer avant l'oral :

```sh
git rev-list --count cf07f12..main
gh pr list --state merged --limit 100 | wc -l
bun run test
```
