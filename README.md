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
| Authentification | OAuth 2.0 (PKCE, retour sur un serveur local éphémère) avec rafraîchissement automatique du jeton |
| Chiffrement | AES-256-GCM pour les jetons stockés sur le disque |
| Validation | Zod (schémas des paramètres de chaque outil) |

## Outils disponibles (27)

### Authentification

| Outil | Description |
|-------|-------------|
| `auth` | Génère l'URL d'autorisation OAuth 2.0 et ouvre un serveur local éphémère qui récupère le code tout seul |
| `auth_callback` | Finalise la connexion à la main, avec l'adresse de retour ou le code d'autorisation (retour automatique non abouti, ou `YOUTUBE_REDIRECT_URI` définie) |
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
| **Portée minimale** | Une seule portée OAuth est demandée, `youtube.force-ssl` (détail ci-dessous). |
| **PKCE et state** | L'autorisation utilise PKCE (méthode S256) et un paramètre `state` aléatoire, vérifié au retour du navigateur. |
| **Clé aléatoire** | Sans `CLAUDETUBE_ENCRYPTION_KEY`, la clé de chiffrement est tirée au hasard (32 octets) et rangée dans `encryption.key`, à côté du fichier de jetons. |
| **Permissions des fichiers** | Le dossier des jetons est créé en `0700`, le fichier de jetons et `encryption.key` en `0600` (effectif sur les systèmes de type Unix ; sous Windows, la protection repose sur les droits du dossier personnel). |

**Portée OAuth.** Le serveur ne demande que `https://www.googleapis.com/auth/youtube.force-ssl`, que Google présente comme « voir, modifier et supprimer définitivement vos vidéos, notes, commentaires et sous-titres YouTube ». C'est la seule portée qu'acceptent les méthodes de l'API pour les commentaires et les sous-titres, et elle couvre aussi tous les autres appels du serveur. Les portées `youtube` et `youtube.upload`, demandées par les versions précédentes, ont été retirées : la première faisait doublon, la seconde ne servait à rien puisqu'aucun outil n'envoie de vidéo. Une autorisation accordée avec les anciennes portées continue de fonctionner ; pour la réduire, retirer l'accès de l'application sur [la page des autorisations du compte Google](https://myaccount.google.com/permissions), appeler `auth_revoke`, puis se reconnecter.

<details>
<summary><strong>Portées acceptées par chaque appel</strong></summary>

| Outils | Appels de l'API | Portées acceptées par l'API |
|--------|-----------------|-----------------------------|
| Authentification, chaîne | `channels.list`, `channels.update` | `youtube`, `youtube.force-ssl` (lecture : aussi `youtube.readonly`) |
| Vidéos | `videos.list`, `videos.update`, `videos.delete`, `videos.rate`, `channels.list`, `playlistItems.list` | `youtube`, `youtube.force-ssl` (lecture : aussi `youtube.readonly`) |
| Playlists | `playlists.*`, `playlistItems.*` | `youtube`, `youtube.force-ssl` (lecture : aussi `youtube.readonly`) |
| Recherche | `search.list` | `youtube`, `youtube.force-ssl`, `youtube.readonly` |
| Commentaires | `commentThreads.list`, `commentThreads.insert`, `comments.insert`, `comments.delete`, `comments.setModerationStatus` | `youtube.force-ssl` uniquement |
| Sous-titres | `captions.list`, `captions.download`, `captions.delete` | `youtube.force-ssl` (ou `youtubepartner`, réservée aux partenaires YouTube) |

`youtube.force-ssl` figure sur chaque ligne : c'est la portée minimale qui couvre les 27 outils.

</details>

