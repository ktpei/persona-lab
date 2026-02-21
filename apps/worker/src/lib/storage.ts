import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { StorageProvider } from "@persona-lab/shared";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.resolve(__dirname, "../../../../web/uploads");

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
