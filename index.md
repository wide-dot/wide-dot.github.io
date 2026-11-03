---
layout: default
title:  Nos projets
date:   2023-04-14
categories: front
right-image: /images/front/front.png
---

<div class="highlight-game">
	<a class="highlight-media" href="ms-pacman.html">
		<img src="/images/ms-pacman/banner.jpg" alt="Ms. Pac-Man sur Thomson TO8" />
	</a>
	<div class="highlight-body">
		<span class="highlight-kicker">Jeu complet</span>
		<h3>Ms. Pac-Man</h3>
		<p>La version arcade sur TO8, à 30 images/s, avec un pilote automatique par réseau de neurones. Le premier jeu complet signé wide-dot.</p>
		<div class="highlight-actions">
			<a href="ms-pacman.html" class="button primary">La fiche du jeu</a>
			<a href="/toje/?media=%2Freleases%2Fms-pacman%2Fms-pacman.fd&amp;titre=Ms.+Pac-Man" class="button">Jouer dans le navigateur</a>
		</div>
	</div>
</div>

Notre groupe travaille actuellement sur 3 projets majeurs de jeux pour Thomson TO8 et TO9+ :

- la conversion/adaptation de [R-Type](/r-type.html), par reverse-engineering de la version arcade de IREM,
- l'adaptation du célèbre [Battle Squadron](https://www.youtube.com/watch?v=P2Igl7zKvjM), inspiré du jeu d'origine sur Amiga,
- la création d'un jeu original, [Goldorak](/goldorak.html), fondé sur le [projet initial Amstrad GX4000](https://amigamuseum.emu-france.info/Fichiers/sites/Goldorak_CPC/Goldorak_CPC.html).

Nos développements sont réalisés en <b>Assembleur 6809</b> (LWASM sur Windows, Linux et MacOS) conjointement avec de l'outillage spécifique réalisé essentiellement en Java. Ces projets s'appuient sur un moteur de jeu (sprites, scrollings, musiques, etc.) réalisé <b>100% en Assembleur 6809</b>.

L'ensemble de nos réalisations, développements en cours ou démos techniques :

<b>Projets de jeux</b>

<div class="front-demos">
{% include games.html %}
</div>

<b>Démos techniques</b>

<div class="front-demos">
{% include demos.html %}
</div>