**Clé de chiffrement.** La clé vient de `CLAUDETUBE_ENCRYPTION_KEY` si cette variable est définie (son empreinte SHA-256), sinon du fichier `encryption.key` : 32 octets aléatoires encodés en base64, créés au premier enregistrement des jetons dans le même dossier que `tokens.enc`, sans jamais écraser un fichier existant. Qui lit à la fois `tokens.enc` et `encryption.key` peut déchiffrer les jetons : par défaut, le chiffrement protège surtout d'une copie isolée du fichier de jetons. Pour tenir la clé hors du dossier des jetons, définir `CLAUDETUBE_ENCRYPTION_KEY` dans la configuration du client MCP.

**Migration.** Les versions précédentes dérivaient la clé par défaut du chemin du dossier personnel, donc prévisible. Au démarrage, des jetons chiffrés avec cette ancienne clé sont relus, puis rechiffrés avec la clé actuelle, sans nouvelle connexion. De même, des jetons chiffrés avec `encryption.key` sont rechiffrés si `CLAUDETUBE_ENCRYPTION_KEY` est définie par la suite. Supprimer `encryption.key` (sans définir la variable) rend les jetons illisibles : il faut alors se reconnecter.

<details>
<summary><strong>Schéma du chiffrement</strong></summary>

```
Clé AES-256 (32 octets)
    1. CLAUDETUBE_ENCRYPTION_KEY définie : SHA-256 de sa valeur
    2. sinon : contenu de encryption.key (aléatoire, créé au besoin, 0600)
    |
    v
Chiffrement AES-256-GCM
    - IV aléatoire (16 octets) à chaque écriture
    - Tag d'authentification (16 octets) pour l'intégrité
    - Stockage en JSON : { iv, tag, data }
    - Écriture dans un fichier temporaire, puis renommage en tokens.enc
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

Claude appelle `auth`, qui renvoie une URL d'autorisation Google et ouvre en même temps un petit serveur HTTP sur `127.0.0.1`, sur un port libre choisi par le système. Ensuite :

1. Ouvrir l'URL dans un navigateur de la machine où tourne le serveur MCP, choisir le compte Google (et la chaîne), puis accepter. Si l'écran de consentement OAuth du projet est en mode « Test », le compte doit figurer dans ses utilisateurs test, et Google affiche un avertissement d'application non validée, qu'on passe avec **Continuer**.
2. Google renvoie le navigateur vers `http://127.0.0.1:<port>/?state=...&code=...`. ClaudeTube vérifie le paramètre `state`, échange le code (avec le vérificateur PKCE), chiffre et enregistre les jetons, puis affiche « ClaudeTube est connecté ».
3. Fermer l'onglet. `auth_status` confirme la connexion.

Aucune URI de redirection n'est à déclarer dans la console Google : un client « Application de bureau » accepte les adresses de boucle locale sur n'importe quel port. Le serveur local n'écoute que sur `127.0.0.1` et se ferme dès que le retour est traité, au plus tard au bout de 10 minutes.

**Si la page de retour ne s'affiche pas** (serveur MCP sur une autre machine ou dans un conteneur, délai de 10 minutes dépassé) : copier l'adresse complète de la barre du navigateur, même sur une page d'erreur, et la donner à Claude, qui la passe à `auth_callback`. La seule valeur du paramètre `code` est aussi acceptée. Le faire avant de relancer `auth` ou de redémarrer le serveur : chaque autorisation a son propre vérificateur PKCE.

**Redirection personnalisée.** Si `YOUTUBE_REDIRECT_URI` est définie (par exemple `http://localhost`), aucun serveur local n'est lancé. Après l'accord, le navigateur arrive sur cette adresse, souvent une page « site inaccessible », ce qui est normal : copier l'adresse complète de la barre du navigateur et la passer à `auth_callback`. L'adresse doit être acceptée par le client OAuth : n'importe quelle adresse de boucle locale pour un client « Application de bureau », une URI déclarée dans la console pour un client « Application Web ».

Les jetons sont chiffrés et enregistrés en local, puis rechargés et rafraîchis automatiquement aux démarrages suivants.

## Variables d'environnement

