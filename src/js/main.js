import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  BLOCK,
  END,
  timelineState,
  timelineForProgress,
  facingAngles,
  rotationStep,
} from './brain/journey.js';
import { createSkillsNavigation } from './brain/navigation.js';
import { BRAIN_MENU_SCALE } from './brain/menu.js';

const $ = (id) => document.getElementById(id),
  canvas = $('brain'),
  loading = $('loading');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let skillsOpen = false,
  skillsNavigation = null;
let skillsFlight = null;
let brainNavOpen = false,
  brainNavPreview = null;
document.querySelector('a[href="#atelier"]').addEventListener('click', (e) => {
  e.preventDefault();
  $('atelier').open = true;
  $('pattern').focus({ preventScroll: true });
});
$('motion').checked = !reduced.matches;
const sections = [...document.querySelectorAll('main section')];
const links = [...document.querySelectorAll('.chapters a')];
const journey = $('journey'),
  contents = sections.map((s) => s.querySelector('.section-content'));
const titles = sections.map((s) => s.querySelector('h1,h2'));
const titleLights = titles.map((title) => {
  const label = document.createElement('span');
  label.className = 'neon-label';
  while (title.firstChild) label.appendChild(title.firstChild);
  title.appendChild(label);
  label.addEventListener('animationend', () => label.classList.remove('neon-ignite'));
  return { label, ignited: false };
});
function updateTitleLights() {
  const viewport = journey.getBoundingClientRect(),
    margin = 12;
  titleLights.forEach((light) => {
    if (reduced.matches) {
      light.label.classList.remove('neon-ignite');
      light.ignited = true;
      return;
    }
    const r = light.label.getBoundingClientRect();
    const visible =
      r.left >= Math.max(0, viewport.left) + margin &&
      r.right <= Math.min(innerWidth, viewport.right) - margin &&
      r.top >= viewport.top + margin &&
      r.bottom <= viewport.bottom - margin;
    if (!visible) {
      // Cancel an ignition if the user moves away, so it never flashes clipped.
      light.label.classList.remove('neon-ignite');
      if (r.right < viewport.left || r.left > viewport.right) light.ignited = false;
      return;
    }
    if (!light.ignited) {
      light.ignited = true;
      light.label.classList.add('neon-ignite');
    }
  });
}
const titleEntrances = [
  [0, 75, -3],
  [-105, 12, -3],
  [35, -85, 3],
  [95, 35, 2],
  [-35, 90, -2],
];
const palettes = [
  { paper: '#f2ebdd', ink: '#1f3a2e', accent: '#e4f542' },
  { paper: '#1f3a2e', ink: '#f2ebdd', accent: '#e4f542' },
  { paper: '#141b3c', ink: '#c9bbf5', accent: '#ff7a2f' },
  { paper: '#221c35', ink: '#f2ebdd', accent: '#c9bbf5' },
  { paper: '#141b3c', ink: '#f2ebdd', accent: '#e4f542' },
];
let activePalette = -1;
const mixPaper = new THREE.Color(),
  mixAccent = new THREE.Color(),
  mixInk = new THREE.Color();
const names = [
  'VUE D’ENSEMBLE',
  'PASSIONS / TEMPORAL',
  'COMPÉTENCES / FRONTAL',
  'SOUVENIRS / PARIÉTAL',
  'PROJETS / OCCIPITAL',
];
// Associations are illustrative chapter markers, not neuroscience claims.
const targets = [null, 'temporal', 'frontal', 'parietal', 'occipital'];
const poses = [
  [-0.12, -0.65, 0.06],
  [-0.1, 0.85, -0.04],
  [-0.2, 2.65, 0.05],
  [0.26, 4.15, -0.08],
  [-0.08, 5.65, 0.02],
];
let renderer,
  scene,
  camera,
  group,
  materials = [],
  frame = 0,
  progress = 0,
  current = 0,
  last = 0,
  loaded = false;
