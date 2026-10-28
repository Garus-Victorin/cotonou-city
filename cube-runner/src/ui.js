/**
 * ui.js — Gestion de l'overlay HTML (score, game over, bouton rejouer)
 */

export class UI {
  constructor() {
    // Éléments DOM récupérés une seule fois au démarrage.
    this.scoreEl = document.querySelector('#score');
    this.gameOverEl = document.querySelector('#game-over');
    this.finalScoreEl = document.querySelector('#final-score');
    this.replayButton = document.querySelector('#replay-button');

    this.lastRenderedScore = -1; // évite de toucher au DOM inutilement
  }

  /**
   * Met à jour le score affiché en haut à gauche.
   * @param {number} score score entier
   */
  setScore(score) {
    if (score === this.lastRenderedScore) return; // pas de rewrite inutile
    this.lastRenderedScore = score;
    this.scoreEl.textContent = String(score);
  }

  /**
   * Affiche l'écran de game over avec le score final.
   * @param {number} score score final
   */
  showGameOver(score) {
    this.setScore(score);
    this.finalScoreEl.textContent = String(score);
    this.gameOverEl.classList.remove('hidden');
  }

  /** Masque l'écran de game over (nouvelle partie). */
  hideGameOver() {
    this.gameOverEl.classList.add('hidden');
    this.setScore(0);
  }

  /**
   * Abonne un callback au clic sur "Rejouer".
   * @param {() => void} handler appelé pour lancer une nouvelle partie
   */
  onReplay(handler) {
    this.replayButton.addEventListener('click', handler);
  }
}