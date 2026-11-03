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
download: /releases/ms-pacman/ms-pacman-v1.0.1.zip
hardware:
  - Thomson TO8/TO8D
  - Manette dans le premier port
  - Carte son SN76489 (facultative)
display-instructions: false
toje:
  - /releases/ms-pacman/ms-pacman.fd
---

## Description

Ms. Pac-Man débarque enfin sur TO8 ... à 30fps !

Il s'agit de la version arcade, avec les graphismes empruntés à la version Atari 7800. Le son a été adapté pour la carte SN76489.

## Réseau de neurones

On voulait apporter un petit twist à cette version arcade, alors on a ajouté un petit réseau de neurones qui joue en temps réel à 25fps !

Pour l'activer, durant l'intro: Haut, bas, gauche, droite, fire ...
et Ms. Pac-Man joue toute seule, vies infinies.

## Jouer

Le jeu se joue à la manette:
Fire pour mettre une pièce, fire pour lancer la partie.

Pas de son ? Une touche du clavier change le port de la carte son (affiché en haut à droite). Le choix est validé au bout de 2 secondes.

Pas de TO8 sous la main ? Ça tourne aussi [dans le navigateur](/toje/?media=%2Freleases%2Fms-pacman%2Fms-pacman.fd&titre=Ms.+Pac-Man) avec TOJE.

***Aucune exploitation commerciale n'est autorisée.***

<div class="row">
    <img src="images/ms-pacman/ms-pacman-01.gif" alt="" />
    <img src="images/ms-pacman/ms-pacman-02.gif" alt="" />
</div>

---

Credit spécial pour Cameron Hickling et sa superbe salle d'arcade en banner :
<https://www.artstation.com/artwork/GvXlk1>

{% include instructions-noT2.html %}
