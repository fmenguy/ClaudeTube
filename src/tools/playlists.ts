/**
 * Outils MCP pour la gestion des playlists YouTube
 *
 * CRUD complet sur les playlists + gestion des éléments
 * (ajout/suppression de vidéos dans une playlist).
 */

import { youtube_v3 } from "googleapis";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { formatApiError } from "../utils/errors.js";
import {
  isValidPlaylistId,
  isValidVideoId,
  sanitize,
} from "../utils/validation.js";

export function registerPlaylistTools(
  server: McpServer,
  getYouTube: () => youtube_v3.Youtube
) {
  // --- Lister mes playlists ---
  server.tool(
    "list_my_playlists",
    "Liste toutes les playlists de ta chaîne.",
    {
      maxResults: z.number().min(1).max(50).default(25),
      pageToken: z.string().optional(),
    },
    async ({ maxResults, pageToken }) => {
      try {
        const yt = getYouTube();
        const res = await yt.playlists.list({
          part: ["snippet", "contentDetails", "status"],
          mine: true,
          maxResults,
          pageToken,
        });

        const result = {
          playlists: (res.data.items || []).map((p) => ({
            id: p.id,
            title: p.snippet?.title,
            description: p.snippet?.description?.slice(0, 200),
            itemCount: p.contentDetails?.itemCount,
            privacyStatus: p.status?.privacyStatus,
            publishedAt: p.snippet?.publishedAt,
          })),
          nextPageToken: res.data.nextPageToken || null,
          totalResults: res.data.pageInfo?.totalResults,
        };

        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify(formatApiError(err)) }],
        };
      }
    }
  );

  // --- Créer une playlist ---
  server.tool(
    "create_playlist",
    "Crée une nouvelle playlist sur ta chaîne.",
    {
      title: z.string().min(1).describe("Titre de la playlist"),
      description: z.string().optional().describe("Description"),
      privacyStatus: z
        .enum(["public", "private", "unlisted"])
        .default("private")
        .describe("Statut de confidentialité"),
    },
    async ({ title, description, privacyStatus }) => {
      try {
        const yt = getYouTube();
        const res = await yt.playlists.insert({
          part: ["snippet", "status"],
          requestBody: {
            snippet: {
              title: sanitize(title),
              description: description ? sanitize(description) : undefined,
            },
            status: { privacyStatus },
          },
        });

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  success: true,
                  playlist: {
                    id: res.data.id,
                    title: res.data.snippet?.title,
                    privacyStatus: res.data.status?.privacyStatus,
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
          content: [{ type: "text" as const, text: JSON.stringify(formatApiError(err)) }],
        };
      }
    }
  );

  // --- Modifier une playlist ---
  server.tool(
    "update_playlist",
    "Modifie le titre, la description ou le statut d'une playlist.",
    {
      playlistId: z.string().describe("ID de la playlist"),
      title: z.string().optional(),
      description: z.string().optional(),
      privacyStatus: z.enum(["public", "private", "unlisted"]).optional(),
    },
    async ({ playlistId, title, description, privacyStatus }) => {
      if (!isValidPlaylistId(playlistId)) {
        return {
          content: [
            { type: "text" as const, text: JSON.stringify({ error: "ID de playlist invalide" }) },
          ],
        };
      }

      try {
        const yt = getYouTube();

        // Récupérer l'état actuel pour merger
        const current = await yt.playlists.list({
          part: ["snippet", "status"],
          id: [playlistId],
        });

        const playlist = current.data.items?.[0];
        if (!playlist) {
          return {
            content: [
              { type: "text" as const, text: JSON.stringify({ error: "Playlist introuvable" }) },
            ],
          };
        }

        const res = await yt.playlists.update({
          part: ["snippet", "status"],
          requestBody: {
            id: playlistId,
            snippet: {
              title: title ? sanitize(title) : playlist.snippet?.title!,
              description: description
                ? sanitize(description)
                : playlist.snippet?.description,
            },
            status: {
              privacyStatus:
                privacyStatus || playlist.status?.privacyStatus,
            },
          },
        });

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                { success: true, title: res.data.snippet?.title },
                null,
                2
              ),
            },
          ],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify(formatApiError(err)) }],
        };
      }
    }
  );

  // --- Supprimer une playlist ---
  server.tool(
    "delete_playlist",
    "Supprime définitivement une playlist. ⚠️ Action irréversible !",
    {
      playlistId: z.string().describe("ID de la playlist"),
      confirm: z.boolean().describe("Confirmation (doit être true)"),
    },
    async ({ playlistId, confirm }) => {
      if (!confirm) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ error: "Suppression annulée. Passe confirm=true." }),
            },
          ],
        };
      }

      try {
        const yt = getYouTube();
        await yt.playlists.delete({ id: playlistId });

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ success: true, message: "Playlist supprimée." }),
            },
          ],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify(formatApiError(err)) }],
        };
      }
    }
  );

  // --- Lister les vidéos d'une playlist ---
  server.tool(
    "list_playlist_items",
    "Liste les vidéos contenues dans une playlist.",
    {
      playlistId: z.string().describe("ID de la playlist"),
      maxResults: z.number().min(1).max(50).default(25),
      pageToken: z.string().optional(),
    },
    async ({ playlistId, maxResults, pageToken }) => {
      try {
        const yt = getYouTube();
        const res = await yt.playlistItems.list({
          part: ["snippet", "contentDetails"],
          playlistId,
          maxResults,
          pageToken,
        });

        const result = {
          items: (res.data.items || []).map((item) => ({
            playlistItemId: item.id,
            videoId: item.contentDetails?.videoId,
            title: item.snippet?.title,
            position: item.snippet?.position,
            addedAt: item.snippet?.publishedAt,
          })),
          nextPageToken: res.data.nextPageToken || null,
          totalResults: res.data.pageInfo?.totalResults,
        };

        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify(formatApiError(err)) }],
        };
      }
    }
  );

  // --- Ajouter une vidéo à une playlist ---
  server.tool(
    "add_to_playlist",
    "Ajoute une vidéo à une playlist.",
    {
      playlistId: z.string().describe("ID de la playlist"),
      videoId: z.string().describe("ID de la vidéo à ajouter"),
      position: z
        .number()
        .optional()
        .describe("Position dans la playlist (0 = début)"),
    },
    async ({ playlistId, videoId, position }) => {
      if (!isValidVideoId(videoId)) {
        return {
          content: [
            { type: "text" as const, text: JSON.stringify({ error: "ID de vidéo invalide" }) },
          ],
        };
      }

      try {
        const yt = getYouTube();
        const res = await yt.playlistItems.insert({
          part: ["snippet"],
          requestBody: {
            snippet: {
              playlistId,
              resourceId: {
                kind: "youtube#video",
                videoId,
              },
              position,
            },
          },
        });

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  success: true,
                  playlistItemId: res.data.id,
                  title: res.data.snippet?.title,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify(formatApiError(err)) }],
        };
      }
    }
  );

  // --- Retirer une vidéo d'une playlist ---
  server.tool(
    "remove_from_playlist",
    "Retire une vidéo d'une playlist (nécessite l'ID de l'élément, pas l'ID de la vidéo).",
    {
      playlistItemId: z
        .string()
        .describe("ID de l'élément dans la playlist (obtenu via list_playlist_items)"),
    },
    async ({ playlistItemId }) => {
      try {
        const yt = getYouTube();
        await yt.playlistItems.delete({ id: playlistItemId });

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ success: true, message: "Vidéo retirée de la playlist." }),
            },
          ],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify(formatApiError(err)) }],
        };
      }
    }
  );
}
