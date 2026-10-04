(function () {
  'use strict';

  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  // Libellés des boutons, mis à jour par JavaScript selon la langue affichée
  var LABELS = {
    fr: { menuOpen: 'Ouvrir le menu', menuClose: 'Fermer le menu', toLight: 'Passer au thème clair', toDark: 'Passer au thème sombre' },
    en: { menuOpen: 'Open menu', menuClose: 'Close menu', toLight: 'Switch to light mode', toDark: 'Switch to dark mode' }
  };

  function currentLang() {
    return root.getAttribute('data-lang') === 'en' ? 'en' : 'fr';
  }

  function label(key) {
    return LABELS[currentLang()][key];
  }

  /* ------------------------------------------------------------------------
     Menu mobile
     ------------------------------------------------------------------------ */

  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('site-nav');

  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', label(open ? 'menuClose' : 'menuOpen'));
    });
  }

  /* ------------------------------------------------------------------------
     Trait sous l'onglet actif : au changement de page, il part de l'onglet
     de la page précédente et glisse jusqu'à l'onglet de la nouvelle page.
     ------------------------------------------------------------------------ */

  var repositionIndicator = function () {};
  var navList = nav && nav.querySelector('ul');
  var navLinks = navList ? Array.prototype.slice.call(navList.querySelectorAll('a')) : [];
  var currentLink = navLinks.filter(function (a) {
    return a.getAttribute('aria-current') === 'page';
  })[0];

  if (currentLink) {
    var indicator = document.createElement('span');
    indicator.className = 'nav-indicator';
    indicator.setAttribute('aria-hidden', 'true');
    navList.appendChild(indicator);

    // Le trait prend la largeur du texte du lien, juste en dessous
    var placeIndicator = function (link) {
      var range = document.createRange();
      range.selectNodeContents(link);
      var text = range.getBoundingClientRect();
      var list = navList.getBoundingClientRect();
      indicator.style.width = text.width + 'px';
      indicator.style.top = (text.bottom - list.top + 6) + 'px';
      indicator.style.transform = 'translateX(' + (text.left - list.left) + 'px)';
    };

    var previousHref = null;
    try {
      previousHref = sessionStorage.getItem('nav-from');
      sessionStorage.removeItem('nav-from');
    } catch (e) { /* stockage indisponible : pas d'animation */ }

    var previousLink = navLinks.filter(function (a) {
      return a.getAttribute('href') === previousHref;
    })[0];

    if (previousLink && previousLink !== currentLink && !reduceMotion) {
      placeIndicator(previousLink);
      indicator.getBoundingClientRect(); // fixe la position de départ avant d'animer
      indicator.classList.add('is-animated');
      requestAnimationFrame(function () { placeIndicator(currentLink); });
    } else {
      placeIndicator(currentLink);
      if (!reduceMotion) indicator.classList.add('is-animated');
    }

    repositionIndicator = function () { placeIndicator(currentLink); };

    // Les polices web peuvent changer la largeur du texte une fois chargées
    if (document.fonts) document.fonts.ready.then(repositionIndicator);
    window.addEventListener('resize', repositionIndicator);

    navLinks.forEach(function (a) {
      a.addEventListener('click', function () {
        try {
          sessionStorage.setItem('nav-from', currentLink.getAttribute('href'));
        } catch (e) { /* stockage indisponible : pas d'animation */ }
      });
    });
  }

  /* ------------------------------------------------------------------------
     Thème clair / sombre
     Le thème initial est posé dans le <head> (choix enregistré ou système).
     ------------------------------------------------------------------------ */

  var themeToggle = document.querySelector('.theme-toggle');

  function storedTheme() {
    try {
      return localStorage.getItem('theme');
    } catch (e) {
      return null;
    }
  }

  function applyTheme(theme) {
    root.setAttribute('data-theme', theme);
    if (themeToggle) {
      themeToggle.setAttribute('aria-label', label(theme === 'dark' ? 'toLight' : 'toDark'));
    }
  }

  applyTheme(root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');

  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      try {
        localStorage.setItem('theme', next);
      } catch (e) { /* stockage indisponible : le choix vaut pour cette page */ }
    });
  }

  // Tant que le visiteur n'a rien choisi, on suit le thème du système
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (e) {
    if (!storedTheme()) applyTheme(e.matches ? 'dark' : 'light');
  });

  /* ------------------------------------------------------------------------
     Langue FR / EN
     Les textes visibles existent dans les deux langues dans le HTML
     (data-lang="fr" / "en") et le CSS n'affiche que la langue choisie.
     Ici, on traduit le titre de l'onglet et les attributs (alt, aria-label,
     description) à partir de leurs versions data-en-*.
     La langue initiale est posée dans le <head> (choix enregistré ou navigateur).
     ------------------------------------------------------------------------ */

  var langToggle = document.querySelector('.lang-toggle');
  var titleElement = document.querySelector('title');
  var titleFr = document.title;
  var TRANSLATED_ATTRS = ['alt', 'aria-label', 'content'];

  function applyLang(lang) {
    root.setAttribute('data-lang', lang);
    root.lang = lang;

    document.title = lang === 'en' && titleElement.getAttribute('data-en')
      ? titleElement.getAttribute('data-en')
      : titleFr;

    TRANSLATED_ATTRS.forEach(function (attr) {
      document.querySelectorAll('[data-en-' + attr + ']').forEach(function (el) {
        if (!el.hasAttribute('data-fr-' + attr)) {
          el.setAttribute('data-fr-' + attr, el.getAttribute(attr) || '');
        }
        el.setAttribute(attr, el.getAttribute('data-' + lang + '-' + attr));
      });
    });

    if (toggle && nav) {
      toggle.setAttribute('aria-label', label(nav.classList.contains('is-open') ? 'menuClose' : 'menuOpen'));
    }
    applyTheme(root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');
    repositionIndicator();
  }

  applyLang(currentLang());

  if (langToggle) {
    langToggle.addEventListener('click', function () {
      var next = currentLang() === 'fr' ? 'en' : 'fr';
      applyLang(next);
      try {
        localStorage.setItem('lang', next);
      } catch (e) { /* stockage indisponible : le choix vaut pour cette page */ }
    });
  }

  document.querySelectorAll('[data-year]').forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });

  /* ------------------------------------------------------------------------
     Accueil : vidéo plein écran (lue automatiquement par la balise <video>)
     ------------------------------------------------------------------------ */

  var heroVideo = document.querySelector('.hero-bg video');

  if (heroVideo && reduceMotion) {
    heroVideo.removeAttribute('autoplay');
    heroVideo.pause();
  }

  /* ------------------------------------------------------------------------
     Page 3D : l'image devient une vidéo au survol
     Les extraits (quelques centaines de Ko) sont préchargés dès l'arrivée sur
     la page, pour démarrer sans délai. Chaque survol repart du début.
     ------------------------------------------------------------------------ */

  if (canHover && !reduceMotion) {
    document.querySelectorAll('.work-media[data-video]').forEach(function (media) {
      var trigger = media.closest('.work-link') || media;
      var hovered = false;
      var video = document.createElement('video');

      video.src = media.getAttribute('data-video');
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.preload = 'auto';
      video.setAttribute('aria-hidden', 'true');
      media.appendChild(video);

      function enter() {
        hovered = true;
        video.play().then(function () {
          if (hovered) media.classList.add('is-playing');
        }).catch(function () { /* lecture refusée : l'image reste affichée */ });
      }

      function leave() {
        hovered = false;
        media.classList.remove('is-playing');
        video.pause();
        video.currentTime = 0;
      }

      trigger.addEventListener('mouseenter', enter);
      trigger.addEventListener('mouseleave', leave);
      trigger.addEventListener('focus', enter);
      trigger.addEventListener('blur', leave);
    });
  }
})();
