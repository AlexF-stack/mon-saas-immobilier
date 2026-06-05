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

## 📄 PDF generation

The contract and receipt PDF routes are generated from live database records and return a real PDF file.

### Endpoints

| Method | URL | Description |
| --- | --- | --- |
| GET | /api/contracts/:id/download | Download the contract PDF for a contract record |
| GET | /api/payments/:id/receipt | Download the receipt PDF for a completed payment |

### Example

```bash
curl -L -o contract.pdf http://localhost:3000/api/contracts/abc123/download
curl -L -o receipt.pdf http://localhost:3000/api/payments/xyz456/receipt
```

### Tests

```bash
npm run test
npm run test:integration
```

The PDF tests verify the returned content is a valid PDF and that the main contract / receipt fields are present in the generated document.

For the integration suite, the runner now uses a SQLite fallback schema at `prisma/schema.sqlite.prisma` with `DATABASE_URL=file:./test.db` in `prisma/.env.test`. This removes the external PostgreSQL dependency for local validation while keeping the production schema unchanged.

