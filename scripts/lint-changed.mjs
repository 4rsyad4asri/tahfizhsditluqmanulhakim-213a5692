import { execFileSync } from "node:child_process";
import { ESLint } from "eslint";

const runGit = (args) =>
  execFileSync("git", args, { encoding: "utf8" })
    .split(/\r?\n/)
    .map((file) => file.trim())
    .filter(Boolean);

const candidates = new Set([
  ...runGit(["diff", "--name-only", "--diff-filter=ACMR", "HEAD"]),
  ...runGit(["diff", "--cached", "--name-only", "--diff-filter=ACMR", "HEAD"]),
  ...runGit(["ls-files", "--others", "--exclude-standard"]),
]);

const files = [...candidates].filter(
  (file) => /\.(ts|tsx)$/.test(file) && (file.startsWith("src/") || file.startsWith("supabase/"))
);

if (files.length === 0) {
  console.log("Tidak ada file TypeScript berubah yang perlu diperiksa.");
  process.exit(0);
}

const eslint = new ESLint();
const results = await eslint.lintFiles(files);
const formatter = await eslint.loadFormatter("stylish");
const output = formatter.format(results);

if (output) {
  console.log(output);
}

const errorCount = results.reduce((total, result) => total + result.errorCount, 0);
if (errorCount > 0) {
  process.exitCode = 1;
} else {
  console.log(`Lint file berubah lulus (${files.length} file).`);
}

