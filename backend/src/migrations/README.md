# Migrations

This folder contains the full list of migrations that are expected to have run before the server is started.

## Migration Format

Please export the following default object in your migration, named `yyyy-MM-DD-000-name.ts`:

```ts
import pg from "pg"

export default {
  name: "yyyy-MM-DD-000-name",
  async run(client: pg.Client) {
    // The migration.
  }
}
```

Here, `yyyy` is the year, `MM` is a zero-padded month, `DD` is a zero-padded day, `000` is a zero-padded three digit counter within the day for sorting, and `name` is a human-readable identifier.

To have your migration run, import it into `index.ts`, and add it to the run list.

## Running Migrations

Run all migrations using `% npm run db:migrate`. If an error occurs, the migration can be removed from `public.migrations` and can be re-tried, though it is up to the developer to ensure the patch can be applied.
