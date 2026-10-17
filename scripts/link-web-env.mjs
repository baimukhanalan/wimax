import { lstat, symlink } from "node:fs/promises";
import { resolve } from "node:path";

const envFiles = [".env.local", ".env.development.local"];

for (const envFile of envFiles) {
  const rootEnv = resolve(import.meta.dirname, `../${envFile}`);
  const webEnv = resolve(import.meta.dirname, `../apps/web/${envFile}`);
  try {
    await lstat(rootEnv);
  } catch {
    if (envFile === ".env.local") {
      console.error("Root .env.local is missing. Copy .env.example and configure it first.");
      process.exit(1);
    }
    continue;
  }

  try {
    await lstat(webEnv);
  } catch {
    await symlink(`../../${envFile}`, webEnv);
    console.log(`Linked apps/web/${envFile} to the private root environment file.`);
  }
}
