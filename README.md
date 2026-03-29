<div align="center">

# ClaudeTube

**Serveur MCP pour connecter Claude a votre compte YouTube.**

Gerez vos videos, playlists, commentaires, sous-titres et votre chaine directement depuis Claude.

A l'origine, j'ai cree cet outil pour gerer ma propre chaine gaming [Descloizite](https://www.youtube.com/@Descloizite). En tant que createur, je voulais pouvoir piloter ma chaine directement depuis Claude sans quitter mon workflow. Le projet est ouvert a tous les createurs YouTube qui souhaitent faire de meme.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![MCP](https://img.shields.io/badge/MCP-Model%20Context%20Protocol-8B5CF6)](https://modelcontextprotocol.io)
[![YouTube API](https://img.shields.io/badge/YouTube-Data%20API%20v3-FF0000?logo=youtube&logoColor=white)](https://developers.google.com/youtube/v3)

<br/>

[Francais](#installation) | [English](#english)

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
| Validation | Zod (schemas runtime) |

## Securite

ClaudeTube est concu avec la securite comme priorite. Aucun compromis.

| Mesure | Detail |
|--------|--------|
| **OAuth 2.0** | Protocole standard. Aucun mot de passe YouTube n'est manipule. |
| **Chiffrement AES-256-GCM** | Les tokens sont chiffres au repos avec un IV aleatoire par operation et verification d'integrite via authentication tag. |
| **Aucun serveur distant** | Le serveur MCP tourne exclusivement en local. Les donnees transitent uniquement entre votre machine et l'API Google. |
| **Scopes minimaux** | Seuls les scopes YouTube strictement necessaires sont demandes lors de l'autorisation. |
| **Confirmation explicite** | Toute action destructive (suppression de video, playlist, commentaire) exige un parametre `confirm: true`. |
| **Validation des entrees** | Les identifiants YouTube sont valides par regex avant tout appel API. Les textes sont sanitises (caracteres de controle supprimes). |
| **Permissions fichiers** | Le repertoire de tokens est cree en `0700`, les fichiers en `0600`. |

<details>
<summary><strong>Architecture de chiffrement</strong></summary>

```
Cle source (env var ou derivee du homedir)
    |
    v
SHA-256 → Cle AES-256 (32 bytes)
    |
    v
Chiffrement AES-256-GCM
    - IV aleatoire (16 bytes) par operation
    - Authentication tag (16 bytes) pour l'integrite
    - Resultat stocke en JSON : { iv, tag, data }
```

Les tokens ne sont jamais ecrits en clair sur le disque.

</details>

## Outils disponibles (27)

### Authentification

| Outil | Description |
|-------|-------------|
| `auth` | Genere l'URL d'autorisation OAuth 2.0 |
| `auth_callback` | Finalise la connexion avec le code d'autorisation |
| `auth_status` | Verifie l'etat de connexion et affiche les infos de la chaine |
| `auth_revoke` | Deconnecte et supprime les tokens stockes |

### Videos

| Outil | Description |
|-------|-------------|
| `list_my_videos` | Liste les videos de votre chaine (titre, stats, statut) |
| `get_video` | Details complets d'une video (metadata, stats, tags) |
| `update_video` | Modifie titre, description, tags, categorie, confidentialite |
| `delete_video` | Supprime une video (confirmation requise) |
| `rate_video` | Like, dislike ou retire une note |

### Playlists

| Outil | Description |
|-------|-------------|
| `list_my_playlists` | Liste toutes vos playlists |
| `create_playlist` | Cree une nouvelle playlist |
| `update_playlist` | Modifie titre, description, confidentialite |
| `delete_playlist` | Supprime une playlist (confirmation requise) |
| `list_playlist_items` | Liste les videos d'une playlist |
| `add_to_playlist` | Ajoute une video a une playlist |
| `remove_from_playlist` | Retire une video d'une playlist |

### Commentaires

| Outil | Description |
|-------|-------------|
| `list_comments` | Liste les commentaires d'une video |
| `post_comment` | Poste un commentaire sur une video |
| `reply_to_comment` | Repond a un commentaire existant |
| `delete_comment` | Supprime un commentaire (confirmation requise) |
| `moderate_comment` | Approuve, rejette ou marque comme spam |

### Chaine

| Outil | Description |
|-------|-------------|
| `get_my_channel` | Informations completes de votre chaine |
| `update_my_channel` | Modifie description, mots-cles, langue, pays |

### Sous-titres

| Outil | Description |
|-------|-------------|
| `list_captions` | Liste les sous-titres d'une video |
| `download_caption` | Telecharge un sous-titre (SRT, SBV, VTT) |
| `delete_caption` | Supprime un sous-titre (confirmation requise) |

### Recherche

| Outil | Description |
|-------|-------------|
| `search_youtube` | Recherche videos, chaines ou playlists sur YouTube |

## Installation

### Prerequis

- Node.js 18 ou superieur
- Un projet Google Cloud avec l'API YouTube Data v3 activee
- Des identifiants OAuth 2.0 (type "Application de bureau")

### 1. Creer les identifiants Google

1. Accedez a [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Creez un projet ou selectionnez un projet existant
3. Activez l'**API YouTube Data v3** dans la [bibliotheque d'API](https://console.cloud.google.com/apis/library/youtube.googleapis.com)
4. Allez dans **Identifiants** > **Creer des identifiants** > **ID client OAuth 2.0**
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

Creez un fichier `.mcp.json` a la racine du projet :

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

Ajoutez `.mcp.json` a votre `.gitignore` pour ne pas exposer vos secrets.

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

Apres le redemarrage de Claude, demandez simplement :

> "Connecte-toi a mon compte YouTube"

Claude generera un lien d'autorisation via l'outil `auth`, puis finalisera la connexion avec `auth_callback`. Les tokens sont chiffres et stockes localement.

## Variables d'environnement

| Variable | Requis | Description |
|----------|--------|-------------|
| `YOUTUBE_CLIENT_ID` | Oui | Client ID OAuth 2.0 Google |
| `YOUTUBE_CLIENT_SECRET` | Oui | Client Secret OAuth 2.0 Google |
| `YOUTUBE_REDIRECT_URI` | Non | URI de redirection (defaut : `urn:ietf:wg:oauth:2.0:oob`) |
| `CLAUDETUBE_TOKEN_PATH` | Non | Chemin de stockage des tokens chiffres (defaut : `~/.claudetube/tokens.enc`) |
| `CLAUDETUBE_ENCRYPTION_KEY` | Non | Cle de chiffrement personnalisee pour les tokens |

## Exemples d'utilisation

```
"Liste mes 5 dernieres videos"
→ list_my_videos(maxResults: 5)

"Mets la video dQw4w9WgXcQ en non-repertorie"
→ update_video(videoId: "dQw4w9WgXcQ", privacyStatus: "unlisted")

"Cree une playlist 'Best of 2024' et ajoutes-y ces 3 videos"
→ create_playlist + add_to_playlist x3

"Reponds 'Merci !' aux 5 derniers commentaires sur ma video"
→ list_comments + reply_to_comment x5

"Quels sous-titres sont disponibles sur ma derniere video ?"
→ list_my_videos(maxResults: 1) + list_captions
```

## Architecture du projet

```
src/
├── index.ts              Point d'entree MCP, enregistrement des outils
├── auth/
│   └── oauth.ts          OAuth 2.0 flow, chiffrement et stockage des tokens
├── tools/
│   ├── videos.ts         Gestion des videos (CRUD + rating)
│   ├── playlists.ts      Gestion des playlists (CRUD + items)
│   ├── comments.ts       Commentaires (CRUD + moderation)
│   ├── channel.ts        Informations et modification de la chaine
│   ├── captions.ts       Sous-titres (list, download, delete)
│   └── search.ts         Recherche YouTube
└── utils/
    ├── errors.ts         Gestion d'erreurs API centralisee
    └── validation.ts     Validation et sanitisation des entrees
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
