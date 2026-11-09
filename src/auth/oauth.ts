/**
 * Module d'authentification OAuth 2.0 pour YouTube Data API v3
 *
 * Gère le flow OAuth complet : génération de l'URL d'autorisation,
 * récupération du code (serveur de boucle locale ou copier-coller),
 * échange du code, refresh automatique des tokens, et stockage
 * chiffré des credentials sur le disque.
 */

import { google } from "googleapis";
import { CodeChallengeMethod, OAuth2Client } from "google-auth-library";
import * as fs from "node:fs";
import * as http from "node:http";
import * as path from "node:path";
import * as crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const KEY_LENGTH = 32;

// Portée YouTube : on demande uniquement ce dont les outils ont besoin.
// youtube.force-ssl est la seule portée acceptée par captions.* et comments.*,
// et elle couvre aussi tous les autres appels du serveur (videos, playlists,
// playlistItems, channels, search). Aucune autre portée n'est donc nécessaire.
const YOUTUBE_SCOPES = ["https://www.googleapis.com/auth/youtube.force-ssl"];

// Chemin par défaut pour stocker les tokens chiffrés
const DEFAULT_TOKEN_PATH = path.join(
  process.env.HOME || process.env.USERPROFILE || ".",
  ".claudetube",
  "tokens.enc"
);

// Nom du fichier de clé aléatoire, rangé à côté du fichier de tokens
const KEY_FILE_NAME = "encryption.key";

// Durée pendant laquelle le serveur de boucle locale attend le retour de Google
const LOOPBACK_TIMEOUT_MS = 10 * 60 * 1000;

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

function getTokenPath(): string {
  return process.env.CLAUDETUBE_TOKEN_PATH || DEFAULT_TOKEN_PATH;
}

function getKeyFilePath(tokenPath: string): string {
  return path.join(path.dirname(tokenPath), KEY_FILE_NAME);
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
}

// ========================
//  Clés de chiffrement
// ========================

/** Dérive une clé AES-256 d'une chaîne par SHA-256 */
function deriveKey(source: string): Buffer {
  return crypto.createHash("sha256").update(source).digest();
}

/** Clé fournie par l'utilisateur via CLAUDETUBE_ENCRYPTION_KEY, si présente */
function getEnvKey(): Buffer | null {
  const source = process.env.CLAUDETUBE_ENCRYPTION_KEY;
  return source ? deriveKey(source) : null;
}

/**
 * Ancienne clé par défaut (versions précédentes), dérivée du dossier
 * personnel, donc prévisible. Elle ne sert plus qu'à relire des tokens
 * existants pour les rechiffrer avec la clé actuelle.
 */
function getLegacyKey(): Buffer {
  return deriveKey(
    `claudetube-${process.env.HOME || process.env.USERPROFILE || "default"}-key`
  );
}

/** Lit la clé aléatoire stockée à côté des tokens, ou null si absente */
function readKeyFile(keyFile: string): Buffer | null {
  if (!fs.existsSync(keyFile)) return null;

  const key = Buffer.from(fs.readFileSync(keyFile, "utf8").trim(), "base64");
  if (key.length !== KEY_LENGTH) {
    throw new Error(
      `Fichier de clé invalide : ${keyFile}. Supprime-le ainsi que le fichier de tokens, puis reconnecte-toi avec 'auth'.`
    );
  }
  return key;
}

/**
 * Génère une clé aléatoire de 32 octets et l'écrit dans un fichier en 0600
 * (dossier en 0700). L'option "wx" garantit qu'on n'écrase jamais une clé
 * existante : si le fichier apparaît entre-temps, on relit celui-là.
 */
function createKeyFile(keyFile: string): Buffer {
  ensureDir(path.dirname(keyFile));
  const key = crypto.randomBytes(KEY_LENGTH);

  try {
    fs.writeFileSync(keyFile, key.toString("base64") + "\n", {
      mode: 0o600,
      flag: "wx",
    });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "EEXIST") {
      return readKeyFile(keyFile)!;
    }
    throw err;
  }

  console.error(`[ClaudeTube] Clé de chiffrement aléatoire créée : ${keyFile}`);
  return key;
}

