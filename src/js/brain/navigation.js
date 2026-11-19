import { mountSkills } from '../skills/workshop.js';
import { createBrainMenu } from './menu.js';

const ease = (t) => {
  t = Math.max(0, Math.min(1, t));
  return t * t * t * (t * (t * 6 - 15) + 10);
};
export function skillsFlightFrame(
  start,
  dock,
  p,
  viewport = { width: innerWidth, height: innerHeight },
) {
  const sx = start.left + start.width / 2,
    sy = start.top + start.height / 2;
  const cx = viewport.width / 2,
    cy = viewport.height / 2;
  const dx = dock.left + dock.width / 2,
    dy = dock.top + dock.height / 2;
  // One unbroken curve through the center. Ease only at the two endpoints,
  // never independently on either side of the midpoint.
  const t = ease(p),
    controlX = 2 * cx - (sx + dx) / 2,
    controlY = 2 * cy - (sy + dy) / 2;
  const x = (1 - t) * (1 - t) * sx + 2 * (1 - t) * t * controlX + t * t * dx;
  const y = (1 - t) * (1 - t) * sy + 2 * (1 - t) * t * controlY + t * t * dy;
  const scale =
    p <= 0.5
      ? 1 + 0.08 * ease(p / 0.5)
      : 1.08 + (dock.height / start.height - 1.08) * ease((p - 0.5) / 0.5);
  return { offset: p, transform: `translate(${x - sx}px,${y - sy}px) scale(${scale})` };
}
export function createSkillsNavigation({
  visual,
  isReady,
  onChange,
  onResize,
  onDisplayResize,
  onRender,
  onSpin,
  onMenuOpen,
  onPreview,
  onNavigate,
  reduced,
  trigger,
}) {
  const main = document.getElementById('journey');
  let opened = false,
    busy = false,
    animation = null,
    saved = null,
    dispose = null,
    previousFocus = null,
    aspect = 1.28,
    requestId = 0;
  let pagePromise,
    disposeMenu = null;
  function loadPage() {
    if (!pagePromise)
      pagePromise = fetch(new URL('../../../pages/competences.html', import.meta.url))
        .then((r) => {
          if (!r.ok) throw Error('Page indisponible');
          return r.text();
        })
        .then((html) => {
          const doc = new DOMParser().parseFromString(html, 'text/html'),
            content = doc.querySelector('main');
          if (!content) throw Error('Contenu absent');
          return content;
        })
        .catch((error) => {
          pagePromise = null;
          throw error;
        });
    return pagePromise;
  }
  const destination = () => {
    const rect = main.getBoundingClientRect(),
      mobile = innerWidth <= 700;
    if (mobile) {
      const height = Math.min(108, Math.max(82, innerHeight * 0.14)),
        width = Math.min(145, height * aspect);
      return { left: rect.left + 16, top: rect.top + 12, width, height: width / aspect };
    }
    const railWidth = Math.max(0, (rect.width - 84) * 0.25);
    const height = Math.min(240, Math.max(150, rect.height * 0.34));
    const width = Math.min(railWidth * 0.9, height * aspect);
    return {
      left: rect.left + 28 + (railWidth - width) / 2,
      top: rect.top + 24,
      width,
      height: width / aspect,
    };
  };
  function dockBrain() {
    const d = destination();
    visual.style.cssText = `position:fixed;left:${d.left}px;top:${d.top}px;right:auto;bottom:auto;width:${d.width}px;height:${d.height}px;z-index:8;pointer-events:none;`;
    onResize();
    onRender();
  }
  function showContent(content) {
    if (saved.nodes) return;
    saved.nodes = document.createDocumentFragment();
    while (main.firstChild) saved.nodes.appendChild(main.firstChild);
    main.classList.add('skills-main');
    main.setAttribute('aria-label', 'Mes compétences, atelier interactif');
    main.append(...[...content.childNodes].map((node) => node.cloneNode(true)));
    main.scrollTop = 0;
    dispose = mountSkills(main);
    main.querySelector('[data-back-to-brain]')?.addEventListener('click', () => close());
    main.classList.add('skills-reveal');
    main.querySelector('h1')?.focus({ preventScroll: true });
  }
  async function open({ history = true } = {}) {
    if (opened || busy) return;
    busy = true;
    const id = ++requestId;
    previousFocus = document.activeElement;
    try {
      const content = await loadPage();
      if (id !== requestId) return;
      saved = {
        style: visual.getAttribute('style') || '',
        label: main.getAttribute('aria-label'),
        left: main.scrollLeft,
        top: main.scrollTop,
        nodes: null,
      };
      const start = visual.getBoundingClientRect();
      aspect = start.width / start.height;
      opened = true;
      onChange(true);
      document.body.classList.add('skills-open');
      const dock = destination(),
        duration = 1650;
      if (isReady() && !reduced.matches) {
        visual.style.cssText = `position:fixed;left:${start.left}px;top:${start.top}px;right:auto;bottom:auto;width:${start.width}px;height:${start.height}px;z-index:8;pointer-events:none;transform-origin:50% 50%;`;
        onSpin?.(duration);
        const viewport = { width: innerWidth, height: innerHeight };
        animation = visual.animate(
          Array.from({ length: 81 }, (_, i) => skillsFlightFrame(start, dock, i / 80, viewport)),
          { duration, easing: 'linear', fill: 'forwards' },
        );
        // At the center of the flight, swap only the main's children.
        await new Promise((resolve) => setTimeout(resolve, duration * 0.5));
        if (id !== requestId) return;
        showContent(content);
        await animation.finished;
        if (id !== requestId) return;
        animation.cancel();
      } else showContent(content);
      dockBrain();
      disposeMenu = createBrainMenu({
        visual,
        main,
        onDisplayResize,
        reduced,
        onOpen: (value) => onMenuOpen?.(value),
        onPreview: (index) => onPreview?.(index),
        onSelect: (index) => {
          if (index === 2) return;
          close({ history: false });
          onNavigate?.(index);
        },
      });
      if (history) {
        const url = new URL(location.href);
        url.searchParams.set('view', 'competences');
        url.hash = 'competences';
        window.history.pushState({ view: 'competences' }, '', url);
      }
    } catch (error) {
      if (id === requestId) {
        console.error('Navigation compétences', error);
        close({ history: false });
      }
    } finally {
      if (id === requestId) busy = false;
    }
  }
  function close({ history = true } = {}) {
    ++requestId;
    busy = false;
    animation?.cancel();
    disposeMenu?.();
    disposeMenu = null;
    dispose?.();
    dispose = null;
    if (!opened) return;
    opened = false;
    if (saved.nodes) {
      main.replaceChildren(saved.nodes);
      main.classList.remove('skills-main', 'skills-reveal');
      main.setAttribute('aria-label', saved.label);
    }
    main.scrollLeft = saved.left;
    main.scrollTop = saved.top;
    visual.setAttribute('style', saved.style);
    document.body.classList.remove('skills-open');
    onChange(false);
    onResize();
    onRender();
    saved = null;
    if (history) {
      const url = new URL(location.href);
      url.searchParams.delete('view');
      url.hash = 'competences';
      window.history.replaceState(null, '', url);
    }
    previousFocus?.focus({ preventScroll: true });
  }
  trigger?.addEventListener('pointerenter', () => loadPage().catch(() => {}), { once: true });
  trigger?.addEventListener('focus', () => loadPage().catch(() => {}), { once: true });
  trigger?.addEventListener('click', (event) => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)
      return;
    event.preventDefault();
    open();
  });
  window.addEventListener('popstate', () => {
    if (new URL(location.href).searchParams.get('view') === 'competences') open({ history: false });
    else close({ history: false });
  });
  window.addEventListener('resize', () => {
    if (opened && !busy) dockBrain();
  });
  document.querySelector('.brand')?.addEventListener('click', () => {
    if (opened) close();
  });
  return { open, close };
}
