# Comment est construit ClaudeTube — Guide pédagogique

Ce document explique pas à pas comment le serveur MCP ClaudeTube est conçu, pour
quelqu'un qui voudrait comprendre le fonctionnement interne ou créer son propre
serveur MCP.

---

## Qu'est-ce qu'un serveur MCP ?

MCP (Model Context Protocol) est un protocole créé par Anthropic pour permettre
à Claude de communiquer avec des outils externes. Le principe est simple :

```
Claude  ←→  Transport stdio  ←→  Serveur MCP  ←→  API externe (YouTube)
```

- **Claude** envoie des requêtes au serveur MCP quand il veut utiliser un outil
- **Le serveur MCP** reçoit la requête, appelle l'API externe, et renvoie le résultat
- **Le transport stdio** est le canal de communication : Claude écrit sur stdin du
  serveur, et lit sur stdout. C'est pour ça que les logs vont sur stderr.

Un serveur MCP, c'est fondamentalement un programme qui :
1. Déclare une liste d'**outils** (nom, description, paramètres attendus)
2. Écoute les requêtes de Claude
3. Exécute l'outil demandé et retourne le résultat

---

## La structure du projet

```
src/
├── index.ts           ← Le chef d'orchestre
├── auth/
│   └── oauth.ts       ← Tout ce qui touche à l'authentification
├── tools/
│   ├── videos.ts      ← Les outils "vidéos"
│   ├── playlists.ts   ← Les outils "playlists"
│   ├── comments.ts    ← Les outils "commentaires"
│   ├── channel.ts     ← Les outils "chaîne"
│   ├── captions.ts    ← Les outils "sous-titres"
│   └── search.ts      ← L'outil "recherche"
└── utils/
    ├── errors.ts      ← Traduction des erreurs API en messages lisibles
    └── validation.ts  ← Vérification des entrées (IDs, textes)
```

Chaque fichier a un rôle précis. Voyons les un par un.

---

## 1. Le point d'entrée : index.ts

C'est le fichier principal. Il fait trois choses dans l'ordre :

### a) Créer le serveur MCP

```typescript
const server = new McpServer({
  name: "ClaudeTube",
  version: "1.0.0",
});
```

Le SDK `@modelcontextprotocol/sdk` fournit la classe `McpServer`. On lui donne
un nom et une version, c'est tout. Le serveur est prêt à recevoir des outils.

### b) Enregistrer les outils

```typescript
registerVideoTools(server, getYouTube);
registerPlaylistTools(server, getYouTube);
registerCommentTools(server, getYouTube);
// ...
```

Chaque module de `tools/` expose une fonction qui enregistre ses outils sur le
serveur. On leur passe aussi `getYouTube`, une fonction qui retourne le client
YouTube authentifié. C'est comme ça que les outils accèdent à l'API.

### c) Démarrer le transport

```typescript
const transport = new StdioServerTransport();
await server.connect(transport);
```

Le serveur écoute maintenant sur stdin/stdout. Quand Claude envoie une requête,
le serveur la reçoit, exécute l'outil, et renvoie le résultat.

---

## 2. Comment on déclare un outil

Voici un exemple simplifié tiré de `tools/search.ts` :

```typescript
server.tool(
  "search_youtube",                              // 1. Nom de l'outil
  "Recherche des vidéos sur YouTube.",           // 2. Description (Claude la lit)
  {                                              // 3. Schéma des paramètres (Zod)
    query: z.string().describe("Termes de recherche"),
    maxResults: z.number().min(1).max(50).default(10),
  },
  async ({ query, maxResults }) => {             // 4. Fonction d'exécution
    const yt = getYouTube();
    const res = await yt.search.list({
      part: ["snippet"],
      q: query,
      maxResults,
    });

    return {
      content: [{
        type: "text",
        text: JSON.stringify(res.data, null, 2),
      }],
    };
  }
);
```

Décortiquons :

1. **Le nom** (`"search_youtube"`) — C'est ce que Claude utilise pour appeler l'outil
2. **La description** — Claude la lit pour décider quel outil utiliser. Elle doit
   être claire et précise. Si tu dis "liste mes vidéos", Claude va chercher un
   outil dont la description mentionne "lister" et "vidéos".
3. **Le schéma Zod** — Définit les paramètres que Claude doit fournir. Zod valide
   automatiquement les types, les contraintes (min, max), et génère les valeurs
   par défaut. Claude voit aussi les `.describe()` pour comprendre chaque paramètre.
4. **La fonction** — C'est le code qui s'exécute quand Claude appelle l'outil.
   Elle reçoit les paramètres validés et doit retourner un objet `{ content: [...] }`.

Le retour est toujours un tableau de contenus. Ici on retourne du texte JSON,
mais on pourrait aussi retourner des images ou d'autres types.

---

## 3. L'authentification OAuth 2.0

C'est la partie la plus complexe. YouTube exige une authentification OAuth 2.0
pour accéder aux données d'un utilisateur. Voici le flow complet :

```
Étape 1 : L'utilisateur dit "connecte-toi à YouTube"
    ↓
Étape 2 : Claude appelle l'outil "auth"
    ↓
Étape 3 : ClaudeTube génère une URL d'autorisation Google
    ↓
Étape 4 : L'utilisateur visite l'URL, autorise l'accès
    ↓
Étape 5 : Google affiche un code d'autorisation
    ↓
Étape 6 : L'utilisateur donne le code à Claude
    ↓
Étape 7 : Claude appelle "auth_callback" avec le code
    ↓
Étape 8 : ClaudeTube échange le code contre des tokens
    ↓
Étape 9 : Les tokens sont chiffrés et sauvegardés
    ↓
Étape 10 : Toutes les requêtes suivantes utilisent ces tokens
```

