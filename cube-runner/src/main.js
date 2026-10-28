import * as THREE from 'three';
import { Player } from './player.js';
import { ObstacleManager } from './obstacles.js';
import { checkMeshCollision } from './collision.js';
import { UI } from './ui.js';
import './style.css';

/**
 * main.js — Point d'entrée du jeu
 * Initialise la scène 3D, l'interface, les entrées clavier et la boucle de jeu.
 */

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const BG_COLOR = 0x0a0a1a; // fond sombre
const ROAD_WIDTH = 6; // largeur de la piste (3 couloirs de 2 unités)
const SEGMENT_LENGTH = 40; // longueur d'un segment de piste
const SEGMENT_COUNT = 5; // segments recyclés (200 unités de piste au total)
const RECYCLE_Z = 10; // Z au-delà duquel un segment est remis à l'arrière

const BASE_SPEED = 12; // vitesse de départ (unités/seconde)
const ACCELERATION = 0.6; // vitesse gagnée par seconde de survie
const MAX_SPEED = 40; // vitesse maximale (évite de rendre le jeu injouable)

const POINTS_PER_SECOND = 10; // points gagnés par seconde survécue

// ---------------------------------------------------------------------------
// État de la partie (module scope : aucune variable globale sur `window`)
// ---------------------------------------------------------------------------

const state = {
  mode: 'playing', // 'playing' | 'over'
  elapsed: 0, // temps de survie en secondes
  speed: BASE_SPEED,
  score: 0,
};

// ---------------------------------------------------------------------------
// Initialisation de la scène
// ---------------------------------------------------------------------------

const scene = new THREE.Scene();
scene.background = new THREE.Color(BG_COLOR);
scene.fog = new THREE.Fog(BG_COLOR, 30, 95); // masque l'apparition des obstacles

const camera = new THREE.PerspectiveCamera(
  70,
  window.innerWidth / window.innerHeight,
  0.1,
  200,
);
camera.position.set(0, 4, 6); // derrière et au-dessus du joueur
camera.lookAt(0, 0.5, -6);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

// Éclairage : ambiante + directionnelle.
scene.add(new THREE.AmbientLight(0xffffff, 1.0));
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(6, 12, 8);
scene.add(sun);

// ---------------------------------------------------------------------------
// Piste infinie : texture damier + segments recyclés + lignes de couloirs
// ---------------------------------------------------------------------------

/** Crée la texture en damier qui donne la sensation de vitesse. */
function createTrackTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const half = size / 2;

  ctx.fillStyle = '#14142a';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#1c1c3a';
  ctx.fillRect(0, 0, half, half);
  ctx.fillRect(half, half, half, half);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  // Une tuile = 2x2 unités du monde pour garder des cases carrées.
  texture.repeat.set(ROAD_WIDTH / 2, SEGMENT_LENGTH / 2);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Crée les segments de piste recyclés et renvoie leur tableau. */
function createTrack() {
  const segments = [];

  const roadGeometry = new THREE.PlaneGeometry(ROAD_WIDTH, SEGMENT_LENGTH);
  const roadMaterial = new THREE.MeshStandardMaterial({
    map: createTrackTexture(),
    roughness: 0.9,
    metalness: 0,
  });

  // Fines lignes blanches aux frontières des couloirs (x = -1 et x = +1).
  const lineGeometry = new THREE.PlaneGeometry(0.08, SEGMENT_LENGTH);
  const lineMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.3,
  });

  for (let i = 0; i < SEGMENT_COUNT; i += 1) {
    const group = new THREE.Group();

    const road = new THREE.Mesh(roadGeometry, roadMaterial);
    road.rotation.x = -Math.PI / 2; // à plat
    group.add(road);

    for (const x of [-1, 1]) {
      const line = new THREE.Mesh(lineGeometry, lineMaterial);
      line.rotation.x = -Math.PI / 2;
      line.position.set(x, 0.02, 0); // légèrement au-dessus du sol (z-fighting)
      group.add(line);
    }

    // Segment i couvre le domaine z ∈ [-i*L ; -(i+1)*L].
    group.position.z = -SEGMENT_LENGTH * (i + 0.5);
    scene.add(group);
    segments.push(group);
  }

  return segments;
}

