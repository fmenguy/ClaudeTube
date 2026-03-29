# 🎬 ClaudeTube

**Serveur MCP pour connecter Claude à ton compte YouTube.**

Gère tes vidéos, playlists, commentaires, sous-titres et ta chaîne directement depuis Claude. Conçu pour les créateurs YouTube qui veulent automatiser et piloter leur chaîne avec l'IA.

> 🔒 **Sécurité avant tout** — Authentification OAuth 2.0, tokens chiffrés AES-256-GCM, aucun secret en dur, permissions minimales.

---

[🇫🇷 Français](#-installation) | [🇬🇧 English](#-english)

---

## 📋 Fonctionnalités

| Catégorie | Outils | Description |
|-----------|--------|-------------|
| 🔐 Auth | `auth`, `auth_callback`, `auth_status`, `auth_revoke` | Connexion OAuth 2.0 sécurisée |
| 🎥 Vidéos | `list_my_videos`, `get_video`, `update_video`, `delete_video`, `rate_video` | CRUD complet sur tes vidéos |
| 📁 Playlists | `list_my_playlists`, `create_playlist`, `update_playlist`, `delete_playlist`, `list_playlist_items`, `add_to_playlist`, `remove_from_playlist` | Gestion complète des playlists |
| 💬 Commentaires | `list_comments`, `post_comment`, `reply_to_comment`, `delete_comment`, `moderate_comment` | Lecture, réponse et modération |
| 📺 Chaîne | `get_my_channel`, `update_my_channel` | Infos et modification de ta chaîne |
| 📝 Sous-titres | `list_captions`, `download_caption`, `delete_caption` | Gestion des sous-titres |
| 🔍 Recherche | `search_youtube` | Recherche vidéos, chaînes, playlists |

## 🚀 Installation

### Prérequis

- **Node.js** 18+
- Un projet **Google Cloud** avec l'API YouTube Data v3 activée
- Des identifiants **OAuth 2.0** (type "Application de bureau")

### 1. Créer les identifiants Google

1. Va sur [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Crée un projet (ou utilise un existant)
3. Active l'**API YouTube Data v3** dans la [bibliothèque d'API](https://console.cloud.google.com/apis/library/youtube.googleapis.com)
4. Dans **Identifiants** → **Créer des identifiants** → **ID client OAuth 2.0**
5. Type d'application : **Application de bureau**
6. Note le `Client ID` et le `Client Secret`

### 2. Installer ClaudeTube

```bash
git clone https://github.com/ton-user/ClaudeTube.git
cd ClaudeTube
npm install
npm run build
```

### 3. Configurer Claude Desktop

Ajoute dans ton fichier de configuration Claude Desktop (`claude_desktop_config.json`) :

```json
{
  "mcpServers": {
    "claudetube": {
      "command": "node",
      "args": ["/chemin/vers/ClaudeTube/dist/index.js"],
      "env": {
        "YOUTUBE_CLIENT_ID": "ton-client-id.apps.googleusercontent.com",
        "YOUTUBE_CLIENT_SECRET": "ton-client-secret"
      }
    }
  }
}
```

### 4. Se connecter

Une fois Claude Desktop redémarré, demande simplement :

> « Connecte-toi à mon compte YouTube »

Claude utilisera l'outil `auth` pour générer un lien d'autorisation, puis `auth_callback` pour finaliser la connexion. **Les tokens sont chiffrés et stockés localement.**

## 🔒 Sécurité

ClaudeTube prend la sécurité au sérieux :

- **OAuth 2.0** — Protocole standard de l'industrie. Aucun mot de passe YouTube n'est jamais manipulé.
- **Chiffrement AES-256-GCM** — Les tokens d'accès sont chiffrés au repos sur ton disque.
- **Permissions minimales** — Seuls les scopes YouTube strictement nécessaires sont demandés.
- **Aucun serveur distant** — Tout tourne en local sur ta machine. Tes données ne transitent qu'entre toi et l'API Google.
- **Confirmation obligatoire** — Les actions destructives (suppression) exigent un paramètre `confirm: true`.
- **Validation des entrées** — Tous les identifiants et textes sont validés/sanitisés avant envoi à l'API.

## ⚙️ Variables d'environnement

| Variable | Requis | Description |
|----------|--------|-------------|
| `YOUTUBE_CLIENT_ID` | ✅ | Client ID OAuth Google |
| `YOUTUBE_CLIENT_SECRET` | ✅ | Client Secret OAuth Google |
| `YOUTUBE_REDIRECT_URI` | ❌ | URI de redirection (défaut: `urn:ietf:wg:oauth:2.0:oob`) |
| `CLAUDETUBE_TOKEN_PATH` | ❌ | Chemin de stockage des tokens (défaut: `~/.claudetube/tokens.enc`) |
| `CLAUDETUBE_ENCRYPTION_KEY` | ❌ | Clé de chiffrement personnalisée pour les tokens |

## 📖 Exemples d'utilisation

```
Toi : « Liste mes 5 dernières vidéos »
Claude utilise → list_my_videos(maxResults: 5)

Toi : « Mets la vidéo dQw4w9WgXcQ en non-répertorié »
Claude utilise → update_video(videoId: "dQw4w9WgXcQ", privacyStatus: "unlisted")

Toi : « Crée une playlist "Best of 2024" et ajoutes-y ces 3 vidéos »
Claude utilise → create_playlist + add_to_playlist × 3

Toi : « Réponds "Merci !" aux 5 derniers commentaires sur ma vidéo »
Claude utilise → list_comments + reply_to_comment × 5

Toi : « Quels sous-titres sont disponibles sur ma dernière vidéo ? »
Claude utilise → list_my_videos(maxResults: 1) + list_captions
```

---

# 🇬🇧 English

# 🎬 ClaudeTube

**MCP Server to connect Claude to your YouTube account.**

Manage your videos, playlists, comments, captions, and channel directly from Claude. Built for YouTube creators who want to automate and control their channel with AI.

> 🔒 **Security first** — OAuth 2.0 authentication, AES-256-GCM encrypted tokens, no hardcoded secrets, minimal permissions.

## 📋 Features

| Category | Tools | Description |
|----------|-------|-------------|
| 🔐 Auth | `auth`, `auth_callback`, `auth_status`, `auth_revoke` | Secure OAuth 2.0 connection |
| 🎥 Videos | `list_my_videos`, `get_video`, `update_video`, `delete_video`, `rate_video` | Full CRUD on your videos |
| 📁 Playlists | `list_my_playlists`, `create_playlist`, `update_playlist`, `delete_playlist`, `list_playlist_items`, `add_to_playlist`, `remove_from_playlist` | Complete playlist management |
| 💬 Comments | `list_comments`, `post_comment`, `reply_to_comment`, `delete_comment`, `moderate_comment` | Read, reply & moderate |
| 📺 Channel | `get_my_channel`, `update_my_channel` | View and update channel info |
| 📝 Captions | `list_captions`, `download_caption`, `delete_caption` | Caption management |
| 🔍 Search | `search_youtube` | Search videos, channels, playlists |

## 🚀 Installation

### Prerequisites

- **Node.js** 18+
- A **Google Cloud** project with YouTube Data API v3 enabled
- **OAuth 2.0** credentials (Desktop application type)

### 1. Create Google credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a project (or use an existing one)
3. Enable **YouTube Data API v3** in the [API library](https://console.cloud.google.com/apis/library/youtube.googleapis.com)
4. Under **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
5. Application type: **Desktop application**
6. Note down the `Client ID` and `Client Secret`

### 2. Install ClaudeTube

```bash
git clone https://github.com/your-user/ClaudeTube.git
cd ClaudeTube
npm install
npm run build
```

### 3. Configure Claude Desktop

Add to your Claude Desktop config file (`claude_desktop_config.json`):

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

Once Claude Desktop is restarted, simply ask:

> "Connect to my YouTube account"

Claude will use the `auth` tool to generate an authorization link, then `auth_callback` to complete the connection. **Tokens are encrypted and stored locally.**

## 🔒 Security

ClaudeTube takes security seriously:

- **OAuth 2.0** — Industry-standard protocol. Your YouTube password is never handled.
- **AES-256-GCM encryption** — Access tokens are encrypted at rest on your disk.
- **Minimal permissions** — Only strictly necessary YouTube scopes are requested.
- **No remote server** — Everything runs locally on your machine. Your data only flows between you and Google's API.
- **Required confirmation** — Destructive actions (deletion) require a `confirm: true` parameter.
- **Input validation** — All identifiers and text inputs are validated/sanitized before API calls.

## ⚙️ Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `YOUTUBE_CLIENT_ID` | ✅ | Google OAuth Client ID |
| `YOUTUBE_CLIENT_SECRET` | ✅ | Google OAuth Client Secret |
| `YOUTUBE_REDIRECT_URI` | ❌ | Redirect URI (default: `urn:ietf:wg:oauth:2.0:oob`) |
| `CLAUDETUBE_TOKEN_PATH` | ❌ | Token storage path (default: `~/.claudetube/tokens.enc`) |
| `CLAUDETUBE_ENCRYPTION_KEY` | ❌ | Custom encryption key for tokens |

## 📖 Usage Examples

```
You: "List my last 5 videos"
Claude uses → list_my_videos(maxResults: 5)

You: "Set video dQw4w9WgXcQ to unlisted"
Claude uses → update_video(videoId: "dQw4w9WgXcQ", privacyStatus: "unlisted")

You: "Create a playlist 'Best of 2024' and add these 3 videos"
Claude uses → create_playlist + add_to_playlist × 3

You: "Reply 'Thanks!' to the last 5 comments on my video"
Claude uses → list_comments + reply_to_comment × 5
```

---

## 📄 License

MIT — voir [LICENSE](LICENSE)

---

**Fait avec ❤️ pour les créateurs YouTube**
