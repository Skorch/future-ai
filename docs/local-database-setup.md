# Local Database Development Setup

This guide explains how to run the application with a local PostgreSQL database using Docker.

## How It Works

The application now uses a **database connection factory** (`lib/db/connection.ts`) that automatically detects the environment:

1. **Local Development** (localhost): Uses `postgres` package with standard PostgreSQL
2. **Production** (Vercel/Neon): Uses `@vercel/postgres` with WebSocket protocol

This eliminates the need for a WebSocket proxy locally - just use standard PostgreSQL on port 5432.

## Setup Instructions

### Prerequisites
- Docker (or OrbStack on macOS)
- Node.js 18+ and pnpm

### 1. Start the Local Database

```bash
pnpm db:local:up
```

This starts PostgreSQL 17 on port 5432.

### 2. Configure Your Environment

Update your `.env.local`:

```bash
# Use standard PostgreSQL port 5432
POSTGRES_URL=postgres://postgres:postgres@localhost:5432/futureai
```

### 3. Run Migrations

```bash
pnpm db:migrate
```

### 4. Start Development

```bash
pnpm dev
```

The application will automatically detect localhost and use the `postgres` package instead of `@vercel/postgres`.

## Available Commands

```bash
# Database Management
pnpm db:local:up      # Start local PostgreSQL + WebSocket proxy
pnpm db:local:down    # Stop local database

# Standard Database Operations (work locally and in production)
pnpm db:migrate       # Run migrations
pnpm db:generate      # Generate new migration from schema
pnpm db:studio        # Open Drizzle Studio GUI
pnpm db:reset         # DANGER: Complete database reset

# Development
pnpm dev              # Start Next.js dev server
pnpm build            # Build (includes migrations)
```

## Architecture Details

### How It Works

The database connection factory (`lib/db/connection.ts`) detects the environment:

```typescript
function isLocalDevelopment(): boolean {
  const url = process.env.POSTGRES_URL || '';
  return url.includes('localhost') || url.includes('127.0.0.1');
}
```

- **Local**: Uses `postgres` package with `drizzle-orm/postgres-js`
- **Production**: Uses `@vercel/postgres` with `drizzle-orm/vercel-postgres`

### Files Created/Modified

- `lib/db/connection.ts` - New database connection factory
- `lib/db/queries.ts` - Now imports db from connection factory
- All migration scripts - Use `postgres` package directly (unchanged)

## Troubleshooting

### Docker Not Running
```
Error: Cannot connect to the Docker daemon
```
**Solution**: Start Docker Desktop or OrbStack

### Application Can't Connect
```
Error: Failed to connect to database
```
**Solution**: Ensure Docker is running and PostgreSQL is healthy. Check `docker ps` to verify the container is running.

### Wrong Connection Type
```
Error: WebSocket connection failed
```
**Solution**: Make sure your `.env.local` uses `localhost` or `127.0.0.1` so the connection factory detects local development.

## Comparison with Production

| Aspect | Production (Neon/Vercel) | Local Development |
|--------|-------------------------|-------------------|
| Connection Package | `@vercel/postgres` | `postgres` |
| Connection Type | WebSocket | Standard PostgreSQL |
| Port | Cloud managed | 5432 |
| Setup Time | Instant | ~10 seconds (container startup) |
| Cost | Usage-based | Free (local resources) |

## Docker Compose Details

The `docker-compose.yml` includes:

```yaml
services:
  postgres:
    image: postgres:17
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: futureai
    ports:
      - "5432:5432"
    volumes:
      - db_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
```

## Benefits

1. **Simplified Setup**: No WebSocket proxy needed
2. **Automatic Detection**: Connection factory handles environment switching
3. **Fast Development**: No network latency
4. **Cost Savings**: No cloud database usage during development
5. **Isolated Testing**: Each developer has their own database
6. **Production Safety**: No risk of accidentally connecting to production from local

## Next Steps

- Run `pnpm db:studio` to explore your database with Drizzle Studio
- Check `docker-compose logs` if you encounter issues
- Use `pnpm db:local:down` to stop containers when done