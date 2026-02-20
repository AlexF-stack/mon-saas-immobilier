## Anti (Next.js)

## Scripts

```bash
npm run dev        # local development
npm run check      # lint + typecheck
npm run build      # production build
npm run start      # run production server
npm run jwt:generate
```

## Environment

Use `.env` in local development.

For production:

1. Copy `.env.production.example` to your production environment variables.
2. Generate a strong JWT secret:

```bash
npm run jwt:generate
```

3. Set `JWT_SECRET` to the generated value.

`JWT_SECRET` is required in production (`NODE_ENV=production`).