| Variable | Requise | Rôle |
|----------|---------|------|
| `YOUTUBE_CLIENT_ID` | Oui | Client ID OAuth 2.0 Google |
| `YOUTUBE_CLIENT_SECRET` | Oui | Client Secret OAuth 2.0 Google |
| `YOUTUBE_REDIRECT_URI` | Non | URI de redirection OAuth. Par défaut, serveur local éphémère sur `http://127.0.0.1:<port libre>` qui récupère le code tout seul ; si elle est définie, l'adresse de retour se recopie dans `auth_callback` (voir « Se connecter ») |
| `CLAUDETUBE_TOKEN_PATH` | Non | Emplacement du fichier de jetons chiffrés (par défaut : `~/.claudetube/tokens.enc`). `encryption.key` est rangée dans le même dossier |
| `CLAUDETUBE_ENCRYPTION_KEY` | Non | Phrase secrète dont dérive la clé de chiffrement des jetons. Par défaut, clé aléatoire stockée dans `encryption.key` (voir « Sécurité ») |

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
| Authentication | OAuth 2.0 (PKCE, redirect to a short-lived local server) with automatic token refresh |
| Encryption | AES-256-GCM for tokens stored on disk |
| Validation | Zod (parameter schema for each tool) |

## Available tools (27)

Tool descriptions and messages returned by the server are in French.

### Authentication

| Tool | Description |
|------|-------------|
| `auth` | Generates the OAuth 2.0 authorization URL and starts a short-lived local server that picks up the code on its own |
| `auth_callback` | Completes the connection by hand, with the redirect address or the authorization code (automatic redirect failed, or `YOUTUBE_REDIRECT_URI` is set) |
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
| **Minimal scope** | A single OAuth scope is requested, `youtube.force-ssl` (details below). |
| **PKCE and state** | Authorization uses PKCE (S256 method) and a random `state` parameter, checked when the browser comes back. |
| **Random key** | Without `CLAUDETUBE_ENCRYPTION_KEY`, the encryption key is drawn at random (32 bytes) and kept in `encryption.key`, next to the token file. |
| **File permissions** | The token directory is created with `0700`, the token file and `encryption.key` with `0600` (effective on Unix-like systems; on Windows, protection relies on the permissions of your user profile folder). |

**OAuth scope.** The server only requests `https://www.googleapis.com/auth/youtube.force-ssl`, which Google describes as "see, edit, and permanently delete your YouTube videos, ratings, comments and captions". It is the only scope the API accepts for the comment and caption methods, and it also covers every other call the server makes. The `youtube` and `youtube.upload` scopes, requested by earlier versions, have been removed: the first was redundant, the second was useless since no tool uploads videos. A grant given with the old scopes keeps working; to shrink it, remove the app's access on [your Google Account permissions page](https://myaccount.google.com/permissions), call `auth_revoke`, then connect again.

<details>
<summary><strong>Scopes accepted by each call</strong></summary>

| Tools | API calls | Scopes accepted by the API |
|-------|-----------|----------------------------|
| Authentication, channel | `channels.list`, `channels.update` | `youtube`, `youtube.force-ssl` (reads: also `youtube.readonly`) |
| Videos | `videos.list`, `videos.update`, `videos.delete`, `videos.rate`, `channels.list`, `playlistItems.list` | `youtube`, `youtube.force-ssl` (reads: also `youtube.readonly`) |
| Playlists | `playlists.*`, `playlistItems.*` | `youtube`, `youtube.force-ssl` (reads: also `youtube.readonly`) |
| Search | `search.list` | `youtube`, `youtube.force-ssl`, `youtube.readonly` |
| Comments | `commentThreads.list`, `commentThreads.insert`, `comments.insert`, `comments.delete`, `comments.setModerationStatus` | `youtube.force-ssl` only |
| Captions | `captions.list`, `captions.download`, `captions.delete` | `youtube.force-ssl` (or `youtubepartner`, reserved for YouTube partners) |

`youtube.force-ssl` appears on every row: it is the minimal scope that covers all 27 tools.

</details>

