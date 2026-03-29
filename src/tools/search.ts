/**
 * Outils MCP pour la recherche YouTube
 *
 * Rechercher des vidéos, chaînes et playlists sur YouTube.
 */

import { youtube_v3 } from "googleapis";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { formatApiError } from "../utils/errors.js";

export function registerSearchTools(
  server: McpServer,
  getYouTube: () => youtube_v3.Youtube
) {
  // --- Recherche YouTube ---
  server.tool(
    "search_youtube",
    "Recherche des vidéos, chaînes ou playlists sur YouTube.",
    {
      query: z.string().min(1).describe("Termes de recherche"),
      type: z
        .enum(["video", "channel", "playlist"])
        .default("video")
        .describe("Type de résultat"),
      maxResults: z.number().min(1).max(50).default(10),
      order: z
        .enum(["relevance", "date", "viewCount", "rating"])
        .default("relevance")
        .describe("Critère de tri"),
      channelId: z
        .string()
        .optional()
        .describe("Filtrer par chaîne (ID)"),
      publishedAfter: z
        .string()
        .optional()
        .describe("Date minimale (ISO 8601, ex: 2024-01-01T00:00:00Z)"),
      publishedBefore: z
        .string()
        .optional()
        .describe("Date maximale (ISO 8601)"),
      pageToken: z.string().optional(),
    },
    async ({
      query,
      type,
      maxResults,
      order,
      channelId,
      publishedAfter,
      publishedBefore,
      pageToken,
    }) => {
      try {
        const yt = getYouTube();
        const res = await yt.search.list({
          part: ["snippet"],
          q: query,
          type: [type],
          maxResults,
          order,
          channelId,
          publishedAfter,
          publishedBefore,
          pageToken,
        });

        const result = {
          results: (res.data.items || []).map((item) => ({
            kind: item.id?.kind,
            videoId: item.id?.videoId,
            channelId: item.id?.channelId,
            playlistId: item.id?.playlistId,
            title: item.snippet?.title,
            description: item.snippet?.description?.slice(0, 200),
            channelTitle: item.snippet?.channelTitle,
            publishedAt: item.snippet?.publishedAt,
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
}
