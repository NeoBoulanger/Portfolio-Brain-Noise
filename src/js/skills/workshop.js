export function skillStateForStep(step) {
  return { html: step >= 0, css: step >= 1, js: step >= 2 };
}
export function mountSkills(root = document) {
  const abort = new AbortController();
  if (root.nodeType === 9)
    root.querySelector('[data-back-to-brain]')?.addEventListener(
      'click',
      () => {
        location.href = new URL('../../../index.html#competences', import.meta.url).href;
      },
      { signal: abort.signal },
    );
  const listen = (target, type, handler, options = {}) =>
    target.addEventListener(type, handler, { ...options, signal: abort.signal });
  const byId = (id) => root.querySelector('#' + id);
  const toggles = { html: byId('html-toggle'), css: byId('css-toggle'), js: byId('js-toggle') };
  const stage = byId('stage'),
    mount = byId('object-mount');
  let square = null,
    dragging = false,
    following = true,
    activeStep = -2,
    storyFrame = 0,
    disposed = false;

  function resetTilt() {
    if (square) {
      square.style.removeProperty('--rotate-x');
      square.style.removeProperty('--rotate-y');
    }
    byId('coordinates').textContent = 'X 0° / Y 0°';
  }
  function setTilt(x, y) {
    if (!square || !toggles.js.checked) return;
    const clamp = (n) => Math.max(-1, Math.min(1, n));
    const rx = Math.round(-clamp(y) * 20),
      ry = Math.round(clamp(x) * 24);
    square.style.setProperty('--rotate-x', rx + 'deg');
    square.style.setProperty('--rotate-y', ry + 'deg');
    byId('coordinates').textContent = 'X ' + rx + '° / Y ' + ry + '°';
  }
  function render() {
    const html = toggles.html.checked,
      css = toggles.css.checked,
      js = toggles.js.checked;
    if (html && !square) {
      square = document.createElement('div');
      square.className = 'demo-square';
      square.setAttribute('role', 'img');
      square.setAttribute('aria-label', 'Carré de démonstration');
      const content = document.createElement('div');
      content.className = 'card-content';
      content.innerHTML =
        '<div class="card-top"><span>WEB / 001</span><span>↗</span></div><div class="card-word">MAKE<br><em>it work.</em></div><div class="card-bottom">STRUCTURE → STYLE → ACTION</div>';
      square.appendChild(content);
      mount.appendChild(square);
    } else if (!html && square) {
      square.remove();
      square = null;
    }
    if (square) {
      square.classList.toggle('is-styled', css);
      square.setAttribute(
        'aria-label',
        css ? 'Carré stylisé, carte Make it work' : 'Carré blanc sans style graphique',
      );
    }
    resetTilt();
    byId('empty').hidden = html;
    stage.classList.toggle('is-interactive', html && js);
    byId('coordinates').hidden = !html || !js;
    const waiting = [css ? 'CSS' : null, js ? 'JavaScript' : null].filter(Boolean);
    byId('dependency').textContent = !html
      ? waiting.length
        ? waiting.join(' et ') +
          ' activé' +
          (waiting.length > 1 ? 's' : '') +
          ' : en attente de HTML.'
        : 'Commencez par HTML pour créer votre élément.'
      : 'Désactivez un langage pour observer ce qu’il apporte.';
    byId('mode-label').textContent = !html
      ? 'EN ATTENTE'
      : js
        ? 'INTERACTIF'
        : css
          ? 'STYLISÉ'
          : 'STRUCTURE';
    byId('stage-help').textContent = !html
      ? 'Activez HTML pour faire apparaître le carré.'
      : js
        ? 'Déplacez le curseur, glissez avec le doigt ou utilisez les flèches dans cette zone.'
        : css
          ? 'Le CSS change son apparence. Activez JavaScript pour lui donner un comportement.'
          : 'Le carré existe. Activez CSS pour le styliser, ou JavaScript pour le faire bouger.';
    byId('explanation').textContent = !html
      ? 'Sans HTML, aucun élément à afficher. Les autres interrupteurs gardent leur état et attendent la structure.'
      : css && js
        ? 'HTML crée l’élément, CSS lui donne son apparence, JavaScript met à jour sa rotation selon votre position. Les trois contributions se combinent.'
        : js
          ? 'Même sans le style graphique, JavaScript peut faire réagir le carré blanc à vos mouvements.'
          : css
            ? 'Une classe CSS transforme le carré blanc en carte graphique. La structure HTML est la même.'
            : 'HTML ajoute réellement un élément à la page. Le carré blanc est son rendu de base pour cette démonstration.';
    const code = [];
    if (html) code.push('HTML  <div class="demo-square' + (css ? ' is-styled' : '') + '"></div>');
    if (css)
      code.push('CSS   .is-styled { background: lavender;\n        border: 1px solid orange; }');
    if (js)
      code.push('JS    pointermove → position du curseur\n      → rotateX(angle) rotateY(angle)');
    byId('code').textContent =
      code.join('\n\n') || '// Activez un langage pour découvrir son rôle.';
  }
  function setFollowing(value) {
    following = value;
    byId('follow-scroll').hidden = value;
    byId('follow-label').textContent = value
      ? 'LE SCROLL CONSTRUIT LA DÉMO'
      : 'À VOUS DE JOUER · RÉGLAGES LIBRES';
  }
  Object.values(toggles).forEach((toggle) =>
    listen(toggle, 'change', () => {
      setFollowing(false);
      render();
    }),
  );
  listen(byId('reset'), 'click', () => {
    setFollowing(false);
    Object.values(toggles).forEach((toggle) => {
      toggle.checked = false;
    });
    render();
  });
  listen(stage, 'pointermove', (event) => {
    if (event.pointerType !== 'mouse' && !dragging) return;
    const box = stage.getBoundingClientRect();
    setTilt(
      ((event.clientX - box.left) / box.width) * 2 - 1,
      ((event.clientY - box.top) / box.height) * 2 - 1,
    );
  });
  listen(stage, 'pointerdown', (event) => {
    if (event.pointerType === 'mouse' || !square || !toggles.js.checked) return;
    dragging = true;
    stage.setPointerCapture(event.pointerId);
    const box = stage.getBoundingClientRect();
    setTilt(
      ((event.clientX - box.left) / box.width) * 2 - 1,
      ((event.clientY - box.top) / box.height) * 2 - 1,
    );
  });
  function stopDrag() {
    dragging = false;
    resetTilt();
  }
  listen(stage, 'pointerup', stopDrag);
  listen(stage, 'pointercancel', stopDrag);
  listen(stage, 'lostpointercapture', stopDrag);
  listen(stage, 'pointerleave', () => {
    if (!dragging) resetTilt();
  });
  listen(stage, 'blur', resetTilt);
  listen(stage, 'keydown', (event) => {
    if (!square || !toggles.js.checked) return;
    const direction = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    if (direction[event.key]) {
      event.preventDefault();
      setTilt(...direction[event.key]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      resetTilt();
    }
  });
  render();
  const steps = [...root.querySelectorAll('[data-skill-step]')];
  const scene = root.querySelector('.story-scene');
  const standalone = root.nodeType === 9,
    scrollTarget = standalone ? window : root;
  function updateStory() {
    storyFrame = 0;
    if (disposed) return;
    const viewport = standalone ? { top: 0, height: innerHeight } : root.getBoundingClientRect();
    const height = String(Math.round(viewport.height)) + 'px';
    if (root.style && root.style.getPropertyValue('--skills-viewport') !== height)
      root.style.setProperty('--skills-viewport', height);
    const mobile = innerWidth <= 700;
    const line =
      viewport.top +
      (mobile
        ? Math.min(scene.getBoundingClientRect().height + 110, viewport.height * 0.84)
        : viewport.height * 0.53);
    let next = -1;
    steps.forEach((step, i) => {
      if (step.getBoundingClientRect().top <= line) next = i;
    });
    steps.forEach((step, i) => {
      step.classList.toggle('is-current', i === next);
      if (i === next) step.setAttribute('aria-current', 'step');
      else step.removeAttribute('aria-current');
    });
    byId('story-progress').textContent = String(next + 1).padStart(2, '0') + ' / 04';
    byId('story-progress-fill').style.transform = 'scaleX(' + (next + 1) / 4 + ')';
    if (next !== activeStep) {
      activeStep = next;
      if (following) {
        const state = skillStateForStep(next);
        for (const key of Object.keys(toggles)) toggles[key].checked = state[key];
        render();
      }
    }
  }
  function scheduleStory() {
    if (!storyFrame) storyFrame = requestAnimationFrame(updateStory);
  }
  listen(scrollTarget, 'scroll', scheduleStory, { passive: true });
  listen(window, 'resize', scheduleStory, { passive: true });
  listen(byId('follow-scroll'), 'click', () => {
    setFollowing(true);
    activeStep = -2;
    updateStory();
  });
  setFollowing(true);
  scheduleStory();
  return () => {
    disposed = true;
    abort.abort();
    cancelAnimationFrame(storyFrame);
    dragging = false;
    resetTilt();
  };
}
if (document.querySelector('#stage')) mountSkills(document);
