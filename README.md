<div align="center">

# ClaudeTube

**Serveur MCP pour connecter Claude à votre compte YouTube.**

Gérez vos vidéos, playlists, commentaires, sous-titres et votre chaîne directement depuis Claude.

À l'origine, j'ai créé cet outil pour gérer ma propre chaîne gaming [Descloizite](https://www.youtube.com/@Descloizite). En tant que créateur, je voulais pouvoir piloter ma chaîne directement depuis Claude sans quitter mon workflow. Le projet est ouvert à tous les créateurs YouTube qui souhaitent faire de même.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![MCP](https://img.shields.io/badge/MCP-Model%20Context%20Protocol-8B5CF6)](https://modelcontextprotocol.io)
[![YouTube API](https://img.shields.io/badge/YouTube-Data%20API%20v3-FF0000?logo=youtube&logoColor=white)](https://developers.google.com/youtube/v3)

<br/>

[Français](#installation) | [English](#english)

</div>

---

## Stack technique

| Composant | Technologie |
|-----------|-------------|
| Runtime | Node.js 18+ |
| Langage | TypeScript (strict mode) |
| Protocole | Model Context Protocol (MCP) via `@modelcontextprotocol/sdk` |
| API | YouTube Data API v3 via `googleapis` |
| Authentification | OAuth 2.0 avec refresh automatique |
| Chiffrement | AES-256-GCM (tokens au repos) |
| Validation | Zod (schémas runtime) |

## Sécurité

ClaudeTube est conçu avec la sécurité comme priorité. Aucun compromis.

| Mesure | Détail |
|--------|--------|
| **OAuth 2.0** | Protocole standard. Aucun mot de passe YouTube n'est manipulé. |
| **Chiffrement AES-256-GCM** | Les tokens sont chiffrés au repos avec un IV aléatoire par opération et vérification d'intégrité via authentication tag. |
| **Aucun serveur distant** | Le serveur MCP tourne exclusivement en local. Les données transitent uniquement entre votre machine et l'API Google. |
| **Scopes minimaux** | Seuls les scopes YouTube strictement nécessaires sont demandés lors de l'autorisation. |
| **Confirmation explicite** | Toute action destructive (suppression de vidéo, playlist, commentaire) exige un paramètre `confirm: true`. |
| **Validation des entrées** | Les identifiants YouTube sont validés par regex avant tout appel API. Les textes sont sanitisés (caractères de contrôle supprimés). |
| **Permissions fichiers** | Le répertoire de tokens est créé en `0700`, les fichiers en `0600`. |

<details>
<summary><strong>Architecture de chiffrement</strong></summary>

```
Clé source (env var ou dérivée du homedir)
    |
    v
SHA-256 → Clé AES-256 (32 bytes)
    |
    v
Chiffrement AES-256-GCM
    - IV aléatoire (16 bytes) par opération
    - Authentication tag (16 bytes) pour l'intégrité
    - Résultat stocké en JSON : { iv, tag, data }
```

Les tokens ne sont jamais écrits en clair sur le disque.

</details>

## Outils disponibles (27)

### Authentification

| Outil | Description |
|-------|-------------|
| `auth` | Génère l'URL d'autorisation OAuth 2.0 |
| `auth_callback` | Finalise la connexion avec le code d'autorisation |
| `auth_status` | Vérifie l'état de connexion et affiche les infos de la chaîne |
| `auth_revoke` | Déconnecte et supprime les tokens stockés |

### Vidéos

| Outil | Description |
|-------|-------------|
| `list_my_videos` | Liste les vidéos de votre chaîne (titre, stats, statut) |
| `get_video` | Détails complets d'une vidéo (metadata, stats, tags) |
| `update_video` | Modifie titre, description, tags, catégorie, confidentialité |
| `delete_video` | Supprime une vidéo (confirmation requise) |
| `rate_video` | Like, dislike ou retire une note |

### Playlists

| Outil | Description |
|-------|-------------|
| `list_my_playlists` | Liste toutes vos playlists |
| `create_playlist` | Crée une nouvelle playlist |
| `update_playlist` | Modifie titre, description, confidentialité |
| `delete_playlist` | Supprime une playlist (confirmation requise) |
| `list_playlist_items` | Liste les vidéos d'une playlist |
| `add_to_playlist` | Ajoute une vidéo à une playlist |
| `remove_from_playlist` | Retire une vidéo d'une playlist |

### Commentaires

| Outil | Description |
|-------|-------------|
| `list_comments` | Liste les commentaires d'une vidéo |
| `post_comment` | Poste un commentaire sur une vidéo |
| `reply_to_comment` | Répond à un commentaire existant |
| `delete_comment` | Supprime un commentaire (confirmation requise) |
| `moderate_comment` | Approuve, rejette ou marque comme spam |

### Chaîne

| Outil | Description |
|-------|-------------|
| `get_my_channel` | Informations complètes de votre chaîne |
| `update_my_channel` | Modifie description, mots-clés, langue, pays |

### Sous-titres

| Outil | Description |
|-------|-------------|
| `list_captions` | Liste les sous-titres d'une vidéo |
| `download_caption` | Télécharge un sous-titre (SRT, SBV, VTT) |
| `delete_caption` | Supprime un sous-titre (confirmation requise) |

### Recherche

| Outil | Description |
|-------|-------------|
| `search_youtube` | Recherche vidéos, chaînes ou playlists sur YouTube |

## Installation

### Prérequis

- Node.js 18 ou supérieur
- Un projet Google Cloud avec l'API YouTube Data v3 activée
- Des identifiants OAuth 2.0 (type "Application de bureau")

### 1. Créer les identifiants Google

1. Accédez à [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Créez un projet ou sélectionnez un projet existant
3. Activez l'**API YouTube Data v3** dans la [bibliothèque d'API](https://console.cloud.google.com/apis/library/youtube.googleapis.com)
4. Allez dans **Identifiants** > **Créer des identifiants** > **ID client OAuth 2.0**
5. Type d'application : **Application de bureau**
6. Notez le `Client ID` et le `Client Secret`

### 2. Installer ClaudeTube

```bash
git clone https://github.com/fmenguy/ClaudeTube.git
cd ClaudeTube
npm install
npm run build
```

### 3. Configurer Claude

#### Option A — Claude Code (CLI / VS Code / JetBrains)

Créez un fichier `.mcp.json` à la racine du projet :

```json
{
  "mcpServers": {
    "claudetube": {
      "command": "node",
      "args": ["/chemin/vers/ClaudeTube/dist/index.js"],
      "env": {
        "YOUTUBE_CLIENT_ID": "votre-client-id.apps.googleusercontent.com",
        "YOUTUBE_CLIENT_SECRET": "votre-client-secret"
      }
    }
  }
}
```

Ajoutez `.mcp.json` à votre `.gitignore` pour ne pas exposer vos secrets.

#### Option B — Claude Desktop

Ajoutez la configuration suivante dans votre fichier `claude_desktop_config.json` :

```json
{
  "mcpServers": {
    "claudetube": {
      "command": "node",
      "args": ["/chemin/vers/ClaudeTube/dist/index.js"],
      "env": {
        "YOUTUBE_CLIENT_ID": "votre-client-id.apps.googleusercontent.com",
        "YOUTUBE_CLIENT_SECRET": "votre-client-secret"
      }
    }
  }
}
```

### 4. Connexion

Après le redémarrage de Claude, demandez simplement :

> "Connecte-toi à mon compte YouTube"

Claude génèrera un lien d'autorisation via l'outil `auth`, puis finalisera la connexion avec `auth_callback`. Les tokens sont chiffrés et stockés localement.

## Variables d'environnement

| Variable | Requis | Description |
|----------|--------|-------------|
| `YOUTUBE_CLIENT_ID` | Oui | Client ID OAuth 2.0 Google |
| `YOUTUBE_CLIENT_SECRET` | Oui | Client Secret OAuth 2.0 Google |
| `YOUTUBE_REDIRECT_URI` | Non | URI de redirection (défaut : `urn:ietf:wg:oauth:2.0:oob`) |
| `CLAUDETUBE_TOKEN_PATH` | Non | Chemin de stockage des tokens chiffrés (défaut : `~/.claudetube/tokens.enc`) |
| `CLAUDETUBE_ENCRYPTION_KEY` | Non | Clé de chiffrement personnalisée pour les tokens |

## Exemples d'utilisation

```
"Liste mes 5 dernières vidéos"
→ list_my_videos(maxResults: 5)

"Mets la vidéo dQw4w9WgXcQ en non-répertorié"
→ update_video(videoId: "dQw4w9WgXcQ", privacyStatus: "unlisted")

"Crée une playlist 'Best of 2024' et ajoutes-y ces 3 vidéos"
→ create_playlist + add_to_playlist x3

"Réponds 'Merci !' aux 5 derniers commentaires sur ma vidéo"
→ list_comments + reply_to_comment x5

"Quels sous-titres sont disponibles sur ma dernière vidéo ?"
→ list_my_videos(maxResults: 1) + list_captions
```

## Architecture du projet

```
src/
├── index.ts              Point d'entrée MCP, enregistrement des outils
├── auth/
│   └── oauth.ts          OAuth 2.0 flow, chiffrement et stockage des tokens
├── tools/
│   ├── videos.ts         Gestion des vidéos (CRUD + rating)
│   ├── playlists.ts      Gestion des playlists (CRUD + items)
│   ├── comments.ts       Commentaires (CRUD + modération)
│   ├── channel.ts        Informations et modification de la chaîne
│   ├── captions.ts       Sous-titres (list, download, delete)
│   └── search.ts         Recherche YouTube
└── utils/
    ├── errors.ts         Gestion d'erreurs API centralisée
    └── validation.ts     Validation et sanitisation des entrées
```

---

<div align="center">

# English

**MCP Server to connect Claude to your YouTube account.**

Manage your videos, playlists, comments, captions, and channel directly from Claude.

I originally built this tool to manage my own gaming channel [Descloizite](https://www.youtube.com/@Descloizite). As a creator, I wanted to control my channel directly from Claude without leaving my workflow. The project is open to all YouTube creators who want to do the same.

</div>

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Runtime | Node.js 18+ |
| Language | TypeScript (strict mode) |
| Protocol | Model Context Protocol (MCP) via `@modelcontextprotocol/sdk` |
| API | YouTube Data API v3 via `googleapis` |
| Authentication | OAuth 2.0 with automatic refresh |
| Encryption | AES-256-GCM (tokens at rest) |
| Validation | Zod (runtime schemas) |

## Security

ClaudeTube is built with security as a first-class priority. No compromises.

| Measure | Detail |
|---------|--------|
| **OAuth 2.0** | Industry-standard protocol. Your YouTube password is never handled. |
| **AES-256-GCM encryption** | Tokens are encrypted at rest with a random IV per operation and integrity verification via authentication tag. |
| **No remote server** | The MCP server runs exclusively on your local machine. Data only flows between you and Google's API. |
| **Minimal scopes** | Only strictly necessary YouTube scopes are requested during authorization. |
| **Explicit confirmation** | Every destructive action (video, playlist, comment deletion) requires a `confirm: true` parameter. |
| **Input validation** | YouTube identifiers are validated by regex before any API call. Text inputs are sanitized (control characters removed). |
| **File permissions** | The token directory is created with `0700`, token files with `0600`. |

<details>
<summary><strong>Encryption architecture</strong></summary>

```
Key source (env var or derived from homedir)
    |
    v
SHA-256 → AES-256 key (32 bytes)
    |
    v
AES-256-GCM encryption
    - Random IV (16 bytes) per operation
    - Authentication tag (16 bytes) for integrity
    - Stored as JSON: { iv, tag, data }
```

Tokens are never written in plaintext to disk.

</details>

## Available Tools (27)

### Authentication

| Tool | Description |
|------|-------------|
| `auth` | Generate the OAuth 2.0 authorization URL |
| `auth_callback` | Complete the connection with the authorization code |
| `auth_status` | Check connection status and display channel info |
| `auth_revoke` | Disconnect and delete stored tokens |

### Videos

| Tool | Description |
|------|-------------|
| `list_my_videos` | List your channel's videos (title, stats, status) |
| `get_video` | Full video details (metadata, stats, tags) |
| `update_video` | Update title, description, tags, category, privacy |
| `delete_video` | Delete a video (confirmation required) |
| `rate_video` | Like, dislike, or remove a rating |

### Playlists

| Tool | Description |
|------|-------------|
| `list_my_playlists` | List all your playlists |
| `create_playlist` | Create a new playlist |
| `update_playlist` | Update title, description, privacy |
| `delete_playlist` | Delete a playlist (confirmation required) |
| `list_playlist_items` | List videos in a playlist |
| `add_to_playlist` | Add a video to a playlist |
| `remove_from_playlist` | Remove a video from a playlist |

### Comments

| Tool | Description |
|------|-------------|
| `list_comments` | List comments on a video |
| `post_comment` | Post a comment on a video |
| `reply_to_comment` | Reply to an existing comment |
| `delete_comment` | Delete a comment (confirmation required) |
| `moderate_comment` | Approve, reject, or mark as spam |

### Channel

| Tool | Description |
|------|-------------|
| `get_my_channel` | Full channel information |
| `update_my_channel` | Update description, keywords, language, country |

### Captions

| Tool | Description |
|------|-------------|
| `list_captions` | List captions for a video |
| `download_caption` | Download a caption track (SRT, SBV, VTT) |
| `delete_caption` | Delete a caption track (confirmation required) |

### Search

| Tool | Description |
|------|-------------|
| `search_youtube` | Search videos, channels, or playlists on YouTube |

## Installation

### Prerequisites

- Node.js 18 or higher
- A Google Cloud project with YouTube Data API v3 enabled
- OAuth 2.0 credentials (Desktop application type)

### 1. Create Google credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a project or select an existing one
3. Enable **YouTube Data API v3** in the [API library](https://console.cloud.google.com/apis/library/youtube.googleapis.com)
4. Go to **Credentials** > **Create Credentials** > **OAuth 2.0 Client ID**
5. Application type: **Desktop application**
6. Note down the `Client ID` and `Client Secret`

### 2. Install ClaudeTube

```bash
git clone https://github.com/fmenguy/ClaudeTube.git
cd ClaudeTube
npm install
npm run build
```

### 3. Configure Claude

#### Option A — Claude Code (CLI / VS Code / JetBrains)

Create a `.mcp.json` file at the root of your project:

```json
{
  "mcpServers": {
    "claudetube": {
      "command": "node",
      "args": ["/path/to/ClaudeTube/dist/index.js"],
      "env": {
        "YOUTUBE_CLIENT_ID": "your-client-id.apps.googleusercontent.com",
        "YOUTUBE_CLIENT_SECRET": "your-client-secret"
      }
    }
  }
}
```

Add `.mcp.json` to your `.gitignore` to keep your secrets safe.

#### Option B — Claude Desktop

Add the following to your `claude_desktop_config.json` file:

```json
{
  "mcpServers": {
    "claudetube": {
      "command": "node",
      "args": ["/path/to/ClaudeTube/dist/index.js"],
      "env": {
        "YOUTUBE_CLIENT_ID": "your-client-id.apps.googleusercontent.com",
        "YOUTUBE_CLIENT_SECRET": "your-client-secret"
      }
    }
  }
}
```

### 4. Connect

After restarting Claude, simply ask:

> "Connect to my YouTube account"

Claude will generate an authorization link via the `auth` tool, then complete the connection with `auth_callback`. Tokens are encrypted and stored locally.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `YOUTUBE_CLIENT_ID` | Yes | Google OAuth 2.0 Client ID |
| `YOUTUBE_CLIENT_SECRET` | Yes | Google OAuth 2.0 Client Secret |
| `YOUTUBE_REDIRECT_URI` | No | Redirect URI (default: `urn:ietf:wg:oauth:2.0:oob`) |
| `CLAUDETUBE_TOKEN_PATH` | No | Encrypted token storage path (default: `~/.claudetube/tokens.enc`) |
| `CLAUDETUBE_ENCRYPTION_KEY` | No | Custom encryption key for tokens |

## Usage Examples

```
"List my last 5 videos"
→ list_my_videos(maxResults: 5)

"Set video dQw4w9WgXcQ to unlisted"
→ update_video(videoId: "dQw4w9WgXcQ", privacyStatus: "unlisted")

"Create a playlist 'Best of 2024' and add these 3 videos"
→ create_playlist + add_to_playlist x3

"Reply 'Thanks!' to the last 5 comments on my video"
→ list_comments + reply_to_comment x5
```

## Project Structure

```
src/
├── index.ts              MCP entry point, tool registration
├── auth/
│   └── oauth.ts          OAuth 2.0 flow, token encryption & storage
├── tools/
│   ├── videos.ts         Video management (CRUD + rating)
│   ├── playlists.ts      Playlist management (CRUD + items)
│   ├── comments.ts       Comments (CRUD + moderation)
│   ├── channel.ts        Channel info & updates
│   ├── captions.ts       Captions (list, download, delete)
│   └── search.ts         YouTube search
└── utils/
    ├── errors.ts         Centralized API error handling
    └── validation.ts     Input validation & sanitization
```

---

## License

MIT — see [LICENSE](LICENSE)
