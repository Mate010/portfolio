(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ------------------------------------------------------------------------
     Menu mobile
     ------------------------------------------------------------------------ */

  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('site-nav');

  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
    });
  }

  /* ------------------------------------------------------------------------
     Thème clair / sombre
     Le thème initial est posé dans le <head> (choix enregistré ou système).
     ------------------------------------------------------------------------ */

  var root = document.documentElement;
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
      themeToggle.setAttribute('aria-label',
        theme === 'dark' ? 'Passer au thème clair' : 'Passer au thème sombre');
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

  document.querySelectorAll('[data-year]').forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });

  /* ------------------------------------------------------------------------
     API YouTube (chargée une seule fois, à la demande)
     ------------------------------------------------------------------------ */

  var youTubeAPI = null;

  function loadYouTubeAPI() {
    if (!youTubeAPI) {
      youTubeAPI = new Promise(function (resolve) {
        if (window.YT && window.YT.Player) {
          resolve(window.YT);
          return;
        }
        window.onYouTubeIframeAPIReady = function () {
          resolve(window.YT);
        };
        var script = document.createElement('script');
        script.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(script);
      });
    }
    return youTubeAPI;
  }

  function youTubeVars(videoId) {
    var vars = {
      autoplay: 1,
      mute: 1,
      controls: 0,
      playsinline: 1,
      rel: 0,
      disablekb: 1,
      fs: 0,
      iv_load_policy: 3,
      loop: 1,
      playlist: videoId
    };
    if (location.protocol.indexOf('http') === 0) {
      vars.origin = location.origin;
    }
    return vars;
  }

  function hideFromKeyboard(iframe) {
    iframe.setAttribute('tabindex', '-1');
    iframe.setAttribute('aria-hidden', 'true');
  }

  /* Lecteur YouTube muet qui tourne en boucle, du début à la fin.
     On ne le met jamais en pause et on ne saute jamais dans la vidéo :
     sinon YouTube affiche un bouton pause au centre pendant quelques secondes.
     Pour ne montrer qu'un passage, onUpdate(true) n'est appelé qu'entre
     data-start et data-end (en secondes) ; l'image reste visible le reste du temps. */
  function createLoopingYouTube(container, slot, onUpdate) {
    var videoId = container.getAttribute('data-video');
    var start = parseFloat(container.getAttribute('data-start')) || 0;
    var end = parseFloat(container.getAttribute('data-end')) || Infinity;

    loadYouTubeAPI().then(function (YT) {
      new YT.Player(slot, {
        videoId: videoId,
        playerVars: youTubeVars(videoId),
        events: {
          onReady: function (e) {
            var player = e.target;
            hideFromKeyboard(player.getIframe());
            player.mute();
            player.playVideo();
            setInterval(function () {
              var t = player.getCurrentTime();
              onUpdate(player.getPlayerState() === YT.PlayerState.PLAYING && t >= start && t < end);
            }, 200);
          },
          onStateChange: function (e) {
            if (e.data === YT.PlayerState.ENDED) e.target.playVideo();
          }
        }
      });
    });
  }

  /* ------------------------------------------------------------------------
     Accueil : vidéo YouTube plein écran en boucle
     ------------------------------------------------------------------------ */

  var hero = document.querySelector('.hero-bg[data-video]');

  if (hero && !reduceMotion) {
    createLoopingYouTube(hero, hero.querySelector('.hero-player'), function (visible) {
      hero.classList.toggle('is-playing', visible);
    });
  }

  /* ------------------------------------------------------------------------
     Page 3D : l'image devient une vidéo au survol
     - YouTube : lecteur préchargé à l'arrivée sur la page, affiché au survol.
     - Vimeo : lecteur créé au premier survol, puis mis en pause / relancé.
     ------------------------------------------------------------------------ */

  function createVimeoPlayer(media, isHovered) {
    if (!window.Vimeo) return null;

    var start = parseInt(media.getAttribute('data-start'), 10) || 0;
    var iframe = document.createElement('iframe');
    iframe.src = 'https://player.vimeo.com/video/' + media.getAttribute('data-video') +
      '?background=1&muted=1&autoplay=1&loop=1&dnt=1#t=' + start + 's';
    iframe.allow = 'autoplay; fullscreen; picture-in-picture';
    iframe.title = '';
    hideFromKeyboard(iframe);
    media.appendChild(iframe);

    var player = new window.Vimeo.Player(iframe);
    player.on('timeupdate', function () {
      if (isHovered()) media.classList.add('is-playing');
      else player.pause().catch(function () {});
    });

    return {
      play: function () { player.play().catch(function () {}); },
      pause: function () { player.pause().catch(function () {}); }
    };
  }

  function onHover(el, callback) {
    el.addEventListener('mouseenter', function () { callback(true); });
    el.addEventListener('mouseleave', function () { callback(false); });
    el.addEventListener('focus', function () { callback(true); });
    el.addEventListener('blur', function () { callback(false); });
  }

  function setupYouTubeHover(media, trigger) {
    var hovered = false;
    var inRange = false;
    var slot = document.createElement('div');

    function update() {
      media.classList.toggle('is-playing', hovered && inRange);
    }

    media.appendChild(slot);
    createLoopingYouTube(media, slot, function (visible) {
      inRange = visible;
      update();
    });
    onHover(trigger, function (isHovered) {
      hovered = isHovered;
      update();
    });
  }

  function setupVimeoHover(media, trigger) {
    var hovered = false;
    var player = null;

    onHover(trigger, function (isHovered) {
      hovered = isHovered;
      if (!hovered) {
        media.classList.remove('is-playing');
        if (player) player.pause();
      } else if (player) {
        player.play();
      } else {
        player = createVimeoPlayer(media, function () { return hovered; });
      }
    });
  }

  if (canHover && !reduceMotion) {
    document.querySelectorAll('.work-media[data-video]').forEach(function (media) {
      var trigger = media.closest('.work-link') || media;
      if (media.getAttribute('data-provider') === 'vimeo') {
        setupVimeoHover(media, trigger);
      } else {
        setupYouTubeHover(media, trigger);
      }
    });
  }
})();
