import { promises as fs } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const functionPaths = [
  path.join(root, 'functions', 'api', 'report-error.ts'),
  path.join(root, 'worker', 'index.ts'),
];
const migrationPath = path.join(root, 'migrations', '0001_feedback.sql');
const migration = await fs.readFile(migrationPath, 'utf8');

const splitTopLevel = (text) => {
  const parts = [];
  let start = 0, depth = 0, quote = null, escape = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quote) {
      if (escape) escape = false;
      else if (char === '\\') escape = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === '`') { quote = char; continue; }
    if ('([{'.includes(char)) depth++;
    else if (')]}'.includes(char)) depth--;
    else if (char === ',' && depth === 0) { parts.push(text.slice(start, i).trim()); start = i + 1; }
  }
  const final = text.slice(start).trim();
  if (final) parts.push(final);
  return parts;
};

const db = new DatabaseSync(':memory:');
db.exec(migration);
for (const [index, functionPath] of functionPaths.entries()) {
  const source = await fs.readFile(functionPath, 'utf8');
  const matches = [...source.matchAll(/\.prepare\(`([\s\S]*?)`\)\s*\n?\s*\.bind\(([\s\S]*?)\)\s*\.run\(\)/g)];
  const match = matches.find((candidate) => candidate[1].includes("INSERT INTO correction_reports"));
  if (!match) throw new Error(`Could not locate the prepared correction INSERT and bind call in ${path.relative(root, functionPath)}.`);
  const sql = match[1];
  const bindText = match[2];
  const placeholders = (sql.match(/\?/g) ?? []).length;
  const bindArgs = splitTopLevel(bindText);
  if (placeholders !== bindArgs.length) {
    throw new Error(`${path.relative(root, functionPath)} correction INSERT has ${placeholders} placeholders but .bind() supplies ${bindArgs.length} values.`);
  }

  const id = `test-id-${index}`;
  const sample = [
    id, 'https://qazaq-lens.test/myths/borat/', 'Test page',
    'A sufficiently detailed test issue.', 'A sufficiently detailed test reason.',
    'https://example.test/source', 'Test source', null, null, null, 0, 'en-US',
  ];
  if (sample.length !== placeholders) throw new Error(`Audit fixture has ${sample.length} values but SQL requires ${placeholders}.`);
  db.prepare(sql).run(...sample);
  const row = db.prepare('SELECT id, status, may_credit FROM correction_reports WHERE id=?').get(id);
  if (!row || row.status !== 'new' || row.may_credit !== 0) throw new Error(`${path.relative(root, functionPath)} correction INSERT did not persist the expected row.`);
  console.log(`${path.relative(root, functionPath)} correction audit passed: ${placeholders} placeholders, ${bindArgs.length} bindings.`);
}
