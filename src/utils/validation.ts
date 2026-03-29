/**
 * Fonctions de validation des entrées utilisateur
 *
 * Valide les identifiants YouTube avant de les envoyer à l'API
 * pour éviter les requêtes inutiles et les erreurs cryptiques.
 */

/**
 * Valide un ID de vidéo YouTube (11 caractères alphanumériques + _ et -)
 */
export function isValidVideoId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{11}$/.test(id);
}

/**
 * Valide un ID de playlist YouTube (commence par PL, LL, FL, UU, etc.)
 */
export function isValidPlaylistId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{10,80}$/.test(id);
}

/**
 * Valide un ID de chaîne YouTube (commence par UC)
 */
export function isValidChannelId(id: string): boolean {
  return /^UC[a-zA-Z0-9_-]{22}$/.test(id);
}

/**
 * Valide un ID de commentaire YouTube
 */
export function isValidCommentId(id: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(id) && id.length > 0 && id.length < 100;
}

/**
 * Tronque un texte à une longueur maximale (pour les descriptions, titres, etc.)
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

/**
 * Nettoie une chaîne en supprimant les caractères de contrôle
 * tout en préservant les sauts de ligne légitimes
 */
export function sanitize(input: string): string {
  // Supprimer les caractères de contrôle sauf \n et \r
  return input.replace(/[\x00-\x09\x0B\x0C\x0E-\x1F\x7F]/g, "");
}
