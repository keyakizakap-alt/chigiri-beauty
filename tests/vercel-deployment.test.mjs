import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const packageJson = JSON.parse(await read("package.json"));
const vercel = JSON.parse(await read("vercel.json"));
const db = await read("db/index.ts");
const blob = await read("server/blob-store.ts");
const uploads = await read("app/api/uploads/route.ts");
const consultations = await read("app/api/consultations/route.ts");
const migration = await read("app/api/account/migrate/route.ts");

test("uses the native Next.js lifecycle on Vercel", () => {
  assert.equal(packageJson.scripts.dev, "next dev");
  assert.equal(packageJson.scripts.build, "next build");
  assert.equal(packageJson.scripts.start, "next start");
  assert.equal(vercel.framework, "nextjs");
  assert.equal(vercel.buildCommand, "npm run build");
});

test("initializes Turso lazily so builds do not need production secrets", () => {
  assert.match(db, /TURSO_DATABASE_URL/);
  assert.match(db, /TURSO_AUTH_TOKEN/);
  assert.match(db, /if \(!database\) database = createDb\(\)/);
});

test("stores customer uploads as private Vercel blobs", () => {
  assert.match(blob, /access: "private"/);
  assert.match(uploads, /getPrivateImage/);
  assert.match(consultations, /deletePrivateImages/);
});

test("Vercel runtime routes do not import Cloudflare bindings", () => {
  for (const source of [db, uploads, consultations, migration]) {
    assert.doesNotMatch(source, /cloudflare:workers|env\.BUCKET|env\.DB/);
  }
});