/**
 * Clé utilisée pour chiffrer : CLAUDETUBE_ENCRYPTION_KEY si définie,
 * sinon la clé aléatoire du fichier encryption.key (créée au besoin).
 */
function getCurrentKey(tokenPath: string): Buffer {
  const envKey = getEnvKey();
  if (envKey) return envKey;

  const keyFile = getKeyFilePath(tokenPath);
  return readKeyFile(keyFile) ?? createKeyFile(keyFile);
}

/**
 * Clés à essayer pour déchiffrer, dans l'ordre. "current" indique si la clé
 * est celle qu'on utilise pour chiffrer ; sinon les tokens seront rechiffrés.
 */
function getReadKeys(tokenPath: string): { key: Buffer; current: boolean }[] {
  const keys: { key: Buffer; current: boolean }[] = [];
  const envKey = getEnvKey();
  const fileKey = readKeyFile(getKeyFilePath(tokenPath));

  if (envKey) keys.push({ key: envKey, current: true });
  if (fileKey) keys.push({ key: fileKey, current: !envKey });
  keys.push({ key: getLegacyKey(), current: false });

  return keys;
}

// ========================
//  Chiffrement
// ========================

/**
 * Chiffre une chaîne avec AES-256-GCM
 * Utilise un IV aléatoire pour chaque opération (sécurité maximale)
 */