### Les tokens

Google fournit deux tokens :

- **Access token** : expire après 1 heure. C'est lui qui autorise chaque requête API.
- **Refresh token** : n'expire pas (sauf révocation). Il permet d'obtenir un
  nouvel access token quand l'ancien expire.

ClaudeTube gère le refresh automatiquement. L'utilisateur ne s'authentifie
qu'une seule fois.

### Le chiffrement

Les tokens sont sensibles : quiconque les possède peut agir sur le compte YouTube.
On ne les stocke donc jamais en clair.

Le module `oauth.ts` utilise AES-256-GCM :

```
Texte clair (tokens JSON)
    ↓
Générer un IV aléatoire (16 bytes)
    ↓
Chiffrer avec AES-256-GCM (clé dérivée via SHA-256)
    ↓
Récupérer le tag d'authentification (16 bytes)
    ↓
Stocker { iv, tag, data } dans ~/.claudetube/tokens.enc
```

**AES-256-GCM** est un algorithme de chiffrement authentifié. "Authentifié"
signifie qu'en plus de chiffrer les données, il génère un tag qui prouve que
les données n'ont pas été modifiées. Si quelqu'un altère le fichier, le
déchiffrement échouera.

L'**IV aléatoire** (vecteur d'initialisation) garantit que deux chiffrements
du même contenu donneront des résultats différents. C'est une protection contre
les attaques par analyse de patterns.

---

## 4. La gestion des erreurs

L'API YouTube peut renvoyer beaucoup d'erreurs différentes (quota dépassé,
vidéo introuvable, permissions insuffisantes...). Le module `errors.ts` les
traduit en messages compréhensibles.

```typescript
// Avant (erreur brute de Google) :
{ code: 403, message: "quotaExceeded", errors: [...] }

// Après (erreur formatée par ClaudeTube) :
{
  error: "Trop de requêtes — quota YouTube API dépassé, réessaie plus tard.",
  code: 429,
  details: "quotaExceeded"
}
```

Chaque outil utilise un try/catch qui passe par `formatApiError()`. Claude
reçoit donc un message clair qu'il peut transmettre à l'utilisateur.

---

## 5. La validation des entrées

Avant d'envoyer une requête à l'API, on vérifie que les identifiants sont
valides. Un ID de vidéo YouTube fait toujours 11 caractères alphanumériques.
Un ID de chaîne commence toujours par "UC".

```typescript
// validation.ts
function isValidVideoId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{11}$/.test(id);
}
```

Si l'ID est invalide, on retourne immédiatement une erreur sans appeler l'API.
Ça évite de consommer du quota pour rien et de recevoir des erreurs cryptiques.

Les textes (titres, descriptions, commentaires) sont aussi nettoyés : les
caractères de contrôle sont supprimés pour éviter les injections.

---

## 6. Le cycle de vie complet d'un appel

Quand tu dis à Claude "liste mes vidéos", voici ce qui se passe :

```
1. Claude lit la description de chaque outil disponible
2. Il choisit "list_my_videos" car la description correspond
3. Il détermine les paramètres (maxResults: 10 par défaut)
4. Il envoie la requête au serveur MCP via stdin

5. Le serveur reçoit la requête
6. Zod valide les paramètres
7. getYouTube() retourne le client authentifié
8. Le client appelle l'API YouTube (channels.list + playlistItems.list + videos.list)
9. Les résultats sont formatés en JSON
10. Le serveur renvoie la réponse via stdout

11. Claude reçoit le JSON
12. Il le reformule en langage naturel pour toi
```

Tout ça se passe en quelques secondes.

---

## Comment créer son propre serveur MCP

Si tu veux créer un serveur MCP pour une autre API, voici le squelette minimal :

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({ name: "MonServeur", version: "1.0.0" });

// Déclarer un outil
server.tool(
  "mon_outil",
  "Description de ce que fait l'outil",
  {
    param1: z.string().describe("Description du paramètre"),
  },
  async ({ param1 }) => {
    // Appeler ton API ici
    const result = await monApi.faireTruc(param1);

    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
    };
  }
);

// Démarrer
const transport = new StdioServerTransport();
await server.connect(transport);
```

Les dépendances nécessaires :
- `@modelcontextprotocol/sdk` — Le SDK MCP
- `zod` — La validation des paramètres
- Le client de ton API (ici `googleapis` pour YouTube)

La configuration dans `.mcp.json` ou `claude_desktop_config.json` indique à
Claude comment lancer ton serveur (commande, arguments, variables d'environnement).

---

## Résumé

| Concept | Rôle dans ClaudeTube |
|---------|---------------------|
| **McpServer** | Reçoit les requêtes de Claude et dispatch vers les outils |
| **server.tool()** | Déclare un outil avec nom, description, schéma et fonction |
| **StdioServerTransport** | Canal de communication stdin/stdout avec Claude |
| **Zod** | Valide les paramètres avant exécution |
| **OAuth 2.0** | Authentifie l'utilisateur auprès de Google |
| **AES-256-GCM** | Chiffre les tokens sur le disque |
| **googleapis** | Client officiel Google pour appeler YouTube Data API v3 |

Le tout fait environ 1500 lignes de TypeScript, réparties en modules spécialisés.
Chaque module est indépendant : on peut ajouter un nouveau domaine (analytics,
thumbnails...) en créant simplement un nouveau fichier dans `tools/` et en
l'enregistrant dans `index.ts`.
