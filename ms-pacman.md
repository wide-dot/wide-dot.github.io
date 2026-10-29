---
layout: default
title:  Ms. Pac-Man
date:   2026-10-29
categories: game
banner: /images/ms-pacman/banner.png
credits:
  - bentoc (portage 6809)
  - GCC (graphismes de la version Atari 7800)
  - Namco / Bally-Midway / GCC
download: /releases/ms-pacman/ms-pacman-v1.0.0.zip
hardwares:
  - Thomson TO8/TO8D
  - Manette dans le premier port
  - Carte son SN76489 (facultative)
display-instructions: false
---

## Description

Le Ms. Pac-Man de l'arcade sur Thomson TO8, en ASM 6809, routine par routine : le code Z80 de la borne a été relu dans son désassemblage commenté puis réécrit en 6809, et le portage a été comparé trame par trame à MAME.

La partie à un joueur est complète, jusqu'à la fin du tableau 142 :

- les quatre labyrinthes et leurs couleurs,
- les règles des fantômes : phases, cibles, maison, Elroy, ralentissement dans les tunnels, et jusqu'aux virages au hasard des fantômes apeurés,
- les fruits et leurs trajets,
- les trois intermèdes,
- le mode démo, avec le chapiteau lumineux et la parade.

Les graphismes reprennent ceux de la version Atari 7800 : un écran de 160 pixels de large, qui tombe pile sur le mode 16 couleurs du TO8. La borne tourne à 60 Hz et le TO8 à 50 Hz : le jeu calcule donc 6 trames arcade toutes les 5 trames TO8, pour garder la vitesse d'origine. L'écran est redessiné aussi souvent que le processeur le permet, entre 25 et 30 images par seconde.

Le pilote sonore de la borne est porté à l'identique et joue sur une carte SN76489.

<div class="row">
    <img src="images/ms-pacman/ms-pacman-01.gif" alt="" />
    <img src="images/ms-pacman/ms-pacman-02.gif" alt="" />
</div>

## Commandes

- **Bouton de tir** : insère une pièce, puis lance la partie depuis l'écran de départ.
- **N'importe quelle touche** : choisit le port de la carte son, affiché en haut à droite. Chaque appui passe au suivant avec une note de test, et le choix s'applique après 2 secondes sans appui. Une carte Musique PLUS est reconnue toute seule au démarrage.

## Le pilote

Haut, bas, gauche, droite, puis tir, dans cet ordre : le jeu se met à jouer tout seul. Un petit réseau de neurones insère une pièce, lance la partie et la joue, avec des vies infinies. Il perd en moyenne 1,2 vie par niveau sur les niveaux 1 à 21, et prend environ 13 % du processeur. La même séquence lui rend la main.

Le réseau a été entraîné dans un simulateur en C de la logique de la borne, identique à MAME, avant d'être converti en arithmétique entière 6809.

Vous pouvez aussi [jouer dans le navigateur](/toje/?jeu=ms-pacman.fd) avec TOJE.

*Aucune exploitation commerciale n'est autorisée.*

{% include instructions-noT2.html %}
