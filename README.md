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

This creates a `dev@emdash.local` admin account and drops you straight into the admin. Only works when the dev server is running.

### Custom editors

| URL | What it does |
| :-- | :----------- |
| `/_emdash/admin/plugins/content-blocks/page-editor` | Edit page blocks inline (no dialogs) |
| `/_emdash/admin/plugins/content-blocks/sidebar` | Edit sidebar nav, images, and links |

