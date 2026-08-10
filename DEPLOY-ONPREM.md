# Déploiement e-depot sur un serveur interne MEDLOG (on-premise)

Objectif : héberger l'**API e-depot** sur un serveur MEDLOG (au lieu de Render) pour
lever le blocage SMTP sortant de Render et permettre l'envoi des **SMS via la passerelle
SMG4008-8G** (email → SMS) et l'accès au relais interne `mail-relay.msc.com`.

> Le **code ne change pas** : l'envoi email→SMS (`SmsService`) fonctionne dès que le
> serveur qui héberge l'API peut joindre `smtp.gmail.com` (ou `mail-relay.msc.com`),
> ce qui est le cas depuis le réseau MEDLOG (l'application WinDev le fait déjà).

---

## 1. Architecture cible

```
Navigateur (réseau MEDLOG)
        │  https://ci-apps.medlog.com/e-depot
        ▼
   IIS (ci-apps.medlog.com)  ── ARR / URL Rewrite
        ├── /e-depot/api/*   →  http://localhost:3001/api/*   (API Node, ce serveur)
        └── /e-depot/*       →  front (IIS local  OU  Netlify)
        │
   API Node (NestJS)  ──► PostgreSQL (Neon cloud  OU  Postgres local)
                      ──► smtp.gmail.com:587  ──►  medlogsms@gmail.com  ──►  SMG4008-8G  ──►  SMS
```

Points clés :
- **Front et API sous le même hôte** `ci-apps.medlog.com` → pas de CORS, pas de mixed-content.
- L'API écoute en local (127.0.0.1:3001) ; **seul IIS l'expose**, elle n'est pas publique.

---

## 2. Prérequis sur le serveur

- **Windows Server** avec **IIS** + modules **URL Rewrite** et **Application Request Routing (ARR)**
  (déjà en place pour le proxy actuel — cf. `deploy/iis/web.config`).
- **Node.js 20 LTS** (https://nodejs.org) — vérifier : `node -v` et `npm -v`.
- **Git** (pour récupérer/mettre à jour le code) — ou copie du dossier `apps/api`.
- Accès sortant Internet depuis le serveur vers :
  - **smtp.gmail.com:587** (envoi des SMS via la passerelle),
  - la base **Neon** (si on garde la base cloud — port 5432 TLS).
- (Recommandé) **NSSM** (https://nssm.cc) pour lancer l'API comme **service Windows**.

---

## 3. Base de données — deux options

### Option A (rapide) — garder Neon (cloud)
Rien à migrer. Le serveur doit juste avoir un accès Internet sortant.
`DATABASE_URL` = l'URL Neon actuelle.

### Option B (pleine autonomie) — PostgreSQL local
1. Installer **PostgreSQL 16** sur le serveur, créer une base `edepot`.
2. Exporter les données depuis Neon puis importer en local :
   ```bat
   pg_dump "postgresql://neondb_owner:...@ep-...neon.tech/neondb?sslmode=require" -Fc -f edepot.dump
   pg_restore -d "postgresql://postgres:MOTDEPASSE@localhost:5432/edepot" edepot.dump
   ```
3. `DATABASE_URL` = `postgresql://postgres:MOTDEPASSE@localhost:5432/edepot`

---

## 4. Déployer l'API

Dans un dossier, ex. `C:\apps\e-depot` :

```bat
git clone https://github.com/ptiwazo/e-depot.git C:\apps\e-depot
cd C:\apps\e-depot\apps\api
npm install --include=dev
```

Créer le fichier **`C:\apps\e-depot\apps\api\.env`** :

```ini
DATABASE_URL=postgresql://...        # Neon (option A) ou local (option B)
JWT_SECRET=<chaîne_aléatoire_longue>  # ex. généré : node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_EXPIRES_IN=12h
NODE_ENV=production
PORT=3001
CORS_ORIGIN=https://ci-apps.medlog.com
BODY_LIMIT=25mb
```

Build + migrations :

```bat
npm run build
npx prisma migrate deploy
```

(Première fois seulement, si base vide) créer le compte admin et les données de base :
```bat
npm run db:seed
```

Test manuel :
```bat
node dist/main.js
```
→ doit afficher « e-depot API en écoute sur le port 3001 ». Tester : `http://localhost:3001/api/health`.

---

## 5. Lancer l'API comme service Windows (NSSM)

Pour que l'API démarre automatiquement et redémarre en cas d'arrêt :

```bat
nssm install e-depot-api "C:\Program Files\nodejs\node.exe" "C:\apps\e-depot\apps\api\dist\main.js"
nssm set e-depot-api AppDirectory "C:\apps\e-depot\apps\api"
nssm set e-depot-api AppStdout "C:\apps\e-depot\logs\api.out.log"
nssm set e-depot-api AppStderr "C:\apps\e-depot\logs\api.err.log"
nssm start e-depot-api
```

(Alternative : `pm2` + `pm2-windows-startup`.)

---

## 6. Exposer l'API via IIS

Remplacer le `web.config` du site `ci-apps.medlog.com` par **`deploy/iis/web.onprem.config`**
(fourni dans le repo). Il :
1. Route `/e-depot/api/*` vers l'API locale `http://localhost:3001/api/*`.
2. Route le reste de `/e-depot/*` vers le front (Netlify par défaut ; ou IIS local — cf. §7).

⚠️ **L'ordre des règles compte** : la règle API (plus spécifique) doit être **avant** la règle front.

---

## 7. Front — deux options

Le front appelle l'API via `VITE_API_URL`. Pour un hébergement interne, on veut qu'il
appelle **la même origine** `https://ci-apps.medlog.com/e-depot` (→ IIS → API locale).

### Option A — garder le front sur Netlify
Rebuild + redeploy du front avec la variable :
```
VITE_API_URL=https://ci-apps.medlog.com/e-depot
VITE_BASE_PATH=/e-depot/
```
(dans Netlify → Site settings → Environment). Le front continue d'être servi sous
`/e-depot/*` via le proxy IIS ; ses appels `/api` partent vers `ci-apps.medlog.com/e-depot/api`
que IIS route vers l'API locale.

### Option B — servir le front depuis IIS (100 % interne)
1. Build local du front :
   ```bat
   cd C:\apps\e-depot\apps\web
   set VITE_API_URL=https://ci-apps.medlog.com/e-depot
   set VITE_BASE_PATH=/e-depot/
   npm install & npm run build
   ```
2. Copier `apps\web\dist\*` dans le dossier IIS servant `/e-depot`
   (avec une règle URL Rewrite SPA → `index.html` pour les routes client).

> ✅ **HTTPS recommandé** sur `ci-apps.medlog.com` (certificat IIS) : requis pour le
> **scan QR par la caméra** (getUserMedia) et pour la sécurité des jetons.

---

## 8. Notifications SMS — vérification

Une fois l'API sur le serveur MEDLOG :
1. Se connecter en **admin** → **Paramètres → Notifications SMS** :
   `smtp.gmail.com` / `587` / `alertemedlog@gmail.com` / mot de passe / `medlogsms@gmail.com`.
2. Cliquer **« Envoyer un SMS test »** vers un numéro → doit répondre « SMS de test envoyé ».
3. Le SMG4008-8G relaie le SMS au destinataire.

Depuis le réseau MEDLOG, `smtp.gmail.com:587` est joignable (l'app WinDev l'utilise déjà),
donc **plus de « Connection timeout »** comme sur Render.

---

## 9. Mises à jour ultérieures

```bat
cd C:\apps\e-depot
git pull
cd apps\api
npm install --include=dev
npm run build
npx prisma migrate deploy
nssm restart e-depot-api
```

---

## Récapitulatif des variables d'environnement (API)

| Variable          | Valeur                                             |
|-------------------|----------------------------------------------------|
| `DATABASE_URL`    | URL Neon **ou** Postgres local                     |
| `JWT_SECRET`      | chaîne aléatoire ≥ 32 caractères                   |
| `JWT_EXPIRES_IN`  | `12h`                                              |
| `NODE_ENV`        | `production`                                       |
| `PORT`            | `3001`                                             |
| `CORS_ORIGIN`     | `https://ci-apps.medlog.com`                       |
| `BODY_LIMIT`      | `25mb`                                             |

Les identifiants SMS/SMTP ne sont **pas** dans `.env` : ils se règlent dans
**Paramètres → Notifications SMS** (stockés en base, chiffrables ultérieurement).
