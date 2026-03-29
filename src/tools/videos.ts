/**
 * Outils MCP pour la gestion des vidéos YouTube
 *
 * Permet de lister, consulter, modifier et supprimer les vidéos
 * d'une chaîne YouTube authentifiée.
 */

import { youtube_v3 } from "googleapis";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { formatApiError } from "../utils/errors.js";
import { isValidVideoId, sanitize } from "../utils/validation.js";

export function registerVideoTools(
  server: McpServer,
  getYouTube: () => youtube_v3.Youtube
) {
  // --- Lister mes vidéos ---
  server.tool(
    "list_my_videos",
    "Liste les vidéos de ta chaîne YouTube. Retourne titre, ID, stats, date de publication.",
    {
      maxResults: z
        .number()
        .min(1)
        .max(50)
        .default(10)
        .describe("Nombre de vidéos à retourner (1-50)"),
      pageToken: z
        .string()
        .optional()
        .describe("Token de pagination pour la page suivante"),
      order: z
        .enum(["date", "rating", "viewCount", "title"])
        .default("date")
        .describe("Critère de tri"),
    },
    async ({ maxResults, pageToken, order }) => {
      try {
        const yt = getYouTube();

        // Récupérer l'ID de la chaîne authentifiée
        const channelRes = await yt.channels.list({
          part: ["contentDetails"],
          mine: true,
        });
        const uploadsPlaylistId =
          channelRes.data.items?.[0]?.contentDetails?.relatedPlaylists
            ?.uploads;

        if (!uploadsPlaylistId) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  error: "Impossible de trouver la playlist d'uploads",
                }),
              },
            ],
          };
        }

        // Lister les vidéos de la playlist uploads
        const playlistRes = await yt.playlistItems.list({
          part: ["snippet", "contentDetails"],
          playlistId: uploadsPlaylistId,
          maxResults,
          pageToken,
        });

        // Récupérer les stats détaillées de chaque vidéo
        const videoIds =
          playlistRes.data.items
            ?.map((item) => item.contentDetails?.videoId)
            .filter(Boolean) || [];

        let videos: youtube_v3.Schema$Video[] = [];
        if (videoIds.length > 0) {
          const videoRes = await yt.videos.list({
            part: ["snippet", "statistics", "status"],
            id: videoIds as string[],
          });
          videos = videoRes.data.items || [];
        }

        const result = {
          videos: videos.map((v) => ({
            id: v.id,
            title: v.snippet?.title,
            description: v.snippet?.description?.slice(0, 200),
            publishedAt: v.snippet?.publishedAt,
            status: v.status?.privacyStatus,
            views: v.statistics?.viewCount,
            likes: v.statistics?.likeCount,
            comments: v.statistics?.commentCount,
          })),
          nextPageToken: playlistRes.data.nextPageToken || null,
          totalResults: playlistRes.data.pageInfo?.totalResults,
        };

        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(formatApiError(err)) },
          ],
        };
      }
    }
  );

  // --- Détails d'une vidéo ---
  server.tool(
    "get_video",
    "Récupère les détails complets d'une vidéo : titre, description, tags, stats, statut.",
    {
      videoId: z.string().describe("ID de la vidéo YouTube (11 caractères)"),
    },
    async ({ videoId }) => {
      if (!isValidVideoId(videoId)) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: `ID de vidéo invalide: "${videoId}". Un ID YouTube fait 11 caractères.`,
              }),
            },
          ],
        };
      }

      try {
        const yt = getYouTube();
        const res = await yt.videos.list({
          part: [
            "snippet",
            "statistics",
            "status",
            "contentDetails",
            "topicDetails",
          ],
          id: [videoId],
        });

        const video = res.data.items?.[0];
        if (!video) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({ error: "Vidéo introuvable" }),
              },
            ],
          };
        }

        const result = {
          id: video.id,
          title: video.snippet?.title,
          description: video.snippet?.description,
          tags: video.snippet?.tags,
          categoryId: video.snippet?.categoryId,
          publishedAt: video.snippet?.publishedAt,
          channelTitle: video.snippet?.channelTitle,
          duration: video.contentDetails?.duration,
          definition: video.contentDetails?.definition,
          privacyStatus: video.status?.privacyStatus,
          embeddable: video.status?.embeddable,
          madeForKids: video.status?.madeForKids,
          views: video.statistics?.viewCount,
          likes: video.statistics?.likeCount,
          comments: video.statistics?.commentCount,
          topics: video.topicDetails?.topicCategories,
        };

        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(formatApiError(err)) },
          ],
        };
      }
    }
  );

  // --- Modifier une vidéo ---
  server.tool(
    "update_video",
    "Modifie les métadonnées d'une vidéo : titre, description, tags, catégorie, statut de confidentialité.",
    {
      videoId: z.string().describe("ID de la vidéo à modifier"),
      title: z.string().optional().describe("Nouveau titre"),
      description: z.string().optional().describe("Nouvelle description"),
      tags: z
        .array(z.string())
        .optional()
        .describe("Nouveaux tags (remplace les existants)"),
      categoryId: z.string().optional().describe("ID de catégorie YouTube"),
      privacyStatus: z
        .enum(["public", "private", "unlisted"])
        .optional()
        .describe("Statut de confidentialité"),
      madeForKids: z
        .boolean()
        .optional()
        .describe("Contenu destiné aux enfants"),
      embeddable: z
        .boolean()
        .optional()
        .describe("Autoriser l'intégration sur d'autres sites"),
    },
    async ({
      videoId,
      title,
      description,
      tags,
      categoryId,
      privacyStatus,
      madeForKids,
      embeddable,
    }) => {
      if (!isValidVideoId(videoId)) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ error: `ID de vidéo invalide: "${videoId}"` }),
            },
          ],
        };
      }

      try {
        const yt = getYouTube();

        // Récupérer les données actuelles pour merger
        const current = await yt.videos.list({
          part: ["snippet", "status"],
          id: [videoId],
        });

        const video = current.data.items?.[0];
        if (!video) {
          return {
            content: [
              { type: "text" as const, text: JSON.stringify({ error: "Vidéo introuvable" }) },
            ],
          };
        }

        // Construire la requête de mise à jour (merge avec l'existant)
        const updateBody: youtube_v3.Schema$Video = {
          id: videoId,
          snippet: {
            title: title ? sanitize(title) : video.snippet?.title,
            description: description
              ? sanitize(description)
              : video.snippet?.description,
            tags: tags || video.snippet?.tags,
            categoryId: categoryId || video.snippet?.categoryId,
          },
          status: {
            privacyStatus:
              privacyStatus || video.status?.privacyStatus,
            madeForKids:
              madeForKids !== undefined
                ? madeForKids
                : video.status?.madeForKids,
            embeddable:
              embeddable !== undefined
                ? embeddable
                : video.status?.embeddable,
          },
        };

        const res = await yt.videos.update({
          part: ["snippet", "status"],
          requestBody: updateBody,
        });

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  success: true,
                  video: {
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
          content: [
            { type: "text" as const, text: JSON.stringify(formatApiError(err)) },
          ],
        };
      }
    }
  );

  // --- Supprimer une vidéo ---
  server.tool(
    "delete_video",
    "Supprime définitivement une vidéo de ta chaîne. ⚠️ Action irréversible !",
    {
      videoId: z.string().describe("ID de la vidéo à supprimer"),
      confirm: z
        .boolean()
        .describe(
          "Confirmation explicite de suppression (doit être true)"
        ),
    },
    async ({ videoId, confirm }) => {
      if (!confirm) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error:
                  "Suppression annulée. Passe confirm=true pour confirmer.",
              }),
            },
          ],
        };
      }

      if (!isValidVideoId(videoId)) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ error: `ID de vidéo invalide: "${videoId}"` }),
            },
          ],
        };
      }

      try {
        const yt = getYouTube();
        await yt.videos.delete({ id: videoId });

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                message: `Vidéo ${videoId} supprimée définitivement.`,
              }),
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(formatApiError(err)) },
          ],
        };
      }
    }
  );

  // --- Noter une vidéo ---
  server.tool(
    "rate_video",
    "Ajoute un like, dislike ou retire ta note sur une vidéo.",
    {
      videoId: z.string().describe("ID de la vidéo"),
      rating: z
        .enum(["like", "dislike", "none"])
        .describe("Note à attribuer"),
    },
    async ({ videoId, rating }) => {
      if (!isValidVideoId(videoId)) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ error: `ID de vidéo invalide: "${videoId}"` }),
            },
          ],
        };
      }

      try {
        const yt = getYouTube();
        await yt.videos.rate({ id: videoId, rating });

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                message: `Vote "${rating}" enregistré pour la vidéo ${videoId}.`,
              }),
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(formatApiError(err)) },
          ],
        };
      }
    }
  );
}
