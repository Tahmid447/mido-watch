import { readFileSync, writeFileSync } from "node:fs";
import {
  buildPrivateAuditSql,
  privateAuditSchema,
} from "../src/lib/private-audit.ts";
const [file, project] = process.argv.slice(2);
if (!file || !project)
  throw new Error(
    "Usage: node scripts/prepare-private-audit.ts .env.owner-update.json EXPECTED_PROJECT_REF",
  );
if (!file.split("/").at(-1)?.startsWith(".env."))
  throw new Error("Keep private history in an ignored .env.* file.");
const source = readFileSync(file, "utf8");
if (Buffer.byteLength(source) > 2_000_000)
  throw new Error("Private update exceeds 2 MB.");
const input = privateAuditSchema.parse(JSON.parse(source));
writeFileSync(".env.owner-update.sql", buildPrivateAuditSql(input, project), {
  mode: 0o600,
});
console.log(
  "Private SQL prepared; no hosted data changed. Verify the owner/project and retain a private backup before applying through the authenticated management connection. Metadata choices still require a sourced refresh.",
);
