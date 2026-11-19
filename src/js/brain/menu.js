const sections = [
  ['intro', 'Accueil'],
  ['passions', 'Passions'],
  ['competences', 'Compétences'],
  ['souvenirs', 'Souvenirs'],
  ['projets', 'Projets'],
];
// The default brain now fills its sidebar slot; keep hover growth proportional.
export const BRAIN_MENU_SCALE = 1.1;

export function createBrainMenu({
  visual,
  main,
  onOpen,
  onPreview,
  onSelect,
  onDisplayResize,
  reduced,
}) {
  const abort = new AbortController(),
    listen = (node, type, fn) => node.addEventListener(type, fn, { signal: abort.signal });
  let expanded = false,
    leaveTimer = 0,
    focusTimer = 0,
    hideTimer = 0,
    overBrain = false,
    overList = false,
    pointerIntent = null,
    sizeFrame = 0,
    disposed = false;
  let baseWidth = parseFloat(visual.style.width),
    baseHeight = parseFloat(visual.style.height);
  const directory = main.querySelector('.skills-directory');
  function resizeBrain(value) {
    cancelAnimationFrame(sizeFrame);
    sizeFrame = 0;
    const fromWidth = parseFloat(visual.style.width),
      fromHeight = parseFloat(visual.style.height),
      toWidth = baseWidth * (value ? BRAIN_MENU_SCALE : 1),
      toHeight = baseHeight * (value ? BRAIN_MENU_SCALE : 1);
    const apply = (t) => {
      visual.style.width = fromWidth + (toWidth - fromWidth) * t + 'px';
      visual.style.height = fromHeight + (toHeight - fromHeight) * t + 'px';
      onDisplayResize?.();
    };
    if (disposed || reduced?.matches) {
      apply(1);
      return;
    }
    const start = performance.now();
    function tick(time) {
      const p = Math.max(0, Math.min(1, (time - start) / 420)),
        ease = 1 - Math.pow(1 - p, 3);
      apply(ease);
      if (p < 1) sizeFrame = requestAnimationFrame(tick);
      else sizeFrame = 0;
    }
    sizeFrame = requestAnimationFrame(tick);
  }
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'brain-menu-trigger';
  trigger.setAttribute('aria-label', 'Explorer les rubriques du portfolio');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-controls', 'brain-sections');
  const hint = document.createElement('span');
  hint.className = 'brain-menu-hint';
  hint.textContent = 'EXPLORER ＋';
  trigger.appendChild(hint);
  visual.appendChild(trigger);
  visual.classList.add('brain-docked');
  const nav = document.createElement('nav');
  nav.id = 'brain-sections';
  nav.className = 'brain-sections';
  nav.hidden = true;
  nav.setAttribute('aria-label', 'Rubriques du portfolio');
  const heading = document.createElement('p');
  heading.textContent = 'OÙ SOUHAITEZ-VOUS ALLER ?';
  nav.appendChild(heading);
  const list = document.createElement('ul');
  nav.appendChild(list);
  const links = [];
  sections.forEach(([id, label], index) => {
    const li = document.createElement('li'),
      link = document.createElement('a');
    link.href = new URL('../../../index.html#' + id, import.meta.url).href;
    link.dataset.section = String(index);
    link.textContent = String(index).padStart(2, '0') + ' / ' + label;
    if (index === 2) link.setAttribute('aria-current', 'page');
    li.appendChild(link);
    list.appendChild(li);
    links.push(link);
    listen(link, 'pointerenter', () => onPreview(index));
    listen(link, 'focus', () => onPreview(index));
    listen(link, 'pointerleave', () => {
      if (document.activeElement !== link) onPreview(null);
    });
    listen(link, 'click', (event) => {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)
        return;
      event.preventDefault();
      setExpanded(false);
      onSelect(index);
    });
  });
  main.appendChild(nav);
  function position() {
    const box = main.getBoundingClientRect(),
      left = parseFloat(visual.style.left),
      top = parseFloat(visual.style.top),
      width = baseWidth,
      height = baseHeight;
    const rail = directory?.getBoundingClientRect();
    const menuLeft = rail?.left ?? left;
    const menuWidth = Math.min(rail?.width || width, innerWidth - menuLeft - 16);
    const menuTop = Math.max(box.top + 16, top + height * BRAIN_MENU_SCALE + 22);
    nav.style.left = menuLeft + 'px';
    nav.style.top = menuTop + 'px';
    nav.style.width = menuWidth + 'px';
    nav.style.maxHeight = Math.max(100, box.bottom - menuTop - 14) + 'px';
  }
  function setExpanded(value) {
    clearTimeout(leaveTimer);
    if (value === expanded) return;
    clearTimeout(hideTimer);
    expanded = value;
    nav.inert = !value;
    if (value) {
      nav.hidden = false;
      nav.getBoundingClientRect();
    } else
      hideTimer = setTimeout(
        () => {
          if (!expanded) nav.hidden = true;
        },
        reduced?.matches ? 0 : 320,
      );
    nav.classList.toggle('is-visible', value);
    trigger.setAttribute('aria-expanded', String(value));
    visual.classList.toggle('is-nav-hovered', value);
    main.classList.toggle('brain-nav-open', value);
    if (directory) directory.inert = value;
    onOpen(value);
    resizeBrain(value);
    if (value) position();
    else onPreview(null);
  }
  function scheduleClose() {
    clearTimeout(leaveTimer);
    leaveTimer = setTimeout(() => {
      if (
        !overBrain &&
        !overList &&
        !nav.contains(document.activeElement) &&
        document.activeElement !== trigger
      )
        setExpanded(false);
    }, 200);
  }
  listen(visual, 'pointerenter', (event) => {
    if (event.pointerType === 'touch') return;
    overBrain = true;
    setExpanded(true);
  });
  listen(visual, 'pointerleave', () => {
    overBrain = false;
    scheduleClose();
  });
  listen(nav, 'pointerenter', () => {
    overList = true;
    clearTimeout(leaveTimer);
  });
  listen(nav, 'pointerleave', () => {
    overList = false;
    onPreview(null);
    scheduleClose();
  });
  listen(trigger, 'pointerdown', () => {
    pointerIntent = !expanded;
  });
  listen(trigger, 'click', () => {
    setExpanded(pointerIntent === null ? !expanded : pointerIntent);
    pointerIntent = null;
  });
  listen(trigger, 'focus', () => setExpanded(true));
  listen(trigger, 'keydown', (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setExpanded(true);
      links[0].focus();
    }
  });
  listen(nav, 'keydown', (event) => {
    const index = links.indexOf(document.activeElement);
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const next =
        event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? links.length - 1
            : (index + (event.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length;
      links[next].focus();
    }
  });
  for (const node of [nav, trigger])
    listen(node, 'keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        trigger.focus();
        setExpanded(false);
      }
    });
  for (const node of [nav, trigger])
    listen(node, 'focusout', () => {
      clearTimeout(focusTimer);
      focusTimer = setTimeout(() => {
        if (
          !overBrain &&
          !overList &&
          !nav.contains(document.activeElement) &&
          document.activeElement !== trigger
        )
          setExpanded(false);
      }, 0);
    });
  listen(document, 'pointerdown', (event) => {
    if (expanded && !nav.contains(event.target) && !visual.contains(event.target))
      setExpanded(false);
  });
  // The dock owner runs first on resize and supplies the new base dimensions.
  listen(window, 'resize', () => {
    cancelAnimationFrame(sizeFrame);
    baseWidth = parseFloat(visual.style.width);
    baseHeight = parseFloat(visual.style.height);
    if (expanded) {
      resizeBrain(true);
      position();
    }
  });
  listen(main, 'scroll', () => {
    if (expanded) position();
  });
  return () => {
    disposed = true;
    clearTimeout(leaveTimer);
    clearTimeout(focusTimer);
    abort.abort();
    cancelAnimationFrame(sizeFrame);
    setExpanded(false);
    clearTimeout(hideTimer);
    cancelAnimationFrame(sizeFrame);
    if (directory) directory.inert = false;
    trigger.remove();
    nav.remove();
    visual.classList.remove('brain-docked', 'is-nav-hovered');
  };
}
