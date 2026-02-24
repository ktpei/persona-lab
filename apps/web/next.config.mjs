import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@persona-lab/shared"],
  output: "standalone",
  // Traces files from monorepo root so packages/shared is included in standalone output
  outputFileTracingRoot: path.join(__dirname, "../../"),
};

export default nextConfig;
