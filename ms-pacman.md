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

Ms. Pac-Man est arrivée dans les salles d'arcade en 1982. Quarante-quatre ans plus tard, elle débarque sur Thomson TO8, et c'est bien la borne qui tourne sur votre machine.

Chaque routine du programme Z80 d'origine a été traduite en 6809. Les parties ont été rejouées côte à côte avec MAME, jusqu'à ce que les deux écrans ne s'écartent plus d'une seule image. Blinky, Pinky, Inky et Sue vous traquent avec leurs vraies règles, les fruits rebondissent sur leurs vrais trajets, et les quatre labyrinthes s'enchaînent jusqu'au tableau 142. C'est là que la borne plante, et le TO8 plante avec elle, à l'identique.

Les graphismes viennent de la version Atari 7800 : son écran de 160 pixels de large tient exactement dans le mode 16 couleurs du TO8. Les musiques et les bruitages sont ceux de l'arcade, note pour note, sur une carte son SN76489.

La borne affiche 60 images par seconde, le TO8 n'en a que 50. Pour que Ms. Pac-Man file à la bonne vitesse, le jeu calcule six images de la borne pendant que le TO8 en affiche cinq.

<div class="row">
    <img src="images/ms-pacman/ms-pacman-01.gif" alt="" />
    <img src="images/ms-pacman/ms-pacman-02.gif" alt="" />
</div>

## Jouer

Un appui sur le bouton de la manette met une pièce, un second lance la partie.

Pas de son ? Appuyez sur une touche du clavier pour changer le port de la carte son, affiché en haut à droite de l'écran. Le choix est retenu au bout de deux secondes. Une Musique PLUS est trouvée toute seule au démarrage.

## Laissez-la jouer

Sur la manette, faites haut, bas, gauche, droite, puis tir. Ms. Pac-Man se met à jouer toute seule, avec des vies infinies.

C'est un petit réseau de neurones qui tient la manette. Il a appris à jouer dans un simulateur de la borne écrit en C, pendant des nuits entières de calcul, puis il a été réécrit pour le 6809. Il ne prend qu'un huitième du processeur et perd à peine plus d'une vie par niveau. Refaites la même combinaison pour reprendre la main.

Pas de TO8 sous la main ? Le jeu tourne aussi [dans votre navigateur](/toje/?jeu=ms-pacman.fd) avec TOJE.

*Aucune exploitation commerciale n'est autorisée.*

---

Credit spécial pour Cameron Hickling et sa superbe salle d'arcade :
<https://www.artstation.com/artwork/GvXlk1>

{% include instructions-noT2.html %}