function encrypt(plaintext: string, key: Buffer): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

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
function decrypt(ciphertext: string, key: Buffer): string {
  const payload: EncryptedPayload = JSON.parse(ciphertext);

  const iv = Buffer.from(payload.iv, "hex");
  const tag = Buffer.from(payload.tag, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(payload.data, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * Sauvegarde les tokens chiffrés sur le disque
 * Crée le répertoire parent si nécessaire (permissions restrictives).
 * Écriture dans un fichier temporaire puis renommage, pour ne jamais
 * laisser un fichier de tokens à moitié écrit.
 */
function saveTokens(tokens: TokenData, tokenPath: string): void {
  ensureDir(path.dirname(tokenPath));

  const encrypted = encrypt(JSON.stringify(tokens), getCurrentKey(tokenPath));
  const tmpPath = `${tokenPath}.tmp`;
  fs.writeFileSync(tmpPath, encrypted, { mode: 0o600 });
  fs.renameSync(tmpPath, tokenPath);
}

/**
 * Charge et déchiffre les tokens depuis le disque
 * Retourne null si le fichier n'existe pas ou ne se déchiffre avec aucune clé.
 * Si les tokens ont été chiffrés avec une ancienne clé (dérivation par défaut
 * des versions précédentes), ils sont rechiffrés avec la clé actuelle.
 */
function loadTokens(tokenPath: string): TokenData | null {
  if (!fs.existsSync(tokenPath)) return null;

  let raw: string;
  let keys: { key: Buffer; current: boolean }[];
  try {
    raw = fs.readFileSync(tokenPath, "utf8");
    keys = getReadKeys(tokenPath);
  } catch (err) {
    console.error(
      `[ClaudeTube] Lecture des tokens impossible : ${err instanceof Error ? err.message : err}`
    );
    return null;
  }

  for (const { key, current } of keys) {
    let tokens: TokenData;
    try {
      tokens = JSON.parse(decrypt(raw, key));
    } catch {
      continue; // Mauvaise clé ou fichier corrompu : on essaie la suivante
    }

    if (!current) {
      try {
        saveTokens(tokens, tokenPath);
        console.error("[ClaudeTube] Tokens rechiffrés avec la clé actuelle.");
      } catch (err) {
        console.error(
          `[ClaudeTube] Rechiffrement des tokens impossible : ${err instanceof Error ? err.message : err}`
        );
      }
    }
    return tokens;
  }

  return null;
}

// Clients dont les refresh automatiques sont déjà sauvegardés sur disque
const persistedClients = new WeakSet<OAuth2Client>();

/**
 * Sauvegarde les tokens à chaque refresh automatique de la librairie Google
 */
function persistRefreshedTokens(oauth2Client: OAuth2Client): void {
  if (persistedClients.has(oauth2Client)) return;
  persistedClients.add(oauth2Client);

  oauth2Client.on("tokens", (newTokens) => {
    const current = oauth2Client.credentials;
    const merged = { ...current, ...newTokens } as TokenData;
    try {
      saveTokens(merged, getTokenPath());
    } catch (err) {
      console.error(
        `[ClaudeTube] Sauvegarde des tokens impossible : ${err instanceof Error ? err.message : err}`
      );
    }
  });
}

// ========================
//  Client et flow OAuth
// ========================

/**
 * Crée et configure le client OAuth2 pour YouTube
 *
 * Les credentials Google doivent être fournis via :
 * - YOUTUBE_CLIENT_ID
 * - YOUTUBE_CLIENT_SECRET
 * - YOUTUBE_REDIRECT_URI (optionnel ; par défaut, un serveur de boucle
 *   locale éphémère sur http://127.0.0.1:<port libre> reçoit le code)
 */
export function createOAuth2Client(): OAuth2Client {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing YOUTUBE_CLIENT_ID or YOUTUBE_CLIENT_SECRET environment variables. " +
        "Create OAuth credentials at https://console.cloud.google.com/apis/credentials"
    );
  }

  return new google.auth.OAuth2(
    clientId,
    clientSecret,
    process.env.YOUTUBE_REDIRECT_URI || undefined
  );
}

/** Autorisation en cours : de quoi valider et échanger le code reçu */
interface PendingAuth {
  redirectUri: string;
  codeVerifier: string;
  state: string;
  server?: http.Server;
  timer?: NodeJS.Timeout;
}

let pendingAuth: PendingAuth | null = null;

/** Ferme le serveur de boucle locale éventuel et oublie l'autorisation en cours */
function clearPendingAuth(): void {
  if (!pendingAuth) return;
  if (pendingAuth.timer) clearTimeout(pendingAuth.timer);
  pendingAuth.server?.close();
  pendingAuth = null;
}

export interface AuthorizationStart {
  /** URL à ouvrir dans le navigateur */
  url: string;
  /** "loopback" : le code arrive tout seul ; "manual" : l'utilisateur le recopie */
  mode: "loopback" | "manual";
  /** Adresse vers laquelle Google renverra le navigateur */
  redirectUri: string;
}

function htmlPage(title: string, message: string): string {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${title}</title></head><body style="font-family:sans-serif;max-width:40rem;margin:4rem auto;padding:0 1rem"><h1>${title}</h1><p>${message}</p></body></html>`;
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/**
 * Démarre une autorisation OAuth (PKCE + paramètre state anti-CSRF)
 *
 * Sans YOUTUBE_REDIRECT_URI : ouvre un serveur HTTP éphémère sur
 * 127.0.0.1 (port libre choisi par le système). Google y renvoie le
 * navigateur avec le code, qui est échangé automatiquement ; onAuthenticated
 * est alors appelé. Le serveur se ferme après le retour ou au bout de 10 min.
 *
 * Avec YOUTUBE_REDIRECT_URI : mode manuel, l'utilisateur recopie l'adresse
 * de retour (ou le code) dans l'outil auth_callback.
 */
export async function startAuthorization(
  oauth2Client: OAuth2Client,
  onAuthenticated: () => void
): Promise<AuthorizationStart> {
  clearPendingAuth();

  const { codeVerifier, codeChallenge } =
    await oauth2Client.generateCodeVerifierAsync();
  const state = crypto.randomBytes(16).toString("hex");
  const configuredRedirect = process.env.YOUTUBE_REDIRECT_URI;

  const pending: PendingAuth = {
    redirectUri: configuredRedirect || "",
    codeVerifier,
    state,
  };

  if (!configuredRedirect) {
    const server = http.createServer();
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => resolve());
    });
    server.unref();

    const { port } = server.address() as { port: number };
    pending.redirectUri = `http://127.0.0.1:${port}`;
    pending.server = server;
    pending.timer = setTimeout(() => {
      // On garde le verifier : l'adresse de retour peut encore être collée
      // dans auth_callback tant que le code Google est valide.
      server.close();
    }, LOOPBACK_TIMEOUT_MS);
    pending.timer.unref();

    let handled = false;
    server.on("request", (req, res) => {
      const reqUrl = new URL(req.url || "/", pending.redirectUri);
      const send = (status: number, title: string, message: string) => {
        res.writeHead(status, { "Content-Type": "text/html; charset=utf-8" });
        res.end(htmlPage(title, message));
      };

      if (reqUrl.pathname !== "/" || handled) {
        send(404, "Introuvable", "Rien à voir ici.");
        return;
      }
      if (reqUrl.searchParams.get("state") !== pending.state) {
        send(400, "Requête refusée", "Paramètre state invalide. Relance l'outil auth.");
        return;
      }

      handled = true;
      exchangeCode(oauth2Client, reqUrl.toString())
        .then(() => {
          send(
            200,
            "ClaudeTube est connecté",
            "Autorisation enregistrée. Tu peux fermer cet onglet et revenir à Claude."
          );
          onAuthenticated();
        })
        .catch((err) => {
          send(
            400,
            "Échec de la connexion",
            escapeHtml(err instanceof Error ? err.message : String(err)) +
              " Relance l'outil auth pour réessayer."
          );
          clearPendingAuth();
        });
    });
  }

  pendingAuth = pending;

  const url = oauth2Client.generateAuthUrl({
    access_type: "offline", // Pour obtenir un refresh_token
    scope: YOUTUBE_SCOPES,
    prompt: "consent", // Force le consentement pour garantir le refresh_token
    redirect_uri: pending.redirectUri,
    state,
    code_challenge_method: CodeChallengeMethod.S256,
    code_challenge: codeChallenge,
  });

  return {
    url,
    mode: configuredRedirect ? "manual" : "loopback",
    redirectUri: pending.redirectUri,
  };
}

