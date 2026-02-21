import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { StorageProvider } from "@persona-lab/shared";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Always use web app's uploads dir so worker and web share the same files (no env mismatch)
const repoRoot = path.resolve(__dirname, "../../../..");
const UPLOAD_DIR = path.resolve(repoRoot, "apps/web/uploads");

export class LocalStorageProvider implements StorageProvider {
  private baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir || UPLOAD_DIR;
  }

  async save(key: string, data: Buffer): Promise<string> {
    const filePath = path.join(this.baseDir, key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, data);
    return key;
  }

  async get(key: string): Promise<Buffer> {
    const filePath = path.join(this.baseDir, key);
    return fs.readFile(filePath);
  }

  async delete(key: string): Promise<void> {
    const filePath = path.join(this.baseDir, key);
    await fs.unlink(filePath).catch(() => {});
  }
}

export const storage = new LocalStorageProvider();
