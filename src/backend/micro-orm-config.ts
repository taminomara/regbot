import { defineConfig } from "@mikro-orm/better-sqlite";
import { Migrator } from "@mikro-orm/migrations";
import { TsMorphMetadataProvider } from "@mikro-orm/reflection";

import { MikroPicoLogger } from "#root/backend/helpers/logging.js";
import { config } from "#root/config.js";

export default defineConfig({
  dbName: config.DATABASE,
  metadataProvider: TsMorphMetadataProvider,
  entities: ["./build/src/backend/entities/**/*.js"],
  entitiesTs: ["./src/backend/entities/**/*.ts"],
  loggerFactory: (options) => new MikroPicoLogger(options),
  debug: config.isDev,
  extensions: [Migrator],
  migrations: {
    path: "./build/src/backend/migrations",
    pathTs: "./src/backend/migrations",
  },
});
