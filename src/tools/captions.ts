/**
 * Outils MCP pour la gestion des sous-titres YouTube
 *
 * Lister, télécharger et supprimer les sous-titres
 * associés aux vidéos de ta chaîne.
 */

import { youtube_v3 } from "googleapis";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { formatApiError } from "../utils/errors.js";
import { isValidVideoId } from "../utils/validation.js";

export function registerCaptionTools(
  server: McpServer,
  getYouTube: () => youtube_v3.Youtube
) {
  // --- Lister les sous-titres d'une vidéo ---
  server.tool(
    "list_captions",
    "Liste tous les sous-titres disponibles pour une vidéo.",
    {
      videoId: z.string().describe("ID de la vidéo"),
    },
    async ({ videoId }) => {
      if (!isValidVideoId(videoId)) {
        return {
          content: [
            { type: "text" as const, text: JSON.stringify({ error: "ID de vidéo invalide" }) },
          ],
        };
      }

      try {
        const yt = getYouTube();
        const res = await yt.captions.list({
          part: ["snippet"],
          videoId,
        });

        const result = {
          captions: (res.data.items || []).map((c) => ({
            id: c.id,
            language: c.snippet?.language,
            name: c.snippet?.name,
            trackKind: c.snippet?.trackKind,
            isDraft: c.snippet?.isDraft,
            isAutoSynced: c.snippet?.isAutoSynced,
            lastUpdated: c.snippet?.lastUpdated,
          })),
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

  // --- Télécharger un sous-titre ---
  server.tool(
    "download_caption",
    "Télécharge le contenu d'un sous-titre (texte brut ou SRT).",
    {
      captionId: z.string().describe("ID du sous-titre (obtenu via list_captions)"),
      format: z
        .enum(["srt", "sbv", "vtt"])
        .default("srt")
        .describe("Format de sortie"),
    },
    async ({ captionId, format }) => {
      try {
        const yt = getYouTube();
        const res = await yt.captions.download({
          id: captionId,
          tfmt: format,
        });

        // La réponse contient le texte du sous-titre
        const content =
          typeof res.data === "string"
            ? res.data
            : JSON.stringify(res.data);

        return {
          content: [{ type: "text" as const, text: content }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify(formatApiError(err)) }],
        };
      }
    }
  );

  // --- Supprimer un sous-titre ---
  server.tool(
    "delete_caption",
    "Supprime un sous-titre d'une vidéo. ⚠️ Action irréversible !",
    {
      captionId: z.string().describe("ID du sous-titre"),
      confirm: z.boolean().describe("Confirmation (doit être true)"),
    },
    async ({ captionId, confirm }) => {
      if (!confirm) {
        return {
          content: [
            { type: "text" as const, text: JSON.stringify({ error: "Suppression annulée." }) },
          ],
        };
      }

      try {
        const yt = getYouTube();
        await yt.captions.delete({ id: captionId });

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ success: true, message: "Sous-titre supprimé." }),
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
