---
layout: default
title:  Prince of Persia
date:   2026-11-03
categories: game
banner: /images/prince-of-persia/banner.jpg
credits:
  - bentoc (portage 6809)
  - Jordan Mechner (jeu original, Apple II)
  - Leila Bronstein, Avril Harrison, James St. Louis (graphismes de la version PC)
  - Brøderbund
  - Jordan Mechner (Image Bannière)
download: /releases/prince-of-persia/prince-of-persia-v0.1.3.zip
hardwares:
  - Thomson TO8/TO8D
  - Clavier, ou manette dans le premier port
display-instructions: false
toje:
  - /releases/prince-of-persia/prince-of-persia.fd
toje-image: /images/prince-of-persia/prince-of-persia-03.gif
---

## Description

Prince of Persia enfin sur TO8 !

Le code 6502 de Jordan Mechner a été porté routine par routine en 6809, et comparé a l'exécution à la version Apple II. Les graphismes viennent de la version PC en 4 couleurs, le son passe par le CNA du TO8.

## L'éditeur de Mechner

En bonus, on a porté l'éditeur de niveaux de Mechner : une disquette pour le donjon, une pour le palais, avec leurs disquettes de données dans le ZIP.

Et en tapant P O P pendant une partie, ses touches de développement se réveillent.

## Jouer

Le jeu se joue au clavier:
J et L pour courir, I pour sauter, K pour se baisser, U et O pour sauter en avant, Espace pour l'épée.
La manette marche aussi, pad Mega Drive compris.

CNT-G sauvegarde la partie à partir du niveau 3, CNT-L sur l'écran titre la reprend.

Pas de TO8 sous la main ? Ça tourne aussi [dans le navigateur](/toje/?media=%2Freleases%2Fprince-of-persia%2Fprince-of-persia.fd&titre=Prince+of+Persia) avec TOJE.

***Aucune exploitation commerciale n'est autorisée.***

<div class="row previews">
    <img src="images/prince-of-persia/prince-of-persia-01.gif" alt="" />
    <img src="images/prince-of-persia/prince-of-persia-02.gif" alt="" />
</div>

---

Credit spécial pour Jordan Mechner et ses planches de rotoscopie « Run-Jump » en banner :
<https://www.jordanmechner.com/en/artworks/run-jump/>

{% include instructions-noT2.html %}
