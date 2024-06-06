import { GeneratedCacheAdapter, defineConfig } from "@mikro-orm/better-sqlite";
import { Migrator } from "@mikro-orm/migrations";
import * as fs from "node:fs";

import { MikroPicoLogger } from "#root/backend/helpers/logging.js";
import { config } from "#root/config.js";

const loadJSON = (path: string) =>
  JSON.parse(fs.readFileSync(new URL(path, import.meta.url)).toString());

export default defineConfig({
  dbName: config.DATABASE,
  entities: ["./build/src/backend/entities/**/*.js"],
  entitiesTs: ["./src/backend/entities/**/*.ts"],
  loggerFactory: (options) => new MikroPicoLogger(options),
  debug: config.isDev,
  extensions: [Migrator],
  migrations: {
    path: "./build/src/backend/migrations",
    pathTs: "./src/backend/migrations",
  },
  ...(config.isProd
    ? {
        metadataCache: {
          enabled: true,
          adapter: GeneratedCacheAdapter,
          options: {
            data: loadJSON("../../metadata.json"),
          },
        },
      }
    : {
        // eslint-disable-next-line import/no-extraneous-dependencies
        metadataProvider: (await import("@mikro-orm/reflection"))
          .TsMorphMetadataProvider,
      }),
});
