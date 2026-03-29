/**
 * Outils MCP pour la gestion de la chaîne YouTube
 *
 * Consulter et modifier les informations de ta chaîne :
 * description, mots-clés, pays, etc.
 */

import { youtube_v3 } from "googleapis";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { formatApiError } from "../utils/errors.js";
import { sanitize } from "../utils/validation.js";

export function registerChannelTools(
  server: McpServer,
  getYouTube: () => youtube_v3.Youtube
) {
  // --- Infos de ma chaîne ---
  server.tool(
    "get_my_channel",
    "Récupère les informations complètes de ta chaîne YouTube : stats, description, branding.",
    {},
    async () => {
      try {
        const yt = getYouTube();
        const res = await yt.channels.list({
          part: [
            "snippet",
            "statistics",
            "brandingSettings",
            "contentDetails",
            "status",
          ],
          mine: true,
        });

        const channel = res.data.items?.[0];
        if (!channel) {
          return {
            content: [
              { type: "text" as const, text: JSON.stringify({ error: "Chaîne introuvable" }) },
            ],
          };
        }

        const result = {
          id: channel.id,
          title: channel.snippet?.title,
          description: channel.snippet?.description,
          customUrl: channel.snippet?.customUrl,
          country: channel.snippet?.country,
          publishedAt: channel.snippet?.publishedAt,
          subscribers: channel.statistics?.subscriberCount,
          videoCount: channel.statistics?.videoCount,
          viewCount: channel.statistics?.viewCount,
          uploadsPlaylistId:
            channel.contentDetails?.relatedPlaylists?.uploads,
          keywords: channel.brandingSettings?.channel?.keywords,
          defaultLanguage:
            channel.brandingSettings?.channel?.defaultLanguage,
          madeForKids: channel.status?.madeForKids,
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

  // --- Modifier ma chaîne ---
  server.tool(
    "update_my_channel",
    "Modifie la description, les mots-clés ou la langue par défaut de ta chaîne.",
    {
      description: z.string().optional().describe("Nouvelle description de la chaîne"),
      keywords: z
        .string()
        .optional()
        .describe("Mots-clés de la chaîne (séparés par des espaces)"),
      defaultLanguage: z
        .string()
        .optional()
        .describe("Langue par défaut (code ISO, ex: fr, en)"),
      country: z
        .string()
        .optional()
        .describe("Pays de la chaîne (code ISO, ex: FR, US)"),
    },
    async ({ description, keywords, defaultLanguage, country }) => {
      try {
        const yt = getYouTube();

        // Récupérer les données actuelles
        const current = await yt.channels.list({
          part: ["brandingSettings"],
          mine: true,
        });

        const channel = current.data.items?.[0];
        if (!channel) {
          return {
            content: [
              { type: "text" as const, text: JSON.stringify({ error: "Chaîne introuvable" }) },
            ],
          };
        }

        const branding = channel.brandingSettings?.channel || {};

        const res = await yt.channels.update({
          part: ["brandingSettings"],
          requestBody: {
            id: channel.id!,
            brandingSettings: {
              channel: {
                description: description
                  ? sanitize(description)
                  : branding.description,
                keywords: keywords || branding.keywords,
                defaultLanguage:
                  defaultLanguage || branding.defaultLanguage,
                country: country || branding.country,
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
                  channel: {
                    description:
                      res.data.brandingSettings?.channel?.description?.slice(
                        0,
                        100
                      ),
                    keywords: res.data.brandingSettings?.channel?.keywords,
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
}
