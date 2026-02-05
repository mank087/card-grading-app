import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      // Backup folders
      "backup_*/**",
      "backups/**",
      // Utility scripts (not part of the app)
      "update_*.js",
      "verify_*.js",
      // Scripts folder
      "scripts/**",
    ],
  },
];

export default eslintConfig;
