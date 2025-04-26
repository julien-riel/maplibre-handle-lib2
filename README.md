# MapLibre Tools

Todo: rendre optionnel la mise à jour de la source si on change
en boucle. (e.g hide, show, ALL handler.)

C'est une librairie TypeScript pour MapLibre GL JS, qui fournit des outils pour éditer des objets géographiques.

Les outils permettent d'éditer une sélection d'objets géographiques sur une carte MapLibre GL JS. Ils sont analogues aux outils dans Abode Illustrator, Inkscape, Autodesk, etc.

Les outils travaillent avec un sélection d'objets. Un outil peut permettre de changer la sélection. Les outils utilisent des 'handles' qui sont des points d'ancrage sur les objets géographiques. Ces 'handles' peuvent être déplacés pour modifier la forme de l'objet ou changer des propriétés de l'objet. En plus des
'handles', on peut interagir avec les objets via leur contour et surface.

Les outils ont un cycle de vie. Il sont activés, utilisés et 
désactivés. Lorsqu'ils sont activés, ils vont habitullement faire
les actions suivantes:

 - Créer les 'handles' sur les objets géographiques sélectionnés
 - Ajouter des écouteurs d'événements pour gérer les interactions de l'utilisateur avec les 'handles' et les objets géographiques
 - Possiblement, cacher la sélection, pour ne pas interférer avec la prévisualisation de l'outil
 - Changer le curseur de la souris pour indiquer que l'outil est actif

 # Règles d'expérience-utilisateur

Les outils doivent être intuitifs et faciles à utiliser. Ils doivent permettre à l'utilisateur de comprendre rapidement comment les utiliser. Les outils doivent également être réactifs et fournir un retour visuel immédiat lors de l'interaction avec les objets géographiques.

 - Changer le curseur de la souris pour indiquer que l'outil est actif
 - Afficher des 'handles' sur les objets géographiques sélectionnés pour indiquer qu'ils peuvent être modifiés
- Fournir un retour visuel immédiat lors de l'interaction (incluant mouse over) avec les objets géographiques (par exemple, en changeant la couleur des 'handles' ou en affichant une animation)
- Utiliser des conventions de formes et de couleurs pour les 'handles'


## Principe général de fonctionnement

Lorsqu'un objet est sélectionné, un rectangle pointillé est affiché autour de l'objet. Il y a des couleurs différentes pour la dernières sélection et les sélections précédentes (pour la sélection multiple).

Des handles sont ajoutés sur les objets géographiques ou le recantangle de sélection.

Lorsqu'on mouseover un 'handle', le curseur change pour indiquer que l'on peut interagir avec le 'handle'. Lorsqu'on clique sur un 'handle', les handles disparaissent on voit la prévisualisation de l'outil. De mouvement de souris g/d, h/b, sont pris en compte et
mettent la prévisulisation à jour. Lorsque le bouton est relâché, la prévisualisation est appliquée à l'objet géographique et les handles sont à nouveau affichés.

## Conventions de couleurs pour la sélection

 - Sélection courante: blanc
 - Sélection précédente: gris

## Convention de couleurs pour les 'handles'
  
  - 'Handles' sélectionnés: jaume, contour noir
  - 'Handles' non sélectionnés: blanc, contour noir
  - Indique que peut être supprimé: contour rouge

## Convention de formes pour les handles
 
 - 'Handles' carrés: peut être déplacés dans les deux axes (x et y)
 - 'Handles' ronds: peut être déplacés dans un axe uniquement (x ou y)
 - 'Handles' triangulaires: Indique un ajout

Les outils qui pourront être développés en utilisant cette librairie incluent :
- Outils de dessin (polygones, lignes, points)
- Outils création de formes paramétriques (cercle, rectangle)
- Outils de modification (ajouter, supprimer, déplacer des objets géographiques)
- Outils de sélection (sélectionner des objets géographiques sur la carte)
- Outils de mesure (mesurer la distance entre deux points, la surface d'un polygone)
- Outils de filtrage (filtrer les objets géographiques sur la carte)

A TypeScript library for working with MapLibre GL JS, providing utilities for map manipulation, data handling, and more.

## Example

See the `example` directory for a full demonstration of using the library.

## License

MIT