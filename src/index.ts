#!/usr/bin/env node

/**
 * ClaudeTube — MCP Server pour YouTube
 *
 * Point d'entrée principal du serveur MCP.
 * Initialise l'authentification OAuth2, enregistre tous les outils
 * et démarre le transport stdio pour communiquer avec Claude.
 *
 * Usage :
 *   YOUTUBE_CLIENT_ID=xxx YOUTUBE_CLIENT_SECRET=xxx claudetube
 *
 * @author François
 * @license MIT
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { youtube_v3 } from "googleapis";
import { z } from "zod";

import {
  createOAuth2Client,
  getAuthUrl,
  exchangeCode,
  initializeAuth,
  getYouTubeClient,
  revokeTokens,
} from "./auth/oauth.js";

import { registerVideoTools } from "./tools/videos.js";
import { registerPlaylistTools } from "./tools/playlists.js";
import { registerCommentTools } from "./tools/comments.js";
import { registerChannelTools } from "./tools/channel.js";
import { registerCaptionTools } from "./tools/captions.js";
import { registerSearchTools } from "./tools/search.js";

// Client OAuth2 partagé par tous les outils
let oauth2Client: ReturnType<typeof createOAuth2Client>;
let youtubeClient: youtube_v3.Youtube | null = null;
let isAuthenticated = false;

/**
 * Getter pour le client YouTube
 * Vérifie que l'authentification est active avant chaque appel
 */
function getYouTube(): youtube_v3.Youtube {
  if (!youtubeClient || !isAuthenticated) {
    throw new Error(
      "Non authentifié. Utilise l'outil 'auth' pour te connecter à YouTube."
    );
  }
  return youtubeClient;
}

async function main() {
  // Créer le serveur MCP
  const server = new McpServer({
    name: "ClaudeTube",
    version: "1.0.0",
  });

  // Initialiser le client OAuth2
  try {
    oauth2Client = createOAuth2Client();
  } catch (err) {
    // Les variables d'environnement manquent — on démarre quand même
    // mais les outils renverront des erreurs claires
    console.error(
      `[ClaudeTube] ⚠️ ${err instanceof Error ? err.message : err}`
    );
    oauth2Client = null as any;
  }

  // Tenter de charger les tokens existants
  if (oauth2Client) {
    isAuthenticated = await initializeAuth(oauth2Client);
    if (isAuthenticated) {
      youtubeClient = getYouTubeClient(oauth2Client);
    }
  }

  // ========================
  //  Outils d'authentification
  // ========================

  // --- Vérifier le statut d'auth ---
  server.tool(
    "auth_status",
    "Vérifie si tu es connecté à YouTube et affiche les infos de connexion.",
    {},
    async () => {
      if (!isAuthenticated) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                authenticated: false,
                message:
                  "Non connecté. Utilise 'auth' pour obtenir l'URL de connexion.",
              }),
            },
          ],
        };
      }

      try {
        const yt = getYouTube();
        const res = await yt.channels.list({
          part: ["snippet"],
          mine: true,
        });
        const channel = res.data.items?.[0];

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  authenticated: true,
                  channel: {
                    id: channel?.id,
                    name: channel?.snippet?.title,
                    customUrl: channel?.snippet?.customUrl,
                  },
                },
                null,
                2
              ),
            },
          ],
        };
      } catch {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                authenticated: false,
                message: "Token expiré ou invalide. Reconnecte-toi avec 'auth'.",
              }),
            },
          ],
        };
      }
    }
  );

  // --- Démarrer l'authentification ---
  server.tool(
    "auth",
    "Génère l'URL d'autorisation YouTube. Visite cette URL, autorise l'accès, puis utilise 'auth_callback' avec le code reçu.",
    {},
    async () => {
      if (!oauth2Client) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error:
                  "Variables d'environnement manquantes : YOUTUBE_CLIENT_ID et YOUTUBE_CLIENT_SECRET. " +
                  "Crée des identifiants OAuth sur https://console.cloud.google.com/apis/credentials",
              }),
            },
          ],
        };
      }

      const url = getAuthUrl(oauth2Client);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                action: "Visite cette URL pour autoriser ClaudeTube :",
                url,
                next: "Copie le code d'autorisation et utilise l'outil 'auth_callback' pour terminer la connexion.",
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // --- Finaliser l'authentification ---
  server.tool(
    "auth_callback",
    "Finalise la connexion YouTube avec le code d'autorisation obtenu après avoir visité l'URL.",
    {
      code: z
        .string()
        .min(1)
        .describe("Code d'autorisation reçu de Google"),
    },
    async ({ code }) => {
      if (!oauth2Client) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: "Client OAuth non initialisé. Vérifie tes variables d'environnement.",
              }),
            },
          ],
        };
      }

      try {
        await exchangeCode(oauth2Client, code);
        youtubeClient = getYouTubeClient(oauth2Client);
        isAuthenticated = true;

        // Vérifier la connexion en récupérant les infos de la chaîne
        const yt = getYouTube();
        const res = await yt.channels.list({
          part: ["snippet"],
          mine: true,
        });
        const channel = res.data.items?.[0];

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  success: true,
                  message: `Connecté à YouTube !`,
                  channel: {
                    name: channel?.snippet?.title,
                    id: channel?.id,
                  },
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: `Échec de l'authentification : ${err instanceof Error ? err.message : err}`,
              }),
            },
          ],
        };
      }
    }
  );

  // --- Déconnexion ---
  server.tool(
    "auth_revoke",
    "Déconnecte ton compte YouTube et supprime les tokens stockés.",
    {
      confirm: z.boolean().describe("Confirmation (doit être true)"),
    },
    async ({ confirm }) => {
      if (!confirm) {
        return {
          content: [
            { type: "text" as const, text: JSON.stringify({ error: "Déconnexion annulée." }) },
          ],
        };
      }

      const removed = revokeTokens();
      isAuthenticated = false;
      youtubeClient = null;

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              success: true,
              message: removed
                ? "Tokens supprimés. Tu es déconnecté."
                : "Aucun token trouvé, mais tu es déconnecté.",
            }),
          },
        ],
      };
    }
  );

  // ========================
  //  Enregistrer tous les outils YouTube
  // ========================

  registerVideoTools(server, getYouTube);
  registerPlaylistTools(server, getYouTube);
  registerCommentTools(server, getYouTube);
  registerChannelTools(server, getYouTube);
  registerCaptionTools(server, getYouTube);
  registerSearchTools(server, getYouTube);

  // ========================
  //  Démarrer le transport stdio
  // ========================

  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Log sur stderr pour ne pas interférer avec le protocole MCP (qui utilise stdout)
  console.error(
    `[ClaudeTube] Serveur MCP démarré${isAuthenticated ? " (authentifié)" : " (non authentifié — utilise l'outil 'auth')"}`
  );
}

main().catch((err) => {
  console.error("[ClaudeTube] Erreur fatale :", err);
  process.exit(1);
});