/**
 * Extrait le code d'autorisation d'une saisie utilisateur : soit le code
 * seul, soit l'adresse complète de la page de retour (copiée depuis la
 * barre du navigateur). Vérifie le paramètre state quand il est présent.
 */
function parseAuthorizationInput(input: string, expectedState: string): string {
  const value = input.trim();

  if (/^https?:\/\//i.test(value)) {
    const params = new URL(value).searchParams;
    const error = params.get("error");
    if (error) {
      throw new Error(`Google a refusé l'autorisation (${error}).`);
    }
    const state = params.get("state");
    if (state !== null && state !== expectedState) {
      throw new Error(
        "Paramètre state invalide : cette adresse ne correspond pas à la dernière autorisation. Relance l'outil 'auth'."
      );
    }
    const code = params.get("code");
    if (!code) {
      throw new Error("Aucun paramètre code dans cette adresse.");
    }
    return code;
  }

  // Code seul, éventuellement copié encore encodé (4%2F0A... au lieu de 4/0A...)
  return value.includes("%") ? decodeURIComponent(value) : value;
}

/**
 * Échange le code d'autorisation contre des tokens
 * Accepte le code seul ou l'adresse complète de la page de retour.
 * Sauvegarde automatiquement les tokens chiffrés.
 */
export async function exchangeCode(
  oauth2Client: OAuth2Client,
  codeOrUrl: string
): Promise<void> {
  const pending = pendingAuth;
  if (!pending) {
    throw new Error(
      "Aucune autorisation en cours (ou serveur redémarré depuis). Relance l'outil 'auth'."
    );
  }

  const code = parseAuthorizationInput(codeOrUrl, pending.state);
  const { tokens } = await oauth2Client.getToken({
    code,
    codeVerifier: pending.codeVerifier,
    redirect_uri: pending.redirectUri,
  });

  // Un code ne sert qu'une fois : on ferme le serveur et on oublie le verifier
  if (pendingAuth === pending) clearPendingAuth();

  oauth2Client.setCredentials(tokens);
  saveTokens(tokens as TokenData, getTokenPath());
  persistRefreshedTokens(oauth2Client);
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
  const tokenPath = getTokenPath();
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
      // Refresh token invalide : l'utilisateur devra se reconnecter
      return false;
    }
  }

  // Écouter les événements de refresh automatique pour sauvegarder
  persistRefreshedTokens(oauth2Client);

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
 * La clé encryption.key est conservée : elle resservira à la prochaine connexion.
 */
export function revokeTokens(): boolean {
  clearPendingAuth();
  const tokenPath = getTokenPath();

  if (fs.existsSync(tokenPath)) {
    fs.unlinkSync(tokenPath);
    return true;
  }
  return false;
}
