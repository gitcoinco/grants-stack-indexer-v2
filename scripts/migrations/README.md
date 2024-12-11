# grants-stack-indexer: migrations scripts

This package contains scripts for managing the database schema and migrations.

## Available Scripts

| Script               | Description                                                  |
| -------------------- | ------------------------------------------------------------ |
| `migrate:chain-data` | Runs all pending database migrations on chainData tables     |
| `migrate:registries` | Runs all pending database migrations on registries tables    |
| `reset:chain-data`   | Drops and recreates the database schema on chainData tables  |
| `reset:registries`   | Drops and recreates the database schema on registries tables |

## Environment Setup

1. Create a `.env` file in the `apps/scripts` directory:

```env
# Database connection URL
DATABASE_URL=postgresql://user:password@localhost:5432/mydb
```

### Environment Variables

| Variable       | Description               | Example                                          |
| -------------- | ------------------------- | ------------------------------------------------ |
| `DATABASE_URL` | PostgreSQL connection URL | `postgresql://user:password@localhost:5432/mydb` |

## Usage

First, install dependencies:

```bash
pnpm install
```

### Running Migrations

To apply all pending migrations:

```bash
pnpm migrate:chain-data --schema=schema_name
```

This will:

1. Load environment variables
2. Connect to the database
3. Create the schema if it doesn't exist
4. Run any pending migrations
5. Log the results

### Resetting the Database

To completely reset the database schema:

```bash
pnpm reset:chain-data --schema=schema_name
```

**Warning**: This will:

1. Drop the existing schema and all its data
2. Recreate an empty schema
3. You'll need to run migrations again after reset

## Development

### Adding New Migrations

1. Create a new migration file in [`packages/repository/src/migrations`](../../packages//repository/migrations)
2. Name it using the format: `YYYYMMDDTHHmmss_description.ts`
3. Implement the `up` and `down` functions
4. Run `pnpm migrate:chain-data` to apply the new migration

Example migration file:

```typescript
import { Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
    // Your migration code here
}

export async function down(db: Kysely<any>): Promise<void> {
    // Code to reverse the migration
}
```

## Troubleshooting

### Common Issues

1. **Connection Error**

    - Check if PostgreSQL is running
    - Verify DATABASE_URL is correct
    - Ensure the database exists

2. **Permission Error**

    - Verify user has necessary permissions
    - Check schema ownership

3. **Migration Failed**
    - Check migration logs
    - Ensure no conflicting changes
    - Verify schema consistency

TODO: add E2E tests for the scripts

## References

-   [Kysely](https://kysely.dev/)
