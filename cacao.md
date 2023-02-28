---
layout: default
title:  Cacao and coffee shop
date:   2023-02-16
categories: game, demo
banner: /images/dott/banner.png
credits:
  - faxdoc (décor)
  - Adam Szczęsny (sprite)
  - bentoc (coding)
  - adnz (musique)
github: https://github.com/wide-dot/thomson-to8-game-engine/tree/main/game-projects/cacao-and-coffee-shop
download: /releases/cacao/20230128-cacao-and-coffee-shop.zip
hardwares: 
  - Thomson TO8
  - Thomson TO9+
  - RAM ext. 256 Ko (sauf Mégarom T.2)
  - Carte son SN76489 (option)
display-instructions: true  
---

### Description

Démonstration d'un décor animé en image compilée.

<div class="row">
    <img src="images/cacao/cacao-01.gif" alt="" />
</div>

L'animation du décor est traitée en pre-processing pour déduire uniquement les écarts entre chaque image.

Le fond est sauvegardé au fur et a mesure de l'affichage du sprite, c'est à dire durant l'exécution de la routine de sprite compilé.

L'effacement du sprite se fait également via une routine spécifique à chaque sprite qui charge par pul les registres avec la destination mémoire et les couleurs du fond a restituer.

Driver son utilisé : PSGLIB pour 6809 (wide-dot)

---

Graphics by [faxdoc](https://www.deviantart.com/faxdoc/art/Cacao-and-coffee-shop-580036274) & [Adam Szczęsny](https://dribbble.com/shots/11212994-Kubo-pixel-art-animation)