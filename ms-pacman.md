---
layout: default
title:  Ms. Pac-Man
date:   2026-10-29
categories: game
banner: /images/ms-pacman/banner.jpg
credits:
  - bentoc (portage 6809)
  - GCC (graphismes de la version Atari 7800)
  - Namco / Bally-Midway / GCC
  - Cameron Hickling (Image Bannière)
download: /releases/ms-pacman/ms-pacman-v1.0.0.zip
hardwares:
  - Thomson TO8/TO8D
  - Manette dans le premier port
  - Carte son SN76489 (facultative)
display-instructions: false
---

## Description

Ms. Pac-Man est arrivée dans les salles d'arcade en 1982. Quarante-quatre ans plus tard, on l'a fait venir sur Thomson TO8, et c'est bien la borne qui tourne sur votre machine.

On a traduit en 6809 chaque routine du programme Z80 d'origine, puis on a rejoué les parties côte à côte avec MAME jusqu'à ce que les deux écrans ne s'écartent plus d'une seule image. Blinky, Pinky, Inky et Sue vous traquent avec leurs vraies règles, les fruits rebondissent sur leurs vrais trajets, et les quatre labyrinthes s'enchaînent jusqu'au tableau 142. C'est là que la borne plante, et le TO8 plante avec elle, à l'identique.

Pour les graphismes, on a repris ceux de la version Atari 7800 : son écran de 160 pixels de large tient exactement dans le mode 16 couleurs du TO8. Les musiques et les bruitages sont ceux de l'arcade, note pour note, sur une carte son SN76489.

La borne affiche 60 images par seconde, le TO8 n'en a que 50. Pour que Ms. Pac-Man file à la bonne vitesse, on calcule six images de la borne pendant que le TO8 en affiche cinq.

<div class="row">
    <img src="images/ms-pacman/ms-pacman-01.gif" alt="" />
    <img src="images/ms-pacman/ms-pacman-02.gif" alt="" />
</div>

## Jouer

Un appui sur le bouton de la manette met une pièce, un second lance la partie.

Pas de son ? Une touche du clavier change le port de la carte son, affiché en haut à droite de l'écran. Le choix est retenu au bout de deux secondes.

## Et en bonus

La borne n'avait pas ça, alors on l'a ajouté. Sur la manette, faites haut, bas, gauche, droite, puis tir : Ms. Pac-Man se met à jouer toute seule, avec des vies infinies.

Aux commandes, un petit réseau de neurones. On l'a entraîné dans un simulateur de la borne écrit en C, pendant des nuits entières de calcul, puis on l'a réécrit pour le 6809. À chaque case, il choisit sa route en 7,7 ms en moyenne, et il perd à peine plus d'une vie par niveau. Refaites la même combinaison pour reprendre la main.

Pas de TO8 sous la main ? Le jeu tourne aussi [dans votre navigateur](/toje/?jeu=ms-pacman.fd) avec TOJE.

*Aucune exploitation commerciale n'est autorisée.*

---

Credit spécial pour Cameron Hickling et sa superbe salle d'arcade :
<https://www.artstation.com/artwork/GvXlk1>

{% include instructions-noT2.html %}
