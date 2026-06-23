import { execFileSync } from "node:child_process";

const git = (args) =>
  execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();

const branch = git(["branch", "--show-current"]);
if (!branch) {
  throw new Error("Tidak dapat memverifikasi remote ketika HEAD tidak berada pada branch.");
}

const localHash = git(["rev-parse", "HEAD"]);
const remoteLine = git(["ls-remote", "origin", `refs/heads/${branch}`]);
const remoteHash = remoteLine.split(/\s+/)[0];

if (!remoteHash) {
  throw new Error(`Branch origin/${branch} belum ditemukan.`);
}

console.log(`Branch : ${branch}`);
console.log(`Lokal  : ${localHash}`);
console.log(`GitHub : ${remoteHash}`);

if (localHash !== remoteHash) {
  console.error("BELUM SINKRON: commit lokal berbeda dari GitHub.");
  process.exitCode = 1;
} else {
  console.log("SINKRON: commit lokal sudah tersedia di GitHub.");
}
