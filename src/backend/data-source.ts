import { MikroORM } from "@mikro-orm/better-sqlite";
import config from "#root/backend/micro-orm-config.js";

export const orm = await MikroORM.init(config);

export async function shutDownConnection() {
  await orm.close();
}

export async function runMigrations(from?: string, to?: string) {
  await orm.migrator.up({ from, to });
}

export async function needsMigrations() {
  const pendingMigrations = await orm.migrator.getPendingMigrations();
  return pendingMigrations.length > 0;
}
