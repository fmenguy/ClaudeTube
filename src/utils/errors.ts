/**
 * Gestion centralisée des erreurs YouTube API
 *
 * Transforme les erreurs brutes de l'API Google en messages
 * lisibles et actionnables pour l'utilisateur via Claude.
 */

import { GaxiosError } from "googleapis-common";

// Mapping des codes d'erreur HTTP vers des messages clairs
const ERROR_MESSAGES: Record<number, string> = {
  400: "Requête invalide — vérifie les paramètres envoyés.",
  401: "Non authentifié — reconnecte-toi avec l'outil 'auth'.",
  403: "Accès refusé — ton compte n'a pas les permissions nécessaires pour cette action.",
  404: "Ressource introuvable — vérifie l'identifiant fourni.",
  409: "Conflit — cette ressource existe déjà ou a été modifiée.",
  429: "Trop de requêtes — quota YouTube API dépassé, réessaie plus tard.",
  500: "Erreur interne YouTube — réessaie dans quelques instants.",
  503: "Service YouTube temporairement indisponible — réessaie plus tard.",
};

export interface FormattedError {
  error: string;
  code?: number;
  details?: string;
}

/**
 * Formate une erreur API en objet lisible
 * Extrait le maximum d'informations utiles de l'erreur Google
 */
export function formatApiError(err: unknown): FormattedError {
  // Erreur API Google avec détails
  if (isGaxiosError(err)) {
    const status = err.response?.status || 0;
    const message =
      err.response?.data?.error?.message ||
      err.message ||
      "Erreur inconnue";
    const reason =
      err.response?.data?.error?.errors?.[0]?.reason || undefined;

    return {
      error: ERROR_MESSAGES[status] || `Erreur HTTP ${status}`,
      code: status,
      details: reason ? `${message} (${reason})` : message,
    };
  }

  // Erreur standard JS
  if (err instanceof Error) {
    return { error: err.message };
  }

  // Fallback
  return { error: String(err) };
}

/**
 * Type guard pour les erreurs Gaxios (Google API)
 */
function isGaxiosError(err: unknown): err is GaxiosError {
  return (
    err instanceof Error &&
    "response" in err &&
    typeof (err as GaxiosError).response === "object"
  );
}

/**
 * Wrapper pour exécuter un appel API avec gestion d'erreur uniforme
 * Retourne soit le résultat, soit un objet d'erreur formaté
 */
export async function safeApiCall<T>(
  fn: () => Promise<T>
): Promise<T | FormattedError> {
  try {
    return await fn();
  } catch (err) {
    return formatApiError(err);
  }
}

/**
 * Vérifie si un résultat est une erreur formatée
 */
export function isError(result: unknown): result is FormattedError {
  return (
    typeof result === "object" &&
    result !== null &&
    "error" in result &&
    typeof (result as FormattedError).error === "string"
  );
}
