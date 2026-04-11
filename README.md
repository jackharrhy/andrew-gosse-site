# Andrew Gosse Site

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm install`             | Installs dependencies                            |
| `npm run dev`             | Starts local dev server at `localhost:4321`      |
| `npm run build`           | Build your production site to `./dist/`          |
| `npm run preview`         | Preview your build locally, before deploying     |
| `npm run update-emdash`   | Pull latest emdash from GitHub, rebuild, reinstall |

## EmDash CMS

The admin panel lives at `/_emdash/admin`.

### Local dev login

In dev mode, skip passkey setup entirely with the bypass URL:

```
http://localhost:4321/_emdash/api/auth/dev-bypass?redirect=/_emdash/admin
```

This creates a `dev@emdash.local` admin account and drops you straight into the admin. Only works when the dev server is running — returns 403 in production.

### First-time production setup

On a fresh deployment, visit `/_emdash/admin` — you'll be redirected to the Setup Wizard. Create your admin account with a passkey (one-time only). After that, Google OAuth can be used for day-to-day login if configured.

### Inviting your friend

Settings → Users → Invite User → enter their email → pick Editor role → Send Invite. They click the link in their email and register their own passkey (or link Google if OAuth is configured).

### Google OAuth (optional)

Add to your production `.env`:

```bash
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
```

Create credentials at console.cloud.google.com → APIs & Services → Credentials → OAuth 2.0 Client ID. Set the authorized redirect URI to:

```
https://yoursite.com/_emdash/api/auth/oauth/google/callback
```

### Custom editors

| URL | What it does |
| :-- | :----------- |
| `/_emdash/admin/plugins/content-blocks/page-editor` | Edit page blocks inline (no dialogs) |
| `/_emdash/admin/plugins/content-blocks/sidebar` | Edit sidebar nav, images, and links |
