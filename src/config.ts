import { env, loadEnvFile } from "node:process";
import { parseEnv, z } from "znv";

// fix for https://github.com/microsoft/TypeScript/issues/47663
import * as _ from "#root/../node_modules/znv/dist/util.js";

try {
  loadEnvFile(env.REGBOT_ENV_FILE_PATH);
} catch {
  // No .env file found
}

const createConfigFromEnvironment = (environment: NodeJS.ProcessEnv) => {
  const config = parseEnv(environment, {
    NODE_ENV: z.enum(["development", "production"]),
    LOG_LEVEL: z
      .enum(["trace", "debug", "info", "warn", "error", "fatal", "silent"])
      .default("info"),
    BOT_TOKEN: z.string(),
    BOT_ADMINS: z.array(z.number()).default([]),
    DATABASE: z.string(),
    ADMIN_GROUP: z.number(),
    MEMBERS_GROUP: z.number(),
    CHANNEL: z.number(),
    DEFAULT_LOCALE: z.string().default("ru"),
    TIMEZONE: z.string(),
    PAYMENT_IBAN: z.string(),
    PAYMENT_RECIPIENT: z.string(),
    METRICS_PORT: z.number().default(8080),
  });

  return {
    ...config,
    isDev: process.env.NODE_ENV === "development",
    isProd: process.env.NODE_ENV === "production",
  };
};

export type Config = ReturnType<typeof createConfigFromEnvironment>;

export const config = createConfigFromEnvironment(process.env);
