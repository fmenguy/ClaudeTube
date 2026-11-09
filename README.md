<div align="center">

# ClaudeTube

🇫🇷 Français · 🇬🇧 [English](#english)

**Serveur MCP qui connecte Claude à un compte YouTube.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![MCP](https://img.shields.io/badge/MCP-Model%20Context%20Protocol-8B5CF6)](https://modelcontextprotocol.io)
[![YouTube API](https://img.shields.io/badge/YouTube-Data%20API%20v3-FF0000?logo=youtube&logoColor=white)](https://developers.google.com/youtube/v3)
![Statut : archivé](https://img.shields.io/badge/statut-archiv%C3%A9-lightgrey)

</div>

> [!WARNING]
> **Projet archivé.** ClaudeTube n'est plus maintenu. Le code reste en ligne, en lecture seule, pour qui veut s'en inspirer ou le reprendre : aucune correction ni évolution n'est prévue, et les dépendances ne sont plus mises à jour.

ClaudeTube est un serveur MCP local qui relie Claude à l'API YouTube Data v3 par OAuth 2.0. Il expose 27 outils pour gérer ses vidéos, playlists, commentaires, sous-titres et sa chaîne depuis une conversation, sans passer par YouTube Studio.

Il a été écrit pour piloter la chaîne gaming [Descloizite](https://www.youtube.com/@Descloizite). La démarche et les choix techniques sont racontés dans l'article [ClaudeTube : mon propre serveur MCP pour piloter YouTube depuis Claude](https://fmenguy.fr/blog/claudetube-mcp-youtube/).

## Stack technique

| Composant | Technologie |
|-----------|-------------|
| Exécution | Node.js 18 ou plus |
| Langage | TypeScript (mode strict) |
| Protocole | Model Context Protocol, via `@modelcontextprotocol/sdk`, transport stdio |
| API | YouTube Data API v3, via `googleapis` |
| Authentification | OAuth 2.0 avec rafraîchissement automatique du jeton |
| Chiffrement | AES-256-GCM pour les jetons stockés sur le disque |
| Validation | Zod (schémas des paramètres de chaque outil) |

## Outils disponibles (27)

### Authentification

| Outil | Description |
|-------|-------------|
| `auth` | Génère l'URL d'autorisation OAuth 2.0 |
| `auth_callback` | Finalise la connexion avec le code d'autorisation |
| `auth_status` | Indique si la connexion est active et affiche la chaîne connectée |
| `auth_revoke` | Supprime les jetons stockés en local (confirmation requise). L'autorisation n'est pas révoquée côté Google |

### Vidéos

| Outil | Description |
|-------|-------------|
| `list_my_videos` | Liste les vidéos de la chaîne (titre, statistiques, statut), tri par date, note, vues ou titre |
| `get_video` | Détails complets d'une vidéo (métadonnées, statistiques, tags) |
| `update_video` | Modifie titre, description, tags, catégorie, confidentialité, intégration externe et mention « conçu pour les enfants » |
| `delete_video` | Supprime une vidéo (confirmation requise) |
| `rate_video` | Ajoute un « j'aime », un « je n'aime pas » ou retire la note |

### Playlists

| Outil | Description |
|-------|-------------|
| `list_my_playlists` | Liste les playlists de la chaîne |
| `create_playlist` | Crée une playlist |
| `update_playlist` | Modifie titre, description, confidentialité |
| `delete_playlist` | Supprime une playlist (confirmation requise) |
| `list_playlist_items` | Liste les vidéos d'une playlist |
| `add_to_playlist` | Ajoute une vidéo à une playlist, à une position donnée si besoin |
| `remove_from_playlist` | Retire un élément d'une playlist (identifiant d'élément obtenu via `list_playlist_items`, pas l'identifiant de la vidéo) |

### Commentaires

| Outil | Description |
|-------|-------------|
| `list_comments` | Liste les commentaires d'une vidéo, par pertinence ou par date |
| `post_comment` | Publie un commentaire sur une vidéo |
| `reply_to_comment` | Répond à un commentaire existant |
| `delete_comment` | Supprime un commentaire (confirmation requise) |
| `moderate_comment` | Passe un commentaire en publié, en attente d'examen ou rejeté, avec bannissement facultatif de l'auteur |

### Chaîne

| Outil | Description |
|-------|-------------|
| `get_my_channel` | Informations de la chaîne (statistiques, description, branding) |
| `update_my_channel` | Modifie description, mots-clés, langue par défaut, pays |

### Sous-titres

| Outil | Description |
|-------|-------------|
| `list_captions` | Liste les pistes de sous-titres d'une vidéo |
| `download_caption` | Télécharge une piste au format SRT (par défaut), SBV ou VTT |
| `delete_caption` | Supprime une piste (confirmation requise) |

### Recherche

| Outil | Description |
|-------|-------------|
| `search_youtube` | Recherche des vidéos, chaînes ou playlists, avec tri et filtres par chaîne et par date de publication |

## Sécurité

| Mesure | Détail |
|--------|--------|
| **OAuth 2.0** | Protocole standard de Google. Le mot de passe du compte n'est jamais manipulé. |
| **Jetons chiffrés** | Les jetons sont chiffrés en AES-256-GCM, avec un IV aléatoire à chaque écriture et un tag d'authentification qui détecte toute altération du fichier. |
| **Exécution locale** | Le serveur tourne sur la machine de l'utilisateur. Les données ne circulent qu'entre cette machine et l'API Google. |
| **Confirmation explicite** | `delete_video`, `delete_playlist`, `delete_comment`, `delete_caption` et `auth_revoke` refusent d'agir sans le paramètre `confirm: true`. |
| **Validation des entrées** | Les identifiants de vidéo (et, selon l'outil, de playlist ou de commentaire) sont contrôlés par expression régulière avant l'appel à l'API. Les titres, descriptions et commentaires sont débarrassés des caractères de contrôle. |
| **Permissions des fichiers** | Le dossier des jetons est créé en `0700` et le fichier en `0600` (effectif sur les systèmes de type Unix, sans effet sous Windows). |

Deux limites à connaître :

- **Clé de chiffrement par défaut.** Sans `CLAUDETUBE_ENCRYPTION_KEY`, la clé est dérivée du chemin du dossier personnel de l'utilisateur, donc prévisible. Le chiffrement protège alors d'une lecture accidentelle, pas d'un attaquant qui a accès au fichier. Pour une vraie protection, définir cette variable.
- **Portées OAuth.** Trois portées sont demandées : `youtube`, `youtube.force-ssl` et `youtube.upload`. Cette dernière n'est utilisée par aucun outil, aucun envoi de vidéo n'étant implémenté.

<details>
<summary><strong>Schéma du chiffrement</strong></summary>

```
Source de la clé (CLAUDETUBE_ENCRYPTION_KEY, sinon chaîne dérivée du dossier personnel)
    |
    v
SHA-256 → clé AES-256 (32 octets)
    |
    v
Chiffrement AES-256-GCM
    - IV aléatoire (16 octets) à chaque écriture
    - Tag d'authentification (16 octets) pour l'intégrité
    - Stockage en JSON : { iv, tag, data }
```

Les jetons ne sont jamais écrits en clair sur le disque.

</details>

## Prérequis

- Node.js 18 ou plus
- Un projet Google Cloud avec l'API YouTube Data v3 activée
- Des identifiants OAuth 2.0 de type « Application de bureau »

## Installation

### 1. Créer les identifiants Google

1. Ouvrir la [console Google Cloud](https://console.cloud.google.com/apis/credentials)
2. Créer un projet ou en choisir un existant
3. Activer l'**API YouTube Data v3** dans la [bibliothèque d'API](https://console.cloud.google.com/apis/library/youtube.googleapis.com)
4. Aller dans **Identifiants** > **Créer des identifiants** > **ID client OAuth 2.0**
5. Type d'application : **Application de bureau**
6. Noter le `Client ID` et le `Client Secret`

### 2. Installer ClaudeTube

```bash
git clone https://github.com/fmenguy/ClaudeTube.git
cd ClaudeTube
npm install
npm run build
```

Le point d'entrée compilé est `dist/index.js`.

### 3. Déclarer le serveur dans Claude

#### Option A : Claude Code (CLI, VS Code, JetBrains)

Créer un fichier `.mcp.json` à la racine du projet :

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

Ce fichier contient un secret : l'ajouter au `.gitignore` (c'est déjà le cas dans ce dépôt).

#### Option B : Claude Desktop

Ajouter le même bloc `mcpServers` dans le fichier `claude_desktop_config.json`.

### 4. Se connecter

Après le redémarrage de Claude, il suffit de demander :

> « Connecte-toi à mon compte YouTube »

Claude appelle `auth`, qui renvoie une URL d'autorisation Google. Une fois l'accès accordé dans le navigateur, le code obtenu est passé à `auth_callback`. Les jetons sont alors chiffrés et enregistrés en local, puis rechargés et rafraîchis automatiquement aux démarrages suivants.

> [!NOTE]
> L'URI de redirection par défaut, `urn:ietf:wg:oauth:2.0:oob` (flux « hors bande »), a été retirée par Google pour les nouveaux identifiants. Si l'URL d'autorisation est refusée, renseigner `YOUTUBE_REDIRECT_URI` avec une adresse de boucle locale (par exemple `http://localhost`), puis copier la valeur du paramètre `code` de l'adresse sur laquelle le navigateur est renvoyé. Ce point n'a pas été retesté depuis l'archivage.

## Variables d'environnement

| Variable | Requise | Rôle |
|----------|---------|------|
| `YOUTUBE_CLIENT_ID` | Oui | Client ID OAuth 2.0 Google |
| `YOUTUBE_CLIENT_SECRET` | Oui | Client Secret OAuth 2.0 Google |
| `YOUTUBE_REDIRECT_URI` | Non | URI de redirection OAuth (par défaut : `urn:ietf:wg:oauth:2.0:oob`) |
| `CLAUDETUBE_TOKEN_PATH` | Non | Emplacement du fichier de jetons chiffrés (par défaut : `~/.claudetube/tokens.enc`) |
| `CLAUDETUBE_ENCRYPTION_KEY` | Non | Clé de chiffrement des jetons (fortement conseillée, voir « Sécurité ») |

Sans `YOUTUBE_CLIENT_ID` ni `YOUTUBE_CLIENT_SECRET`, le serveur démarre quand même, mais `auth` répond par un message d'erreur qui indique les variables manquantes.

## Exemples d'utilisation

```
« Liste mes 5 dernières vidéos »
→ list_my_videos(maxResults: 5)

« Mets la vidéo dQw4w9WgXcQ en non répertorié »
→ update_video(videoId: "dQw4w9WgXcQ", privacyStatus: "unlisted")

« Crée une playlist "Best of 2024" et ajoute-y ces 3 vidéos »
→ create_playlist + add_to_playlist x3

« Réponds "Merci !" aux 5 derniers commentaires de ma vidéo »
→ list_comments + reply_to_comment x5

« Quels sous-titres sont disponibles sur ma dernière vidéo ? »
→ list_my_videos(maxResults: 1) + list_captions
```

## Développement

```bash
npm run dev     # exécute directement les sources avec tsx
npm run build   # compile TypeScript vers dist/
npm start       # lance le serveur compilé
```

## Structure du projet

```
src/
├── index.ts              Point d'entrée MCP, outils d'authentification, enregistrement des autres outils
├── auth/
│   └── oauth.ts          Flux OAuth 2.0, chiffrement et stockage des jetons
├── tools/
│   ├── videos.ts         Vidéos (liste, détail, modification, suppression, note)
│   ├── playlists.ts      Playlists et leurs éléments
│   ├── comments.ts       Commentaires et modération
│   ├── channel.ts        Informations et modification de la chaîne
│   ├── captions.ts       Sous-titres (liste, téléchargement, suppression)
│   └── search.ts         Recherche YouTube
└── utils/
    ├── errors.ts         Traduction des erreurs de l'API en messages lisibles
    └── validation.ts     Validation des identifiants et nettoyage des textes
```

Le fichier [ARCHITECTURE.md](ARCHITECTURE.md) (en français) explique pas à pas la construction du serveur, pour qui veut écrire son propre serveur MCP.

## Licence

MIT, voir [LICENSE](LICENSE).

Auteur : François Menguy, [fmenguy.fr](https://fmenguy.fr).

---

<a id="english"></a>

<div align="center">

# ClaudeTube (English)

🇬🇧 English · 🇫🇷 [Français](#claudetube)

**An MCP server that connects Claude to a YouTube account.**

</div>

> [!WARNING]
> **Archived project.** ClaudeTube is no longer maintained. The code stays online, read only, for anyone who wants to study or fork it: no fixes or new features are planned, and dependencies are no longer updated.

ClaudeTube is a local MCP server that connects Claude to the YouTube Data API v3 through OAuth 2.0. It exposes 27 tools to manage your videos, playlists, comments, captions and channel from a conversation, without opening YouTube Studio.

It was written to run the [Descloizite](https://www.youtube.com/@Descloizite) gaming channel. The background and design choices are covered in a (French) blog post: [ClaudeTube : mon propre serveur MCP pour piloter YouTube depuis Claude](https://fmenguy.fr/blog/claudetube-mcp-youtube/).

## Tech stack

| Component | Technology |
|-----------|------------|
| Runtime | Node.js 18 or later |
| Language | TypeScript (strict mode) |
| Protocol | Model Context Protocol, via `@modelcontextprotocol/sdk`, stdio transport |
| API | YouTube Data API v3, via `googleapis` |
| Authentication | OAuth 2.0 with automatic token refresh |
| Encryption | AES-256-GCM for tokens stored on disk |
| Validation | Zod (parameter schema for each tool) |

## Available tools (27)

Tool descriptions and messages returned by the server are in French.

### Authentication

| Tool | Description |
|------|-------------|
| `auth` | Generates the OAuth 2.0 authorization URL |
| `auth_callback` | Completes the connection with the authorization code |
| `auth_status` | Tells whether you are connected and shows the linked channel |
| `auth_revoke` | Deletes the locally stored tokens (confirmation required). It does not revoke the grant on Google's side |

### Videos

| Tool | Description |
|------|-------------|
| `list_my_videos` | Lists your channel's videos (title, stats, status), sorted by date, rating, views or title |
| `get_video` | Full video details (metadata, stats, tags) |
| `update_video` | Updates title, description, tags, category, privacy, embedding and the "made for kids" flag |
| `delete_video` | Deletes a video (confirmation required) |
| `rate_video` | Likes, dislikes or removes your rating |

### Playlists

| Tool | Description |
|------|-------------|
| `list_my_playlists` | Lists your playlists |
| `create_playlist` | Creates a playlist |
| `update_playlist` | Updates title, description, privacy |
| `delete_playlist` | Deletes a playlist (confirmation required) |
| `list_playlist_items` | Lists the videos in a playlist |
| `add_to_playlist` | Adds a video to a playlist, optionally at a given position |
| `remove_from_playlist` | Removes an item from a playlist (takes the playlist item ID from `list_playlist_items`, not the video ID) |

### Comments

| Tool | Description |
|------|-------------|
| `list_comments` | Lists comments on a video, by relevance or by date |
| `post_comment` | Posts a comment on a video |
| `reply_to_comment` | Replies to an existing comment |
| `delete_comment` | Deletes a comment (confirmation required) |
| `moderate_comment` | Sets a comment to published, held for review or rejected, optionally banning its author |

### Channel

| Tool | Description |
|------|-------------|
| `get_my_channel` | Channel information (stats, description, branding) |
| `update_my_channel` | Updates description, keywords, default language, country |

### Captions

| Tool | Description |
|------|-------------|
| `list_captions` | Lists the caption tracks of a video |
| `download_caption` | Downloads a track as SRT (default), SBV or VTT |
| `delete_caption` | Deletes a track (confirmation required) |

### Search

| Tool | Description |
|------|-------------|
| `search_youtube` | Searches videos, channels or playlists, with sorting and filters by channel and publication date |

## Security

| Measure | Detail |
|---------|--------|
| **OAuth 2.0** | Google's standard protocol. Your account password is never handled. |
| **Encrypted tokens** | Tokens are encrypted with AES-256-GCM, using a random IV on every write and an authentication tag that detects any tampering with the file. |
| **Local execution** | The server runs on your machine. Data only flows between that machine and Google's API. |
| **Explicit confirmation** | `delete_video`, `delete_playlist`, `delete_comment`, `delete_caption` and `auth_revoke` do nothing unless `confirm: true` is passed. |
| **Input validation** | Video IDs (and, depending on the tool, playlist or comment IDs) are checked against a regular expression before calling the API. Titles, descriptions and comments are stripped of control characters. |
| **File permissions** | The token directory is created with `0700` and the token file with `0600` (effective on Unix-like systems, ignored on Windows). |

Two limits worth knowing:

- **Default encryption key.** Without `CLAUDETUBE_ENCRYPTION_KEY`, the key is derived from the path of your home directory, which is predictable. Encryption then guards against accidental reads, not against an attacker who can read the file. Set this variable for real protection.
- **OAuth scopes.** Three scopes are requested: `youtube`, `youtube.force-ssl` and `youtube.upload`. The last one is not used by any tool, since video upload is not implemented.

<details>
<summary><strong>Encryption scheme</strong></summary>

```
Key source (CLAUDETUBE_ENCRYPTION_KEY, otherwise a string derived from the home directory)
    |
    v
SHA-256 → AES-256 key (32 bytes)
    |
    v
AES-256-GCM encryption
    - Random IV (16 bytes) on every write
    - Authentication tag (16 bytes) for integrity
    - Stored as JSON: { iv, tag, data }
```

Tokens are never written to disk in plain text.

</details>

## Prerequisites

- Node.js 18 or later
- A Google Cloud project with the YouTube Data API v3 enabled
- OAuth 2.0 credentials of the "Desktop app" type

## Installation

### 1. Create Google credentials

1. Open the [Google Cloud console](https://console.cloud.google.com/apis/credentials)
2. Create a project or pick an existing one
3. Enable the **YouTube Data API v3** in the [API library](https://console.cloud.google.com/apis/library/youtube.googleapis.com)
4. Go to **Credentials** > **Create credentials** > **OAuth client ID**
5. Application type: **Desktop app**
6. Note the `Client ID` and `Client Secret`

### 2. Install ClaudeTube

```bash
git clone https://github.com/fmenguy/ClaudeTube.git
cd ClaudeTube
npm install
npm run build
```

The compiled entry point is `dist/index.js`.

### 3. Register the server with Claude

#### Option A: Claude Code (CLI, VS Code, JetBrains)

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

This file holds a secret: add it to your `.gitignore` (this repository already does).

#### Option B: Claude Desktop

Add the same `mcpServers` block to your `claude_desktop_config.json` file.

### 4. Connect

After restarting Claude, just ask:

> "Connect to my YouTube account"

Claude calls `auth`, which returns a Google authorization URL. Once you grant access in the browser, the code you get back is passed to `auth_callback`. Tokens are then encrypted and saved locally, and reloaded and refreshed automatically on later starts.

> [!NOTE]
> The default redirect URI, `urn:ietf:wg:oauth:2.0:oob` (the "out-of-band" flow), has been retired by Google for new credentials. If the authorization URL is rejected, set `YOUTUBE_REDIRECT_URI` to a loopback address (for example `http://localhost`), then copy the `code` parameter from the address the browser is sent back to. This has not been retested since the project was archived.

## Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `YOUTUBE_CLIENT_ID` | Yes | Google OAuth 2.0 Client ID |
| `YOUTUBE_CLIENT_SECRET` | Yes | Google OAuth 2.0 Client Secret |
| `YOUTUBE_REDIRECT_URI` | No | OAuth redirect URI (default: `urn:ietf:wg:oauth:2.0:oob`) |
| `CLAUDETUBE_TOKEN_PATH` | No | Location of the encrypted token file (default: `~/.claudetube/tokens.enc`) |
| `CLAUDETUBE_ENCRYPTION_KEY` | No | Token encryption key (strongly recommended, see "Security") |

Without `YOUTUBE_CLIENT_ID` and `YOUTUBE_CLIENT_SECRET`, the server still starts, but `auth` answers with an error naming the missing variables.

## Usage examples

```
"List my last 5 videos"
→ list_my_videos(maxResults: 5)

"Set video dQw4w9WgXcQ to unlisted"
→ update_video(videoId: "dQw4w9WgXcQ", privacyStatus: "unlisted")

"Create a playlist called 'Best of 2024' and add these 3 videos"
→ create_playlist + add_to_playlist x3

"Reply 'Thanks!' to the last 5 comments on my video"
→ list_comments + reply_to_comment x5

"Which captions are available on my latest video?"
→ list_my_videos(maxResults: 1) + list_captions
```

## Development

```bash
npm run dev     # runs the sources directly with tsx
npm run build   # compiles TypeScript to dist/
npm start       # starts the compiled server
```

## Project structure

```
src/
├── index.ts              MCP entry point, authentication tools, registration of the other tools
├── auth/
│   └── oauth.ts          OAuth 2.0 flow, token encryption and storage
├── tools/
│   ├── videos.ts         Videos (list, details, update, delete, rating)
│   ├── playlists.ts      Playlists and their items
│   ├── comments.ts       Comments and moderation
│   ├── channel.ts        Channel information and updates
│   ├── captions.ts       Captions (list, download, delete)
│   └── search.ts         YouTube search
└── utils/
    ├── errors.ts         Turns API errors into readable messages
    └── validation.ts     ID validation and text sanitizing
```

[ARCHITECTURE.md](ARCHITECTURE.md) (in French) walks through how the server is built, step by step, for anyone who wants to write their own MCP server.

## License

MIT, see [LICENSE](LICENSE).

Author: François Menguy, [fmenguy.fr](https://fmenguy.fr).
