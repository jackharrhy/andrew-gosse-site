#!/bin/sh
# Exercise the production loader with disposable data and no outbound network.
set -eu
container=$(docker run -d --network none --tmpfs /app/data:uid=1000,gid=1000 \
  "${1:?built image required}")
trap 'docker logs "$container"; docker rm -f "$container" >/dev/null' EXIT

docker exec -i "$container" node --import remix/node-tsx --input-type=module <<'JS'
import assert from 'node:assert/strict';
import { openDatabase } from './app/data/database.ts';
assert.equal(process.versions.node.split('.')[0], '26');
assert.equal(process.config.variables.v8_enable_pointer_compression, 1);
// Separate database avoids racing the server's first-boot migrations.
const { sqlite } = await openDatabase('/app/data/runtime-probe.db');
sqlite.exec('CREATE TABLE runtime_probe(value INTEGER); INSERT INTO runtime_probe VALUES (26)');
assert.equal(sqlite.prepare('SELECT value FROM runtime_probe').get().value, 26);
sqlite.close();
(await openDatabase('/app/data/runtime-probe.db')).sqlite.close();
for (const path of ['/healthz', '/', '/tea/login', '/assets/app/actions/public/entry.ts']) {
  let response;
  for (let attempt = 0; attempt < 40; attempt++) {
    try { response = await fetch(`http://127.0.0.1:4331${path}`); break; }
    catch { await new Promise(resolve => setTimeout(resolve, 250)); }
  }
  assert.equal(response?.status, 200, path);
  assert.ok((await response.text()).length > 0, path);
  console.log(path, response.status);
}
console.log(process.version, 'pointer compression=1; Remix loader, migrations and SQLite round-trip OK');
JS
