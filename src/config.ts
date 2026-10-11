import { config as loadEnv } from "dotenv";
import { parseEnv, z } from "znv";

loadEnv({ path: process.env.REGBOT_ENV_FILE_PATH });

const createConfigFromEnvironment = (environment: NodeJS.ProcessEnv) => {
  const config = parseEnv(environment, {
    NODE_ENV: z.enum(["development", "production", "test"]),
    LOG_LEVEL: z
      .enum(["trace", "debug", "info", "warn", "error", "fatal", "silent"])
      .default("info"),
    LOG_FILE: z.string().optional(),
    PID_FILE: z.string().optional(),
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
    BACKGROUND_TASK_FREQUENCY_MS: z.number().default(30000),
    REMINDER_TIME_HH: z.number().default(15),
  });

  return {
    ...config,
    isDev: ["development", "test"].includes(config.NODE_ENV),
    isProd: process.env.NODE_ENV === "production",
  };
};

export const config = createConfigFromEnvironment(process.env);
