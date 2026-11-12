import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readableBytes, storageTotal } from "../dist/js/features/storage/size.js";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("French storage sizes are human readable and errors not guessed", () => {
  assert.equal(readableBytes(0), "0 octets");
  assert.equal(readableBytes(1023), "1023 octets");
  assert.match(readableBytes(1024), /1 Kio/);
  assert.match(readableBytes(1024 * 1024), /1 Mio/);
  assert.match(readableBytes(11 * 1024 * 1024), /11 Mio/);
  assert.equal(readableBytes(-2), "Inconnu");
  assert.equal(readableBytes(Infinity), "Inconnu");
});

test("storage totals do not silently count incomplete/invalid scans", () => {
  assert.equal(storageTotal([{bytes: 8_000_000,incomplete:false},{bytes:2_700_000,incomplete:false}]), 10_700_000);
  assert.equal(storageTotal([{bytes:200,incomplete:true},{bytes:300,incomplete:false}]), null);
  assert.equal(storageTotal([{bytes:-1,incomplete:false}]), null);
  assert.equal(storageTotal([{bytes:NaN,incomplete:false}]), null);
});

test("native diagnostic reads only known paths; does not erase or follow symlinks", () => {
  const rust = read("src-tauri/src/storage_diagnostic.rs");
  for (const item of [
    "app_local_data_dir", "app_config_dir", "documents_dir",
    "symlink_metadata", "MAX_ENTRIES", "MAX_DEPTH", "storage_diagnostic",
    "edch-bgs.sqlite3", "edch-agent-memory-v153.sqlite3", "agent-memory-backups",
    "symbolic_links_are_never_followed",
  ]) assert.ok(rust.includes(item),item);
  const production = rust.split("#[cfg(test)]")[0];
  assert.doesNotMatch(production, /remove_file|remove_dir_all|Command::new|\.write\(/);
});

test("Settings Advanced renders storage, backups and local SQLite health checks", () => {
  const settings=read("src/views/settings/index.ts");
  const card=read("src/views/settings/cards/storage.ts");
  const bridge=read("src/platform/bridge.ts");
  const lib=read("src-tauri/src/lib.rs");
  assert.ok(settings.includes("StorageCard"));
  assert.ok(settings.includes("this.storageCard.render()"));
  assert.ok(card.includes('"data-tab":"advanced"'));
  for(const value of ["Analyser mon stockage","Tester l'intégrité BGS SQLite",
    "Sauvegardes SQLite des agents","Copier chemin"]) assert.ok(card.includes(value),value);
  assert.ok(card.includes("isRemote()"));
  assert.ok(bridge.includes('"storage_diagnostic"'));
  assert.ok(lib.includes("storage_diagnostic::storage_diagnostic"));
});
