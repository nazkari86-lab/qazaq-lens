import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const contentDir = path.join(root, 'src', 'data', 'myths');
const files = (await fs.readdir(contentDir)).filter((name) => /\.mdx?$/.test(name));
const urls = new Set();
for (const file of files) {
  const text = await fs.readFile(path.join(contentDir, file), 'utf8');
  for (const match of text.matchAll(/\bhttps?:\/\/[^\s"'<>\]}]+/g)) urls.add(match[0].replace(/[),.;]+$/, ''));
}

const failures = [];
const blocked = [];
const transient = [];
const checks = [...urls];
let cursor = 0;
const worker = async () => {
  while (cursor < checks.length) {
    const url = checks[cursor++];
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      let response = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: controller.signal, headers: { 'user-agent': 'QazaqLens-LinkAudit/1.0' } });
      if ([403, 405, 429].includes(response.status)) response = await fetch(url, { method: 'GET', redirect: 'follow', signal: controller.signal, headers: { 'user-agent': 'QazaqLens-LinkAudit/1.0', range: 'bytes=0-1023' } });
      if ([403, 406, 429].includes(response.status)) {
        blocked.push(`${response.status} ${url}`);
        console.log(`BLOCKED ${response.status} ${url}`);
      } else if (response.status >= 500) {
        transient.push(`${response.status} ${url}`);
        console.log(`RETRY ${response.status} ${url}`);
      } else if ([404, 410].includes(response.status)) {
        failures.push(`${response.status} ${url}`);
        console.error(`BROKEN ${response.status} ${url}`);
      } else if (response.status >= 400) {
        failures.push(`${response.status} ${url}`);
        console.error(`FAIL ${response.status} ${url}`);
      } else console.log(`${response.status} ${url}`);
    } catch (error) {
      transient.push(`${error instanceof Error ? error.name : 'ERROR'} ${url}`);
      console.log(`RETRY ${error instanceof Error ? error.name : 'ERROR'} ${url}`);
    } finally { clearTimeout(timer); }
  }
};
await Promise.all(Array.from({ length: Math.min(5, checks.length) }, worker));
console.log(`Checked ${checks.length} external source URLs.`);
console.log(`Permanent failures: ${failures.length}; anti-bot blocks: ${blocked.length}; transient/network results: ${transient.length}.`);
if (blocked.length) console.log('Blocked results are reported for editorial follow-up but do not fail the audit; 403/406/429 commonly come from publisher anti-bot protection.');
if (transient.length) console.log('Transient/network results are reported for a later retry and do not fail the audit.');
if (failures.length) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  process.exitCode = 1;
}
