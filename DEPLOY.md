# Déploiement e-depot en production

Architecture cible :

- **API NestJS + PostgreSQL** → **Render** (Blueprint `render.yaml`, base managée)
- **Front React** → **Netlify** (`netlify.toml`)

La base des conteneurs est en **PostgreSQL** (le connecteur HFSQL a été retiré).

---

## 0. Prérequis (une fois)

1. Pousser le dépôt sur **GitHub** (repo privé conseillé).
   ```bash
   cd e-depot
   git init && git add . && git commit -m "e-depot production-ready"
   git branch -M main
   git remote add origin git@github.com:<compte>/e-depot.git
   git push -u origin main
   ```
   `.env` et `dist/` sont déjà ignorés (`.gitignore`) — aucun secret n'est poussé.
2. Comptes **Render** et **Netlify** (gratuits) connectés à ce repo GitHub.

---

## 1. Base de données — Neon (PostgreSQL gratuit)

Render ne fournit qu'une base free par compte, donc on utilise **Neon** (base isolée) :
1. [neon.tech](https://neon.tech) → créer un projet (région Europe).
2. Copier la **connection string** (format `postgresql://user:pwd@ep-xxx.eu-central-1.aws.neon.tech/neondb?sslmode=require`).
   Utiliser de préférence la connexion **directe** (pooling désactivé) pour que les migrations passent sans souci.

## 2. API — Render

1. Render → **New** → **Blueprint** → sélectionner le repo. Render lit `render.yaml`
   et crée le service web `e-depot-api` (génère `JWT_SECRET`).
2. Dans les **Environment variables** du service, coller `DATABASE_URL` = l'URL Neon
   de l'étape 1 (et `CORS_ORIGIN` plus tard, cf. étape 4).
3. **Build** (`npm install --include=dev && npm run build`) puis **Start**
   (`npm run start:prod` = `prisma migrate deploy && node dist/main.js`).
   → les migrations sont appliquées automatiquement à chaque déploiement.
4. Récupérer l'URL publique de l'API, ex. `https://e-depot-api.onrender.com`.
5. **Créer les comptes initiaux** (une fois) : Render → service → **Shell** :
   ```bash
   npm run db:seed
   ```
   Crée les comptes démo (mot de passe `EDepot2026!`). ⚠️ En vraie prod, changez
   ces mots de passe ou adaptez `prisma/seed.ts` avant.

---

## 2. Front — Netlify

1. Netlify → **Add new site** → **Import from Git** → sélectionner le repo.
   `netlify.toml` fournit build (`base = apps/web`), publish (`dist`) et le fallback SPA.
2. **Site settings → Environment variables** :
   ```
   VITE_API_URL = https://e-depot-api.onrender.com
   ```
   (l'URL de l'API Render de l'étape 1, sans slash final).
3. **Deploy**. Récupérer l'URL du site, ex. `https://e-depot-ci.netlify.app`.

---

## 3. Relier les deux (CORS)

Sur **Render** → service `e-depot-api` → **Environment** → variable `CORS_ORIGIN` :

```
CORS_ORIGIN = https://e-depot-ci.netlify.app
```

Redéployer l'API. Le front peut alors appeler l'API (origine autorisée).

---

## 4. Vérification

- `https://e-depot-api.onrender.com/api/health` → `{"status":"ok",...}`
- Ouvrir le site Netlify, se connecter avec `admin@medlog.ci` / `EDepot2026!`.

---

## 5. Exposer sous http://ci-apps.medlog.com/e-depot (IIS reverse proxy)

Le front est buildé avec **base `/e-depot/`** (voir `vite.config.ts` + `basename` du
routeur) et Netlify le sert sous ce sous-chemin (redirections dans `netlify.toml`).
Un serveur **IIS** proxifie ce sous-chemin vers Netlify ; l'API reste appelée
directement sur Render.

1. Sur le serveur IIS (`ci-apps.medlog.com`), installer **URL Rewrite** + **ARR**,
   puis activer le proxy (IIS Manager → serveur → *Application Request Routing Cache*
   → *Server Proxy Settings* → *Enable proxy*).
2. Déposer `deploy/iis/web.config` à la racine du site (règle : `/e-depot/*` →
   `https://e-depot.netlify.app/e-depot/*`, préfixe conservé).
3. Sur **Render** → `e-depot-api` → **Environment**, autoriser la nouvelle origine
   (liste séparée par des virgules, sans slash final) :
   ```
   CORS_ORIGIN = http://ci-apps.medlog.com,https://e-depot.netlify.app
   ```
   (le code CORS gère la liste ; `*` seul autorise tout.)
4. Vérifier : `http://ci-apps.medlog.com/e-depot` affiche l'app, le login fonctionne.

> Page http + API https : pas de blocage *mixed content* (une page http PEUT appeler
> une API https). Si `ci-apps.medlog.com` passe un jour en https, rien à changer.

---

## Développement local (Postgres requis)

L'app n'utilise plus SQLite. En local, il faut un PostgreSQL (Docker, installation
locale, ou instance portable). Renseigner `apps/api/.env` (`DATABASE_URL`), puis :

```bash
cd e-depot
npm install
npm --workspace apps/api run db:setup   # migrate + seed
npm run dev                             # API :3001, web :5173
```
