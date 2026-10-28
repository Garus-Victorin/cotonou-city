/**
 * collision.js — Détection de collision par AABB (Axis-Aligned Bounding Box)
 *
 * Toutes les fonctions sont pures (aucune dépendance à Three.js) : elles
 * travaillent sur des objets de la forme { x, y, z }, ce qui rend le module
 * facile à tester et à réutiliser.
 */

/**
 * Vérifie le chevauchement de deux boîtes englobantes alignées sur les axes.
 *
 * Convention : `position` est le CENTRE de la boîte et `size` sa taille
 * complète (largeur, hauteur, profondeur).
 *
 * @param {{x:number, y:number, z:number}} positionA centre de la boîte A
 * @param {{x:number, y:number, z:number}} sizeA      dimensions complètes de A
 * @param {{x:number, y:number, z:number}} positionB centre de la boîte B
 * @param {{x:number, y:number, z:number}} sizeB      dimensions complètes de B
 * @returns {boolean} true si les deux boîtes se chevauchent
 */
export function aabbOverlap(positionA, sizeA, positionB, sizeB) {
  // Équivalent à : intervalleA.min < intervalleB.max ET inversement, sur chaque axe.
  const overlapX = Math.abs(positionA.x - positionB.x) * 2 < sizeA.x + sizeB.x;
  const overlapY = Math.abs(positionA.y - positionB.y) * 2 < sizeA.y + sizeB.y;
  const overlapZ = Math.abs(positionA.z - positionB.z) * 2 < sizeA.z + sizeB.z;

  return overlapX && overlapY && overlapZ;
}

/**
 * Commodité pour deux meshes Three.js : utilise la position du mesh et des
 * tailles de collision stockées dans `userData.collisionSize`.
 *
 * @param {import('three').Object3D} meshA
 * @param {import('three').Object3D} meshB
 * @param {number} [margin] marge de retrait (en unités) pour rendre la
 *                         collision plus indulgente en faveur du joueur
 * @returns {boolean}
 */
export function checkMeshCollision(meshA, meshB, margin = 0) {
  const sizeA = meshA.userData.collisionSize;
  const sizeB = meshB.userData.collisionSize;

  const forgivingA = { x: sizeA.x - margin, y: sizeA.y - margin, z: sizeA.z - margin };

  return aabbOverlap(meshA.position, forgivingA, meshB.position, sizeB);
}