**Encryption key.** The key comes from `CLAUDETUBE_ENCRYPTION_KEY` when that variable is set (its SHA-256 digest), otherwise from the `encryption.key` file: 32 random bytes, base64-encoded, created the first time tokens are saved, in the same folder as `tokens.enc`, and never overwritten. Anyone who can read both `tokens.enc` and `encryption.key` can decrypt the tokens: by default, encryption mainly protects a copy of the token file on its own. To keep the key out of the token folder, set `CLAUDETUBE_ENCRYPTION_KEY` in your MCP client configuration.

**Migration.** Earlier versions derived the default key from the path of your home directory, which is predictable. On startup, tokens encrypted with that old key are read, then encrypted again with the current key, with no need to reconnect. Likewise, tokens encrypted with `encryption.key` are encrypted again if `CLAUDETUBE_ENCRYPTION_KEY` is set later. Deleting `encryption.key` (without setting the variable) makes the tokens unreadable: you then have to connect again.

<details>
<summary><strong>Encryption scheme</strong></summary>

```
AES-256 key (32 bytes)
    1. CLAUDETUBE_ENCRYPTION_KEY set: SHA-256 of its value
    2. otherwise: contents of encryption.key (random, created when needed, 0600)
    |
    v
AES-256-GCM encryption
    - Random IV (16 bytes) on every write
    - Authentication tag (16 bytes) for integrity
    - Stored as JSON: { iv, tag, data }
    - Written to a temporary file, then renamed to tokens.enc
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

Claude calls `auth`, which returns a Google authorization URL and at the same time starts a small HTTP server on `127.0.0.1`, on a free port picked by the system. Then:

1. Open the URL in a browser on the machine running the MCP server, pick the Google account (and channel), then accept. If the project's OAuth consent screen is in "Testing" mode, the account must be listed among its test users, and Google shows an unverified app warning, which you get past with **Continue**.
2. Google sends the browser back to `http://127.0.0.1:<port>/?state=...&code=...`. ClaudeTube checks the `state` parameter, exchanges the code (with the PKCE verifier), encrypts and saves the tokens, then shows "ClaudeTube est connecté".
3. Close the tab. `auth_status` confirms the connection.

There is no redirect URI to register in the Google console: a "Desktop app" client accepts loopback addresses on any port. The local server only listens on `127.0.0.1` and shuts down as soon as the redirect is handled, after 10 minutes at the latest.

**If the redirect page does not show up** (MCP server on another machine or in a container, 10 minute window exceeded): copy the full address from the browser's address bar, even on an error page, and give it to Claude, which passes it to `auth_callback`. The bare value of the `code` parameter is accepted too. Do it before calling `auth` again or restarting the server: each authorization has its own PKCE verifier.

**Custom redirect.** If `YOUTUBE_REDIRECT_URI` is set (for example `http://localhost`), no local server is started. After you accept, the browser lands on that address, often a "site can't be reached" page, which is expected: copy the full address from the address bar and pass it to `auth_callback`. The address must be accepted by the OAuth client: any loopback address for a "Desktop app" client, a URI registered in the console for a "Web application" client.

Tokens are encrypted and saved locally, and reloaded and refreshed automatically on later starts.

## Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `YOUTUBE_CLIENT_ID` | Yes | Google OAuth 2.0 Client ID |
| `YOUTUBE_CLIENT_SECRET` | Yes | Google OAuth 2.0 Client Secret |
| `YOUTUBE_REDIRECT_URI` | No | OAuth redirect URI. By default, a short-lived local server on `http://127.0.0.1:<free port>` picks up the code on its own; when set, you copy the redirect address into `auth_callback` (see "Connect") |
| `CLAUDETUBE_TOKEN_PATH` | No | Location of the encrypted token file (default: `~/.claudetube/tokens.enc`). `encryption.key` lives in the same folder |
| `CLAUDETUBE_ENCRYPTION_KEY` | No | Passphrase the token encryption key is derived from. By default, a random key stored in `encryption.key` (see "Security") |

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
