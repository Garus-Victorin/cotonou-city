import * as THREE from 'three';
import { LANES } from './player.js';

/**
 * obstacles.js — Génération, mise à jour et recyclage des obstacles
 *
 * Principe du "object pooling" : tous les cubes rouges sont créés une seule
 * fois au démarrage (POOL_SIZE exemplaires), puis réutilisés indéfiniment.
 * Aucune allocation pendant la partie = aucune micro-coupure (GC) en jeu.
 */

/** Taille d'un obstacle (cube 1x1x1). */
export const OBSTACLE_SIZE = { x: 1, y: 1, z: 1 };

/** Nombre de cubes alloués à l'avance dans le pool. */
const POOL_SIZE = 20;

/** Position Z d'apparition des obstacles (loin devant le joueur, dans le brouillard). */
const SPAWN_Z = -70;

/** Position Z au-delà de laquelle l'obstacle est recyclé (derrière le joueur). */
const DESPAWN_Z = 12;

/** Distance minimale (en unités) entre deux lignes d'obstacles. */
const SPAWN_GAP = 14;

/** Probabilité qu'une ligne bloque 2 couloirs au lieu d'un seul. */
const DOUBLE_BLOCK_CHANCE = 0.5;

export class ObstacleManager {
  /**
   * @param {THREE.Scene} scene scène contenant les obstacles
   */
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);

    // Géométrie et matériau partagés par tous les instances du pool.
    const geometry = new THREE.BoxGeometry(OBSTACLE_SIZE.x, OBSTACLE_SIZE.y, OBSTACLE_SIZE.z);
    const material = new THREE.MeshStandardMaterial({
      color: 0xff3b3b, // rouge
      metalness: 0.1,
      roughness: 0.5,
      emissive: 0x330000, // légère lueur pour rester visible dans le brouillard
    });

    // Allocation unique du pool.
    this.pool = [];
    for (let i = 0; i < POOL_SIZE; i += 1) {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.y = OBSTACLE_SIZE.y / 2; // posé sur le sol
      mesh.visible = false;
      mesh.userData.collisionSize = { ...OBSTACLE_SIZE };
      this.group.add(mesh);
      this.pool.push({ mesh, active: false });
    }

    this.active = []; // obstacles actuellement en piste
    this.distanceSinceSpawn = 0; // distance parcourue depuis la dernière ligne
    this.previousFreeLanes = null; // couloirs libres de la dernière ligne générée
  }

  /**
   * Choisit les couloirs bloqués pour une nouvelle ligne.
   *
   * Règle d'équité (impossible de générer un mur infranchissable) :
   * on ne bloque JAMAIS les 3 couloirs d'un coup, et on ne bloque jamais
   * la totalité des couloirs libres de la ligne précédente — ainsi il reste
   * toujours au moins un couloir praticable d'une ligne à l'autre.
   *
   * @returns {number[]} indices des couloirs bloqués (0, 1 ou 2)
   */
  pickBlockedLanes() {
    const laneIndices = [0, 1, 2];
    const blockedCount = Math.random() < DOUBLE_BLOCK_CHANCE ? 2 : 1;

    // Mélange de Fisher-Yates pour une sélection aléatoire uniforme.
    const shuffled = [...laneIndices];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const blocked = [];
    for (const lane of shuffled) {
      if (blocked.length >= blockedCount) break;

      // Empêche de bloquer TOUS les couloirs libres de la ligne précédente.
      const wouldBlockAllPrevious =
        this.previousFreeLanes !== null &&
        this.previousFreeLanes.every((freeLane) => [...blocked, lane].includes(freeLane));
      if (wouldBlockAllPrevious) continue;

      blocked.push(lane);
    }

    return blocked;
  }

  /**
   * Active un obstacle inactif du pool dans le couloir donné.
   * @param {number} laneIndex indice du couloir
   * @returns {boolean} false si le pool est épuisé (cas improbable)
   */
  acquire(laneIndex) {
    const slot = this.pool.find((entry) => !entry.active);
    if (!slot) return false;

    slot.active = true;
    slot.mesh.visible = true;
    slot.mesh.position.set(LANES[laneIndex], OBSTACLE_SIZE.y / 2, SPAWN_Z);
    this.active.push(slot);
    return true;
  }

  /** Libère un obstacle et le renvoie dans le pool. */
  release(slot) {
    slot.active = false;
    slot.mesh.visible = false;
    const index = this.active.indexOf(slot);
    if (index !== -1) this.active.splice(index, 1);
  }

  /** Fait apparaître une ligne d'obstacles (1 ou 2 cubes). */
  spawnRow() {
    const blockedLanes = this.pickBlockedLanes();
    let spawnedAny = false;

    for (const laneIndex of blockedLanes) {
      if (this.acquire(laneIndex)) spawnedAny = true;
    }

    if (spawnedAny) {
      // Mémorise les couloirs libres de cette ligne pour la prochaine.
      this.previousFreeLanes = [0, 1, 2].filter((lane) => !blockedLanes.includes(lane));
    }
    return spawnedAny;
  }

  /**
   * Avance tous les obstacles, déclenche les spawns et recycle les cubes.
   * @param {number} dt delta time en secondes
   * @param {number} speed vitesse actuelle de la piste (unités/seconde)
   */
  update(dt, speed) {
    const travel = speed * dt;

    // Déplacement vers le joueur (+Z).
    for (const slot of this.active) {
      slot.mesh.position.z += travel;

      // L'obstacle est passé derrière le joueur → retour dans le pool.
      if (slot.mesh.position.z > DESPAWN_Z) {
        this.release(slot);
      }
    }

    // Spawn piloté par la distance parcourue : l'espacement entre les lignes
    // reste constant en unités, donc toujours jouable quelle que soit la vitesse.
    this.distanceSinceSpawn += travel;
    if (this.distanceSinceSpawn >= SPAWN_GAP) {
      const spawned = this.spawnRow();
      if (spawned) {
        this.distanceSinceSpawn -= SPAWN_GAP;
      } else {
        // Pool épuisé : on réessaiera à la prochaine frame sans empiler les spawns.
        this.distanceSinceSpawn = SPAWN_GAP;
      }
    }
  }

  /** Réinitialise complètement le manager (nouvelle partie). */
  reset() {
    for (const slot of [...this.active]) {
      this.release(slot);
    }
    this.active.length = 0;
    this.distanceSinceSpawn = 0;
    this.previousFreeLanes = null;
    // Première ligne générée immédiatement (elle arrive de loin).
    this.spawnRow();
  }
}