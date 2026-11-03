/*
	wide-dot — bascule thème clair / sombre.
	Le thème initial est appliqué dans <head> (script inline) pour éviter tout flash ;
	ce fichier ne gère que le bouton et la persistance.
*/
(function () {
	'use strict';

	var STORAGE_KEY = 'wide-dot-theme';
	var root = document.documentElement;

	function currentTheme() {
		return root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
	}

	function applyTheme(theme) {
		root.setAttribute('data-theme', theme);

		var meta = document.querySelector('meta[name="theme-color"]');
		if (meta) {
			meta.setAttribute('content', theme === 'dark' ? '#0b0b0e' : '#ffffff');
		}

		var toggle = document.getElementById('theme-toggle');
		if (toggle) {
			var icon = toggle.querySelector('i') || toggle;
			// fa-moon en thème clair (proposer le sombre), fa-sun en thème sombre
			icon.classList.toggle('fa-moon', theme !== 'dark');
			icon.classList.toggle('fa-sun', theme === 'dark');
			toggle.setAttribute(
				'aria-label',
				theme === 'dark' ? 'Passer au thème clair' : 'Passer au thème sombre'
			);
			toggle.setAttribute('title', toggle.getAttribute('aria-label'));
		}
	}

	function init() {
		applyTheme(currentTheme());

		var toggle = document.getElementById('theme-toggle');
		if (!toggle) {
			return;
		}

		toggle.addEventListener('click', function (event) {
			event.preventDefault();
			var next = currentTheme() === 'dark' ? 'light' : 'dark';
			applyTheme(next);
			try {
				localStorage.setItem(STORAGE_KEY, next);
			} catch (e) {
				/* navigation privée : on garde juste le thème pour la session */
			}
		});
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
})();
