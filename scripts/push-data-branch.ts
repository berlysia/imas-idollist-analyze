/**
 * data/raw/ を data ブランチにpushするスクリプト
 *
 * 使用方法:
 *   pnpm push:data          # 現在のdata/raw/をdataブランチにpush
 *   pnpm update:data        # スクレイピング実行後にdataブランチにpush
 */
import { execSync, spawnSync } from "node:child_process";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";

const ROOT_DIR = path.resolve(import.meta.dirname, "..");
const DATA_RAW_DIR = path.join(ROOT_DIR, "data/raw");

function exec(command: string, cwd?: string): string {
  return execSync(command, { cwd, encoding: "utf-8", stdio: "pipe" }).trim();
}

function execWithOutput(command: string, cwd?: string): void {
  execSync(command, { cwd, stdio: "inherit" });
}

async function copyDir(src: string, dest: string): Promise<void> {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

async function main(): Promise<void> {
  // data/raw/ が存在するか確認
  try {
    await fs.access(DATA_RAW_DIR);
  } catch {
    console.error(`[push-data-branch] エラー: ${DATA_RAW_DIR} が存在しません`);
    console.error("[push-data-branch] 先に pnpm scrape を実行してください");
    process.exit(1);
  }

  // リモートURLを取得
  const remoteUrl = exec("git remote get-url origin", ROOT_DIR);
  console.log(`[push-data-branch] リモート: ${remoteUrl}`);

  // 一時ディレクトリを作成
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "data-branch-"));
  console.log(`[push-data-branch] 作業ディレクトリ: ${tmpDir}`);

  try {
    // dataブランチが存在するか確認
    const branchExists = spawnSync("git", ["ls-remote", "--heads", "origin", "data"], {
      cwd: ROOT_DIR,
      encoding: "utf-8",
    }).stdout.includes("refs/heads/data");

    if (branchExists) {
      // 既存のdataブランチをclone
      console.log("[push-data-branch] 既存のdataブランチをclone中...");
      execWithOutput(`git clone --branch data --single-branch --depth 1 ${remoteUrl} .`, tmpDir);
    } else {
      // 新規orphanブランチを作成
      console.log("[push-data-branch] 新規dataブランチを作成中...");
      execWithOutput(`git clone --depth 1 ${remoteUrl} .`, tmpDir);
      execWithOutput("git checkout --orphan data", tmpDir);
      execWithOutput("git rm -rf .", tmpDir);
    }

    // raw/ディレクトリを削除して新しいデータをコピー
    const destRawDir = path.join(tmpDir, "raw");
    await fs.rm(destRawDir, { recursive: true, force: true });
    console.log("[push-data-branch] データをコピー中...");
    await copyDir(DATA_RAW_DIR, destRawDir);

    // コミット
    execWithOutput("git add raw/", tmpDir);

    const status = exec("git status --porcelain", tmpDir);
    if (!status) {
      console.log("[push-data-branch] 変更がありません");
      return;
    }

    const timestamp = new Date().toISOString().split("T")[0];
    execWithOutput(`git commit -m "chore: update raw data (${timestamp})"`, tmpDir);

    // push
    console.log("[push-data-branch] pushしています...");
    execWithOutput("git push origin data", tmpDir);
    console.log("[push-data-branch] 完了!");
  } finally {
    // 一時ディレクトリを削除
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error("[push-data-branch] エラー:", err);
  process.exit(1);
});
