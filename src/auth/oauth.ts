/**
 * Module d'authentification OAuth 2.0 pour YouTube Data API v3
 *
 * Gère le flow OAuth complet : génération de l'URL d'autorisation,
 * échange du code, refresh automatique des tokens, et stockage
 * chiffré des credentials sur le disque.
 */

import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";

// Clé de chiffrement dérivée d'une variable d'environnement
// Si absente, on génère une clé unique par machine basée sur le homedir
const ENCRYPTION_KEY_SOURCE =
  process.env.CLAUDETUBE_ENCRYPTION_KEY ||
  `claudetube-${process.env.HOME || process.env.USERPROFILE || "default"}-key`;

// Dérivation d'une clé AES-256 à partir de la source
const ENCRYPTION_KEY = crypto
  .createHash("sha256")
  .update(ENCRYPTION_KEY_SOURCE)
  .digest();

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

// Scopes YouTube — on demande uniquement ce dont on a besoin
// Chaque scope est documenté pour la transparence
const YOUTUBE_SCOPES = [
  // Gérer le compte YouTube (vidéos, playlists, etc.)
  "https://www.googleapis.com/auth/youtube",
  // Uploader des vidéos et gérer les métadonnées
  "https://www.googleapis.com/auth/youtube.upload",
  // Gérer les sous-titres
  "https://www.googleapis.com/auth/youtube.force-ssl",
];

// Chemin par défaut pour stocker les tokens chiffrés
const DEFAULT_TOKEN_PATH = path.join(
  process.env.HOME || process.env.USERPROFILE || ".",
  ".claudetube",
  "tokens.enc"
);

interface TokenData {
  access_token: string;
  refresh_token: string;
  expiry_date: number;
  token_type: string;
  scope: string;
}

interface EncryptedPayload {
  iv: string;
  tag: string;
  data: string;
}

/**
 * Chiffre une chaîne avec AES-256-GCM
 * Utilise un IV aléatoire pour chaque opération (sécurité maximale)
 */
function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");

  const tag = cipher.getAuthTag();

  const payload: EncryptedPayload = {
    iv: iv.toString("hex"),
    tag: tag.toString("hex"),
    data: encrypted,
  };

  return JSON.stringify(payload);
}

/**
 * Déchiffre une chaîne chiffrée avec AES-256-GCM
 * Vérifie l'intégrité via le tag d'authentification
 */
function decrypt(ciphertext: string): string {
  const payload: EncryptedPayload = JSON.parse(ciphertext);

  const iv = Buffer.from(payload.iv, "hex");
  const tag = Buffer.from(payload.tag, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(payload.data, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * Sauvegarde les tokens chiffrés sur le disque
 * Crée le répertoire parent si nécessaire (permissions restrictives)
 */
function saveTokens(tokens: TokenData, tokenPath: string): void {
  const dir = path.dirname(tokenPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }

  const encrypted = encrypt(JSON.stringify(tokens));
  fs.writeFileSync(tokenPath, encrypted, { mode: 0o600 });
}

/**
 * Charge et déchiffre les tokens depuis le disque
 * Retourne null si le fichier n'existe pas ou est corrompu
 */
function loadTokens(tokenPath: string): TokenData | null {
  if (!fs.existsSync(tokenPath)) return null;

  try {
    const raw = fs.readFileSync(tokenPath, "utf8");
    const decrypted = decrypt(raw);
    return JSON.parse(decrypted);
  } catch {
    // Fichier corrompu ou clé de chiffrement différente
    return null;
  }
}

/**
 * Crée et configure le client OAuth2 pour YouTube
 *
 * Les credentials Google doivent être fournis via :
 * - YOUTUBE_CLIENT_ID
 * - YOUTUBE_CLIENT_SECRET
 * - YOUTUBE_REDIRECT_URI (optionnel, défaut: urn:ietf:wg:oauth:2.0:oob)
 */
export function createOAuth2Client(): OAuth2Client {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  const redirectUri =
    process.env.YOUTUBE_REDIRECT_URI || "urn:ietf:wg:oauth:2.0:oob";

  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing YOUTUBE_CLIENT_ID or YOUTUBE_CLIENT_SECRET environment variables. " +
        "Create OAuth credentials at https://console.cloud.google.com/apis/credentials"
    );
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/**
 * Génère l'URL d'autorisation OAuth2
 * L'utilisateur doit visiter cette URL pour autoriser l'accès
 */
export function getAuthUrl(oauth2Client: OAuth2Client): string {
  return oauth2Client.generateAuthUrl({
    access_type: "offline", // Pour obtenir un refresh_token
    scope: YOUTUBE_SCOPES,
    prompt: "consent", // Force le consentement pour garantir le refresh_token
  });
}

/**
 * Échange le code d'autorisation contre des tokens
 * Sauvegarde automatiquement les tokens chiffrés
 */
export async function exchangeCode(
  oauth2Client: OAuth2Client,
  code: string
): Promise<void> {
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  const tokenPath =
    process.env.CLAUDETUBE_TOKEN_PATH || DEFAULT_TOKEN_PATH;
  saveTokens(tokens as TokenData, tokenPath);
}

/**
 * Initialise le client OAuth2 avec les tokens existants
 * Gère le refresh automatique si le token est expiré
 *
 * Retourne true si l'authentification est prête, false sinon
 */
export async function initializeAuth(
  oauth2Client: OAuth2Client
): Promise<boolean> {
  const tokenPath =
    process.env.CLAUDETUBE_TOKEN_PATH || DEFAULT_TOKEN_PATH;
  const tokens = loadTokens(tokenPath);

  if (!tokens) return false;

  oauth2Client.setCredentials(tokens);

  // Vérifier si le token est expiré et le rafraîchir si nécessaire
  if (tokens.expiry_date && tokens.expiry_date < Date.now()) {
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      oauth2Client.setCredentials(credentials);
      saveTokens(credentials as TokenData, tokenPath);
    } catch {
      // Refresh token invalide — l'utilisateur devra se reconnecter
      return false;
    }
  }

  // Écouter les événements de refresh automatique pour sauvegarder
  oauth2Client.on("tokens", (newTokens) => {
    const current = oauth2Client.credentials;
    const merged = { ...current, ...newTokens } as TokenData;
    saveTokens(merged, tokenPath);
  });

  return true;
}

/**
 * Retourne un client YouTube API v3 authentifié
 * C'est le point d'entrée principal pour tous les outils
 */
export function getYouTubeClient(oauth2Client: OAuth2Client) {
  return google.youtube({ version: "v3", auth: oauth2Client });
}

/**
 * Supprime les tokens stockés (déconnexion)
 */
export function revokeTokens(): boolean {
  const tokenPath =
    process.env.CLAUDETUBE_TOKEN_PATH || DEFAULT_TOKEN_PATH;

  if (fs.existsSync(tokenPath)) {
    fs.unlinkSync(tokenPath);
    return true;
  }
  return false;
}
