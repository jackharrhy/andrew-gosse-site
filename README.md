# Andrew Gosse Site

| Command           | Action                                       |
| :---------------- | :------------------------------------------- |
| `npm install`     | Installs dependencies                        |
| `npm run dev`     | Starts local dev server at `localhost:4321`  |
| `npm run build`   | Build your production site to `./dist/`      |
| `npm run preview` | Preview your build locally, before deploying |

## TeaCMS

The admin panel lives at `/tea/admin`.

- **Login**: email + password. Initial admin users are seeded from the
  `TEA_ADMIN_EMAIL_1` / `TEA_ADMIN_PASSWORD_1` env vars on first run, or
  created during the Strapi import via
  `scripts/migrate-from-strapi-to-teacms.ts`.
- **Editor**: BlockNote with custom blocks for media, image-with-adornments,
  riso color swatches, and other special components.
- **Data**: SQLite database at `data/tea.db` plus uploaded media in
  `data/uploads/`. Both are mounted into the container at runtime.
