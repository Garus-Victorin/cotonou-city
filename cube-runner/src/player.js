import * as THREE from 'three';

/**
 * player.js — Création et pilotage du cube joueur
 */

/** Positions X des 3 couloirs de la piste. */
export const LANES = [-2, 0, 2];

/** Dimensions du cube joueur (BoxGeometry 1x1x1). */
export const PLAYER_SIZE = { x: 1, y: 1, z: 1 };

/** Vitesse d'interpolation (lerp) entre deux couloirs : plus c'est haut, plus c'est réactif. */
const LANE_CHANGE_SPEED = 12;

/** Légère marge retirée de la boîte de collision pour ne pas punir le joueur à tort. */
const HITBOX_MARGIN = 0.15;

export class Player {
  /**
   * @param {THREE.Scene} scene scène à laquelle ajouter le cube
   */
  constructor(scene) {
    const geometry = new THREE.BoxGeometry(PLAYER_SIZE.x, PLAYER_SIZE.y, PLAYER_SIZE.z);
    const material = new THREE.MeshStandardMaterial({
      color: 0x2f7dff, // bleu
      metalness: 0.15,
      roughness: 0.4,
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.set(LANES[1], PLAYER_SIZE.y / 2, 0); // posé sur le sol
    this.mesh.userData.collisionSize = {
      x: PLAYER_SIZE.x - HITBOX_MARGIN,
      y: PLAYER_SIZE.y - HITBOX_MARGIN,
      z: PLAYER_SIZE.z - HITBOX_MARGIN,
    };
    scene.add(this.mesh);

    this.laneIndex = 1; // couloir cible (0 = gauche, 1 = centre, 2 = droite)
  }

  /** Décale le couloir cible vers la gauche (borne gauche incluse). */
  moveLeft() {
    this.laneIndex = Math.max(0, this.laneIndex - 1);
  }

  /** Décale le couloir cible vers la droite (borne droite incluse). */
  moveRight() {
    this.laneIndex = Math.min(LANES.length - 1, this.laneIndex + 1);
  }

  /**
   * Met à jour le cube : interpolation fluide vers le couloir cible.
   * @param {number} dt delta time en secondes
   */
  update(dt) {
    const targetX = LANES[this.laneIndex];
    const currentX = this.mesh.position.x;

    // Facteur de lerp lissé et indépendant du framerate :
    // 0 quand dt = 0, et proche de 1 quand dt est grand.
    const factor = 1 - Math.exp(-LANE_CHANGE_SPEED * dt);
    this.mesh.position.x = THREE.MathUtils.lerp(currentX, targetX, factor);

    // On "clipse" en fin de mouvement pour éviter une asymptote infinie.
    if (Math.abs(targetX - this.mesh.position.x) < 0.001) {
      this.mesh.position.x = targetX;
    }

    // Petit tangage dans le sens du déplacement pour donner du caractère.
    const offset = targetX - this.mesh.position.x;
    this.mesh.rotation.z = THREE.MathUtils.clamp(-offset * 0.25, -0.3, 0.3);
  }

  /** Réinitialise complètement le joueur (nouvelle partie). */
  reset() {
    this.laneIndex = 1;
    this.mesh.position.set(LANES[1], PLAYER_SIZE.y / 2, 0);
    this.mesh.rotation.set(0, 0, 0);
  }
}