let lastScrollTime = performance.now(),
  wheelTarget = 0,
  wheelFrame = 0,
  wheelTime = 0;
let timeline = 0,
  zoomAmount = 0,
  displayZoom = 0,
  expectedScroll = 0;
let spinYaw = poses[0][1],
  spinVelocity = 0.055,
  previousProgress = 0,
  scrollSpeed = 0;
const paper = new THREE.Color($('paper').value),
  ink = new THREE.Color($('ink').value),
  accent = new THREE.Color($('accent').value);
const shared = {
  uPaper: { value: paper },
  uInk: { value: ink },
  uAccent: { value: accent },
  uSize: { value: 5 },
  uDpr: { value: 1 },
  uContrast: { value: 1.15 },
  uPattern: { value: 0 },
};
const vertex = `varying vec3 vNormal;void main(){vNormal=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;
const fragment = `precision highp float;
varying vec3 vNormal;uniform vec3 uPaper,uInk,uAccent;uniform float uSize,uDpr,uContrast,uPattern,uHighlight;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
void main(){
 vec3 n=normalize(vNormal);float light=dot(n,normalize(vec3(-.5,.65,1.0)))*.5+.5;
 float shade=clamp((1.0-light-.07)*uContrast*1.65,.015,.98);
 vec2 pixel=gl_FragCoord.xy/uDpr;vec2 uv=pixel/uSize;vec2 cell=fract(uv)-.5;
 // Differentiate continuous coordinates: fract() edges created visible grid seams.
 float aa=max(fwidth(uv.x),fwidth(uv.y));float mark;
 if(uPattern<.5){
  // Stable, jittered ink dots instead of a regular square lattice.
  vec2 base=floor(uv);mark=0.0;
  for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
   vec2 id=base+vec2(float(x),float(y));
   vec2 jitter=vec2(hash(id+vec2(17.3,9.1)),hash(id+vec2(4.7,31.2)))-.5;
   vec2 center=id+.5+jitter*.8;
   float radius=sqrt(shade/3.14159265)*mix(.78,1.18,hash(id+vec2(53.0,2.0)));
   mark=max(mark,1.0-smoothstep(radius-aa,radius+aa,length(uv-center)));
  }
  mark=mix(mark,1.0,smoothstep(.75,1.0,shade));
 }
 else if(uPattern<1.5){float d=abs(fract((uv.x+uv.y)*.7071)-.5);float edge=shade*.48;mark=1.0-smoothstep(edge-aa,edge+aa,d);}
 else if(uPattern<2.5){float d=min(abs(fract((uv.x+uv.y)*.7071)-.5),abs(fract((uv.x-uv.y)*.7071)-.5));float edge=(1.0-sqrt(1.0-shade))*.5;mark=1.0-smoothstep(edge-aa,edge+aa,d);}
 else if(uPattern<3.5){float noise=hash(floor(pixel/max(1.0,uSize*.35)));mark=smoothstep(noise-.035,noise+.035,shade);}
 else if(uPattern<4.5){vec2 b=mod(floor(uv*2.0),4.0);float t=mod(b.x,2.0)*8.0+mod(b.y,2.0)*4.0+floor(b.x/2.0)*2.0+floor(b.y/2.0);mark=step((t+.5)/16.0,shade);}
 else{mark=floor(shade*3.0+.5)/3.0;}
 vec3 color=mix(uPaper,mix(uInk,uAccent,uHighlight),mark);
 gl_FragColor=vec4(color,1.0);
 #include <colorspace_fragment>
}`;

function requestRender() {
  if (!frame && !document.hidden) frame = requestAnimationFrame(render);
}
function measureProgress() {
  return THREE.MathUtils.clamp(
    journey.scrollLeft / Math.max(1, journey.clientWidth),
    0,
    sections.length - 1,
  );
}
function applyPalette(position) {
  if (skillsOpen) return;
  if (!$('autoPalette').checked) return;
  const key = reduced.matches ? Math.round(position) : Math.round(position * 10000) / 10000;
  if (activePalette === key) return;
  activePalette = key;
  const i = Math.min(3, Math.floor(position)),
    a = palettes[i],
    b = palettes[i + 1];
  const blend = reduced.matches
    ? position - i < 0.5
      ? 0
      : 1
    : THREE.MathUtils.smootherstep(position - i, 0.22, 0.78);
  mixPaper.set(a.paper).lerp(new THREE.Color(b.paper), blend);
  mixAccent.set(a.accent).lerp(new THREE.Color(b.accent), blend);
  mixInk.set(a.ink).lerp(new THREE.Color(b.ink), blend);
  paper.copy(mixPaper);
  ink.copy(mixInk);
  accent.copy(mixAccent);
  for (const [id, color] of [
    ['paper', paper],
    ['ink', ink],
    ['accent', accent],
  ])
    document.documentElement.style.setProperty('--' + id, '#' + color.getHexString());
  const nearest = palettes[Math.round(position)];
  for (const id of ['paper', 'ink', 'accent']) $(id).value = nearest[id];
}
function updateJourney() {
  progress = measureProgress();
  const stop = Math.round(progress);
  $('progressBar').style.transform = 'scaleX(' + timeline / END + ')';
  $('chapterCount').textContent = String(stop + 1).padStart(2, '0') + ' / 05';
  $('previous').disabled = progress < 0.02;
  $('next').disabled = progress > 3.98;
  const anchor = timelineState(timeline);
  $('anchorHint').textContent = anchor.anchored
    ? 'CONTINUEZ POUR RÉVÉLER LA SUITE'
    : 'EXPLORATION EN MOUVEMENT';
  $('anchorMeter').style.transform = 'scaleX(' + anchor.zoom + ')';
  contents.forEach((content, i) => {
    const distance = progress - i,
      amount = Math.min(1, Math.abs(distance)),
      ease = THREE.MathUtils.smootherstep(amount, 0, 1);
    content.style.opacity = reduced.matches ? '1' : String(1 - ease * 0.88);
    content.style.transform = reduced.matches
      ? 'none'
      : 'translate3d(' + -distance * 24 + 'px,0,0)';
    const [x, y, angle] = titleEntrances[i],
      direction = distance > 0 ? -1 : 1;
    const titleScale = 1 + (!reduced.matches && anchor.section === i ? anchor.zoom * 0.055 : 0);
    titles[i].style.transform = reduced.matches
      ? 'none'
      : 'translate3d(' +
        x * ease * direction +
        'px,' +
        y * ease +
        'px,0) rotate(' +
        angle * ease * direction +
        'deg) scale(' +
        titleScale +
        ')';
    titles[i].style.opacity = reduced.matches
      ? '1'
      : String(1 - THREE.MathUtils.smoothstep(amount, 0.2, 0.95));
  });
  updateTitleLights();
  links.forEach((a, i) => a.setAttribute('aria-current', String(i === stop)));
  $('region').textContent = names[stop];
  requestRender();
}
function setTimeline(value) {
  timeline = THREE.MathUtils.clamp(value, 0, END);
  const state = timelineState(timeline);
  zoomAmount = reduced.matches ? 0 : state.zoom;
  expectedScroll = state.progress * journey.clientWidth;
  journey.scrollLeft = expectedScroll;
  updateJourney();
}
function stopWheel() {
  cancelAnimationFrame(wheelFrame);
  wheelFrame = 0;
  wheelTime = 0;
  wheelTarget = timeline;
}
function goTo(index) {
  stopWheel();
  const i = THREE.MathUtils.clamp(index, 0, 4);
  wheelTarget = i * BLOCK;
  if (reduced.matches) setTimeline(wheelTarget);
  else wheelFrame = requestAnimationFrame(moveWheel);
}
links.forEach((a, i) =>
  a.addEventListener('click', (e) => {
    e.preventDefault();
    goTo(i);
    history.replaceState(null, '', '#' + sections[i].id);
  }),
);
document.querySelector('.brand').addEventListener('click', (e) => {
  e.preventDefault();
  goTo(0);
});
$('previous').onclick = () => goTo(Math.round(measureProgress()) - 1);
$('next').onclick = () => goTo(Math.round(measureProgress()) + 1);
// Wheel remains native inside the settings panel and browser zoom gestures.
function moveWheel(time) {
  const dt = wheelTime && Number.isFinite(time) ? Math.min(50, time - wheelTime) : 16.67;
  wheelTime = Number.isFinite(time) ? time : 0;
  const distance = wheelTarget - timeline;
  if (Math.abs(distance) < 0.0005) {
    setTimeline(wheelTarget);
    wheelFrame = 0;
    wheelTime = 0;
    return;
  }
  setTimeline(timeline + distance * (1 - Math.exp(-dt / 260)));
  wheelFrame = requestAnimationFrame(moveWheel);
}
function scrollInput(delta) {
  lastScrollTime = performance.now();
  if (!wheelFrame) wheelTarget = timeline;
  const step = (delta * 1.45) / Math.max(1, journey.clientWidth);
  wheelTarget = THREE.MathUtils.clamp(wheelTarget + step, 0, END);
  if (reduced.matches) {
    setTimeline(wheelTarget);
    return;
  }
  if (!wheelFrame) wheelFrame = requestAnimationFrame(moveWheel);
  // No timer, barrier or snap: inertia only consumes the user's scroll distance.
}
addEventListener(
  'wheel',
  (e) => {
    if (skillsOpen) return;
    if (e.ctrlKey || e.target.closest('details,input,select,textarea')) return;
    const raw = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    const delta = raw * (e.deltaMode === 1 ? 18 : e.deltaMode === 2 ? journey.clientWidth : 1);
    if (!delta) return;
    e.preventDefault();
    scrollInput(delta);
  },
  { passive: false, capture: true },
);
journey.addEventListener('pointerdown', stopWheel, { passive: true });
let touchX = null,
  touchY = null,
  touchDirection = null;
journey.addEventListener(
  'touchstart',
  (e) => {
    if (skillsOpen) return;
    if (e.touches.length !== 1) return;
    stopWheel();
    touchX = e.touches[0].clientX;
    touchY = e.touches[0].clientY;
    touchDirection = null;
  },
  { passive: true },
);
journey.addEventListener(
  'touchmove',
  (e) => {
    if (skillsOpen) return;
    if (touchX === null || e.touches.length !== 1) return;
    const x = e.touches[0].clientX,
      y = e.touches[0].clientY,
      dx = touchX - x,
      dy = touchY - y;
    if (!touchDirection && Math.max(Math.abs(dx), Math.abs(dy)) > 3)
      touchDirection = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    if (!touchDirection) return;
    e.preventDefault();
    scrollInput((touchDirection === 'x' ? dx : dy) * 1.2);
    touchX = x;
    touchY = y;
  },
  { passive: false },
);
journey.addEventListener(
  'touchend',
  () => {
    touchX = touchY = null;
    touchDirection = null;
  },
  { passive: true },
);
addEventListener('keydown', (e) => {
  if (skillsOpen) return;
  if (e.target.closest('input,select,textarea,summary,button')) return;
  const keys = { ArrowRight: 1, ArrowLeft: -1, PageDown: 1, PageUp: -1, ' ': e.shiftKey ? -1 : 1 };
  if (e.key in keys) {
    e.preventDefault();
    goTo(Math.round(measureProgress()) + keys[e.key]);
  } else if (e.key === 'Home' || e.key === 'End') {
    e.preventDefault();
    goTo(e.key === 'Home' ? 0 : 4);
  }
});
function resize() {
  if (!renderer) return;
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, rect.width),
    height = Math.max(1, rect.height),
    aspect = width / height;
  const half = aspect < 1 ? 2.05 / aspect : 2.05;
  camera.left = -half * aspect;
  camera.right = half * aspect;
  camera.top = half;
  camera.bottom = -half;
  camera.updateProjectionMatrix();
  const dpr = Math.min(devicePixelRatio || 1, 1.5);
  renderer.setPixelRatio(dpr * (skillsOpen ? BRAIN_MENU_SCALE : 1));
  renderer.setSize(width, height, false);
  refreshBrainDisplay();
}
const brainBufferSize = new THREE.Vector2();
function refreshBrainDisplay() {
  if (!renderer) return;
  renderer.getDrawingBufferSize(brainBufferSize);
  // Only a uniform changes while the dock grows; GPU targets stay allocated.
  shared.uDpr.value = brainBufferSize.x / Math.max(1, canvas.getBoundingClientRect().width);
  requestRender();
}
function render(time) {
  frame = 0;
  if (document.hidden) return;
  // Commit CSS and shader colors in the same frame, before drawing the brain.
  applyPalette(progress);
  if (!loaded) return;
  const dt = Math.min((time - last) / 1000 || 0.016, 0.06);
  last = time;
  const animated = $('motion').checked && !reduced.matches;
  current = animated
    ? THREE.MathUtils.lerp(current, progress, 1 - Math.exp(-dt * 9))
    : Math.round(progress);
  const i = Math.min(3, Math.floor(current)),
    t = THREE.MathUtils.smoothstep(current - i, 0, 1),
    a = poses[i],
    b = poses[i + 1];
  if (animated) group.rotation.set(...a.map((v, k) => THREE.MathUtils.lerp(v, b[k], t)));
  else group.rotation.set(...poses[Math.round(progress)]);
  const autoRotate = ($('autoRotate').checked || skillsOpen) && !reduced.matches;
  const measuredSpeed = Math.abs(progress - previousProgress) / Math.max(dt, 0.001);
  previousProgress = progress;
  scrollSpeed = THREE.MathUtils.lerp(scrollSpeed, measuredSpeed, 1 - Math.exp(-dt * 5));
  if (autoRotate) {
    // Aim at the chapter becoming active, with less lag than the pose animation.
    const targetSection = Math.min(4, Math.round(progress));
    const heading = poses[targetSection][1];
    const spin = skillsOpen
      ? {
          velocity: THREE.MathUtils.lerp(
            spinVelocity,
            brainNavOpen ? 0.85 : 0.38,
            1 - Math.exp(-dt * 4),
          ),
        }
      : rotationStep(spinYaw, spinVelocity, heading, scrollSpeed, dt);
    if (skillsOpen) spin.yaw = spinYaw + Math.max(0.035, spin.velocity) * dt;
    spinVelocity = spin.velocity;
    spinYaw = spin.yaw;
    group.rotation.y = spinYaw;
  } else spinYaw = group.rotation.y;
  if (skillsFlight) {
    const flightProgress = THREE.MathUtils.clamp(
      (time - skillsFlight.start) / skillsFlight.duration,
      0,
      1,
    );
    const turn = THREE.MathUtils.smootherstep(flightProgress, 0, 1) * Math.PI * 2;
    // Add only the new fraction of the turn so the usual slow spin never stops.
    spinYaw += turn - skillsFlight.applied;
    skillsFlight.applied = turn;
    group.rotation.y = spinYaw;
    if (flightProgress === 1) skillsFlight = null;
  }
  group.rotation.x = THREE.MathUtils.clamp(group.rotation.x, -0.105, 0.105);
  group.rotation.z = THREE.MathUtils.clamp(group.rotation.z, -0.045, 0.045);
  displayZoom = reduced.matches
    ? 0
    : THREE.MathUtils.lerp(displayZoom, zoomAmount, 1 - Math.exp(-dt * 12));
  group.scale.setScalar(1 + displayZoom * 0.025);
  const stop = Math.min(4, Math.round(current));
  materials.forEach(({ material, region }) => {
    let weight = 0;
    if (skillsOpen && brainNavPreview !== null) {
      weight = region === targets[brainNavPreview] ? 1 : 0;
    } else if ($('highlight').checked) {
      if (region === targets[i]) weight += 1 - t;
      if (region === targets[i + 1]) weight += t;
    }
    material.uniforms.uHighlight.value = reduced.matches
      ? weight
      : THREE.MathUtils.lerp(material.uniforms.uHighlight.value, weight, 1 - Math.exp(-dt * 12));
  });
  group.position.x = Math.sin(current * Math.PI) * 0.09;
  renderer.render(scene, camera);
  if (
    autoRotate ||
    (animated && Math.abs(current - progress) > 0.0003) ||
    Math.abs(displayZoom - zoomAmount) > 0.0003
  )
    requestRender();
}
async function init() {
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'low-power',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    // The page supplies one continuous background, including behind the brain.
    scene = new THREE.Scene();
    camera = new THREE.OrthographicCamera(-3, 3, 3, -3, 0.1, 30);
    camera.position.set(0, 0.15, 8);
    camera.lookAt(0, 0, 0);
    group = new THREE.Group();
    scene.add(group);
    const gltf = await new GLTFLoader().loadAsync(
      new URL('../../assets/models/brain.glb', import.meta.url).href,
      (event) => {
        if (event.total)
          loading.textContent =
            'Chargement du cerveau · ' + Math.round((event.loaded / event.total) * 100) + ' %';
      },
    );
    const model = gltf.scene;
    model.updateMatrixWorld(true);
    const orientationBox = new THREE.Box3().setFromObject(model),
      orientationCenter = orientationBox.getCenter(new THREE.Vector3());
    const regionDirections = new Map();
    model.traverse((mesh) => {
      if (!mesh.isMesh || !mesh.name.toLowerCase().startsWith('left-')) return;
      const region = targets.find((s) => s && mesh.name.toLowerCase().includes(s));
      if (!region) return;
      const localBox = new THREE.Box3().setFromObject(mesh),
        direction = localBox.getCenter(new THREE.Vector3()).sub(orientationCenter);
      regionDirections.set(region, direction);
    });
    for (let stop = 1; stop < poses.length; stop++) {
      const direction = regionDirections.get(targets[stop]);
      if (!direction) continue;
      const angles = facingAngles(direction.x, direction.y, direction.z);
      // Choose the equivalent yaw nearest to the previous stop, avoiding full turns.
      while (angles[1] - poses[stop - 1][1] > Math.PI) angles[1] -= Math.PI * 2;
      while (angles[1] - poses[stop - 1][1] < -Math.PI) angles[1] += Math.PI * 2;
      poses[stop] = angles;
    }
    model.traverse((mesh) => {
      if (!mesh.isMesh) return;
      const name = mesh.name.toLowerCase();
      if (/ventricle|aqueduct|hippocampus/.test(name)) {
        mesh.visible = false;
        return;
      }
      const material = new THREE.ShaderMaterial({
        uniforms: { ...shared, uHighlight: { value: 0 } },
        vertexShader: vertex,
        fragmentShader: fragment,
      });
      const original = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      original.forEach((m) => m.dispose());
      mesh.material = material;
      materials.push({ material, region: targets.find((s) => s && name.includes(s)) || 'other' });
    });
    const box = new THREE.Box3().setFromObject(model),
      size = box.getSize(new THREE.Vector3()),
      center = box.getCenter(new THREE.Vector3());
    model.position.sub(center);
    const normalized = new THREE.Group();
    normalized.add(model);
    normalized.scale.setScalar(3.25 / Math.max(size.x, size.y, size.z));
    group.add(normalized);
    loaded = true;
    loading.hidden = true;
    progress = measureProgress();
    current = progress;
    previousProgress = progress;
    spinYaw = poses[Math.round(progress)][1];
    resize();
    requestRender();
    if (new URL(location.href).searchParams.get('view') === 'competences')
      skillsNavigation.open({ history: false });
  } catch (error) {
    console.error(error);
    loading.hidden = false;
    loading.textContent =
      'Le cerveau n’a pas pu être affiché. Lancez cette page depuis http://localhost:8000 (voir README). Vérifiez également que WebGL est disponible. Les chapitres restent accessibles.';
  }
}
journey.addEventListener(
  'scroll',
  () => {
    if (skillsOpen) return;
    lastScrollTime = performance.now();
    if (Math.abs(journey.scrollLeft - expectedScroll) > 1) {
      stopWheel();
      timeline = timelineForProgress(measureProgress());
      zoomAmount = timelineState(timeline).zoom;
      wheelTarget = timeline;
      expectedScroll = journey.scrollLeft;
    }
    updateJourney();
  },
  { passive: true },
);
let lastWidth = journey.clientWidth;
addEventListener('resize', () => {
  if (skillsOpen) {
    resize();
    return;
  }
  stopWheel();
  lastWidth = journey.clientWidth;
  setTimeline(timeline);
  resize();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    cancelAnimationFrame(frame);
    frame = 0;
    stopWheel();
  } else {
    last = performance.now();
    requestRender();
  }
});
for (const id of [
  'pattern',
  'dotSize',
  'contrast',
  'ink',
  'paper',
  'accent',
  'highlight',
  'motion',
  'autoPalette',
  'autoRotate',
])
  $(id).addEventListener('input', () => {
    if (['ink', 'paper', 'accent'].includes(id)) {
      $('autoPalette').checked = false;
      activePalette = -1;
    }
    if (id === 'autoPalette') activePalette = -1;
    shared.uPattern.value = +$('pattern').value;
    shared.uSize.value = +$('dotSize').value;
    shared.uContrast.value = +$('contrast').value;
    if (!$('autoPalette').checked) {
      paper.set($('paper').value);
      ink.set($('ink').value);
      accent.set($('accent').value);
      for (const color of ['ink', 'paper', 'accent'])
        document.documentElement.style.setProperty('--' + color, $(color).value);
    }
    $('sizeValue').textContent = $('dotSize').value + ' px';
    requestRender();
  });
reduced.addEventListener('change', () => {
  $('motion').checked = !reduced.matches;
  stopWheel();
  activePalette = -1;
  updateJourney();
  requestRender();
});
canvas.addEventListener('webglcontextlost', (e) => {
  e.preventDefault();
  loaded = false;
  loading.hidden = false;
  loading.textContent = 'Le rendu 3D a été interrompu. Rechargez la page pour le rétablir.';
});
setTimeline(0);
const initial = sections.findIndex((s) => '#' + s.id === location.hash);
if (initial > 0) setTimeline(initial * BLOCK);
skillsNavigation = createSkillsNavigation({
  visual: document.querySelector('.visual'),
  trigger: document.querySelector('#competences .section-link'),
  isReady: () => loaded,
  onChange: (value) => {
    skillsOpen = value;
    if (!value) skillsFlight = null;
    stopWheel();
    if (!value) activePalette = -1;
    document.querySelectorAll('.travel, .chapters').forEach((el) => {
      el.inert = value;
    });
    requestRender();
  },
  onResize: resize,
  onDisplayResize: refreshBrainDisplay,
  onRender: requestRender,
  onMenuOpen: (value) => {
    brainNavOpen = value;
    requestRender();
  },
  onPreview: (index) => {
    brainNavPreview = index;
    requestRender();
  },
  onNavigate: (index) => {
    setTimeline(index * BLOCK);
    const url = new URL(location.href);
    url.searchParams.delete('view');
    url.hash = sections[index].id;
    history.replaceState(null, '', url);
    journey.focus({ preventScroll: true });
  },
  onSpin: (duration) => {
    skillsFlight = { start: performance.now(), duration, applied: 0 };
    requestRender();
  },
  reduced,
});
init();