/** Avance la piste et remet à l'arrière les segments sortis de vue. */
function updateTrack(segments, travel) {
  for (const segment of segments) {
    segment.position.z += travel;

    // Entièrement derrière la caméra → recyclage à l'arrière de la file.
    if (segment.position.z - SEGMENT_LENGTH / 2 > RECYCLE_Z) {
      const backZ = Math.min(...segments.map((s) => s.position.z)) - SEGMENT_LENGTH;
      segment.position.z = backZ;
    }
  }
}

// ---------------------------------------------------------------------------
// Objets du jeu
// ---------------------------------------------------------------------------

const segments = createTrack();
const player = new Player(scene);
const obstacles = new ObstacleManager(scene);
const ui = new UI();

// ---------------------------------------------------------------------------
// Entrées clavier : flèches gauche/droite ou A/D
// ---------------------------------------------------------------------------

window.addEventListener('keydown', (event) => {
  if (state.mode !== 'playing') return;

  let moved = false;
  if (event.code === 'ArrowLeft' || event.code === 'KeyA') {
    player.moveLeft();
    moved = true;
  } else if (event.code === 'ArrowRight' || event.code === 'KeyD') {
    player.moveRight();
    moved = true;
  }

  if (moved) event.preventDefault(); // empêche le défilement de la page
});

// ---------------------------------------------------------------------------
// Cycle de vie de la partie
// ---------------------------------------------------------------------------

/** Passe l'état "game over" et affiche l'overlay. */
function gameOver() {
  state.mode = 'over';
  ui.showGameOver(state.score);
}

/** Réinitialise entièrement la partie (appelé au clic sur "Rejouer"). */
function restart() {
  state.mode = 'playing';
  state.elapsed = 0;
  state.speed = BASE_SPEED;
  state.score = 0;
  player.reset();
  obstacles.reset();
  ui.hideGameOver();
}

ui.onReplay(restart);

// ---------------------------------------------------------------------------
// Boucle de jeu
// ---------------------------------------------------------------------------

const clock = new THREE.Clock();

/** Vérifie les collisions entre le joueur et tous les obstacles actifs. */
function checkCollisions() {
  for (const slot of obstacles.active) {
    if (checkMeshCollision(player.mesh, slot.mesh)) {
      gameOver();
      return;
    }
  }
}

function animate() {
  requestAnimationFrame(animate);

  // Delta time plafonné : évite un saut géant après un onglet resté inactif.
  const dt = Math.min(clock.getDelta(), 0.05);

  if (state.mode === 'playing') {
    // 1. Mise à jour du joueur (interpolation entre couloirs).
    player.update(dt);

    // 2. Accélération progressive puis avancée des obstacles.
    state.elapsed += dt;
    state.speed = Math.min(MAX_SPEED, BASE_SPEED + state.elapsed * ACCELERATION);
    obstacles.update(dt, state.speed);
    updateTrack(segments, state.speed * dt);

    // 3. Détection des collisions.
    checkCollisions();

    // 4. Score en fonction du temps survécu.
    state.score = Math.floor(state.elapsed * POINTS_PER_SECOND);
    ui.setScore(state.score);
  }

  // Caméra : suit légèrement le joueur en X pour un effet dynamique.
  const followX = player.mesh.position.x * 0.6;
  const followFactor = 1 - Math.exp(-5 * dt);
  camera.position.x = THREE.MathUtils.lerp(camera.position.x, followX, followFactor);
  camera.lookAt(player.mesh.position.x * 0.8, 0.6, -6);

  // 5. Rendu.
  renderer.render(scene, camera);
}

// ---------------------------------------------------------------------------
// Redimensionnement de la fenêtre
// ---------------------------------------------------------------------------

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

// Démarrage : première ligne d'obstacles + boucle de rendu.
obstacles.reset();
animate();
