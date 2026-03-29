/**
 * Outils MCP pour la gestion des commentaires YouTube
 *
 * Lister, répondre, supprimer et modérer les commentaires
 * sur les vidéos de ta chaîne.
 */

import { youtube_v3 } from "googleapis";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { formatApiError } from "../utils/errors.js";
import { isValidVideoId, isValidCommentId, sanitize } from "../utils/validation.js";

export function registerCommentTools(
  server: McpServer,
  getYouTube: () => youtube_v3.Youtube
) {
  // --- Lister les commentaires d'une vidéo ---
  server.tool(
    "list_comments",
    "Liste les commentaires d'une vidéo YouTube.",
    {
      videoId: z.string().describe("ID de la vidéo"),
      maxResults: z.number().min(1).max(100).default(20),
      order: z
        .enum(["time", "relevance"])
        .default("relevance")
        .describe("Tri par pertinence ou chronologique"),
      pageToken: z.string().optional(),
    },
    async ({ videoId, maxResults, order, pageToken }) => {
      if (!isValidVideoId(videoId)) {
        return {
          content: [
            { type: "text" as const, text: JSON.stringify({ error: "ID de vidéo invalide" }) },
          ],
        };
      }

      try {
        const yt = getYouTube();
        const res = await yt.commentThreads.list({
          part: ["snippet", "replies"],
          videoId,
          maxResults,
          order,
          pageToken,
        });

        const result = {
          comments: (res.data.items || []).map((thread) => {
            const top = thread.snippet?.topLevelComment?.snippet;
            return {
              commentId: thread.snippet?.topLevelComment?.id,
              threadId: thread.id,
              author: top?.authorDisplayName,
              text: top?.textDisplay,
              likeCount: top?.likeCount,
              publishedAt: top?.publishedAt,
              replyCount: thread.snippet?.totalReplyCount,
              replies: (thread.replies?.comments || []).map((r) => ({
                commentId: r.id,
                author: r.snippet?.authorDisplayName,
                text: r.snippet?.textDisplay,
                publishedAt: r.snippet?.publishedAt,
              })),
            };
          }),
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

  // --- Répondre à un commentaire ---
  server.tool(
    "reply_to_comment",
    "Répond à un commentaire existant sur une de tes vidéos.",
    {
      parentId: z
        .string()
        .describe("ID du commentaire auquel répondre"),
      text: z.string().min(1).describe("Texte de la réponse"),
    },
    async ({ parentId, text }) => {
      if (!isValidCommentId(parentId)) {
        return {
          content: [
            { type: "text" as const, text: JSON.stringify({ error: "ID de commentaire invalide" }) },
          ],
        };
      }

      try {
        const yt = getYouTube();
        const res = await yt.comments.insert({
          part: ["snippet"],
          requestBody: {
            snippet: {
              parentId,
              textOriginal: sanitize(text),
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
                  commentId: res.data.id,
                  text: res.data.snippet?.textDisplay,
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

  // --- Poster un commentaire sur une vidéo ---
  server.tool(
    "post_comment",
    "Poste un nouveau commentaire sur une vidéo.",
    {
      videoId: z.string().describe("ID de la vidéo"),
      text: z.string().min(1).describe("Texte du commentaire"),
    },
    async ({ videoId, text }) => {
      if (!isValidVideoId(videoId)) {
        return {
          content: [
            { type: "text" as const, text: JSON.stringify({ error: "ID de vidéo invalide" }) },
          ],
        };
      }

      try {
        const yt = getYouTube();
        const res = await yt.commentThreads.insert({
          part: ["snippet"],
          requestBody: {
            snippet: {
              videoId,
              topLevelComment: {
                snippet: {
                  textOriginal: sanitize(text),
                },
              },
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
                  threadId: res.data.id,
                  text: res.data.snippet?.topLevelComment?.snippet?.textDisplay,
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

  // --- Supprimer un commentaire ---
  server.tool(
    "delete_comment",
    "Supprime un commentaire. Tu dois être propriétaire du commentaire ou de la vidéo.",
    {
      commentId: z.string().describe("ID du commentaire à supprimer"),
      confirm: z.boolean().describe("Confirmation (doit être true)"),
    },
    async ({ commentId, confirm }) => {
      if (!confirm) {
        return {
          content: [
            { type: "text" as const, text: JSON.stringify({ error: "Suppression annulée." }) },
          ],
        };
      }

      try {
        const yt = getYouTube();
        await yt.comments.delete({ id: commentId });

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ success: true, message: "Commentaire supprimé." }),
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

  // --- Modérer un commentaire ---
  server.tool(
    "moderate_comment",
    "Modère un commentaire : approuver, rejeter, marquer comme spam, ou mettre en attente.",
    {
      commentId: z.string().describe("ID du commentaire"),
      moderationStatus: z
        .enum(["published", "heldForReview", "rejected"])
        .describe("Nouveau statut de modération"),
      banAuthor: z
        .boolean()
        .default(false)
        .describe("Bannir également l'auteur du commentaire"),
    },
    async ({ commentId, moderationStatus, banAuthor }) => {
      try {
        const yt = getYouTube();
        await yt.comments.setModerationStatus({
          id: [commentId],
          moderationStatus,
          banAuthor,
        });

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                message: `Commentaire ${commentId} → ${moderationStatus}${banAuthor ? " (auteur banni)" : ""}`,
              }),
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
