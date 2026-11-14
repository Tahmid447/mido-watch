import { randomUUID, randomBytes } from "node:crypto";
import { writeFileSync, existsSync, unlinkSync } from "node:fs";
import { spawn } from "node:child_process";
if (existsSync(".env.test-users.json"))
  throw new Error(
    "Existing test fixtures found. Keep them safe; remove or rename them before running isolated tests.",
  );
const users = ["a", "b"].map((n) => ({
  id: randomUUID(),
  email: `isolated-${n}@example.invalid`,
  password: randomBytes(24).toString("base64url"),
}));
writeFileSync(".env.test-users.json", JSON.stringify(users), { mode: 0o600 });
const runner = spawn(
  process.execPath,
  ["node_modules/@playwright/test/cli.js", "test", ...process.argv.slice(2)],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      MIDO_ISOLATED_E2E: "1",
      PLAYWRIGHT_BASE_URL: "http://127.0.0.1:3100",
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54329",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
        "sb_publishable_isolated_contract_only",
    },
  },
);
runner.on("exit", (code) => {
  unlinkSync(".env.test-users.json");
  process.exit(code ?? 1);
});
