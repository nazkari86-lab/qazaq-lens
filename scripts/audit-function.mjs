import { promises as fs } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const functionPath = path.join(root, 'functions', 'api', 'report-error.ts');
const migrationPath = path.join(root, 'migrations', '0001_feedback.sql');
const source = await fs.readFile(functionPath, 'utf8');
const migration = await fs.readFile(migrationPath, 'utf8');
const match = source.match(/\.prepare\(`([\s\S]*?)`\)\s*\n?\s*\.bind\(([\s\S]*?)\)\.run\(\)/);
if (!match) throw new Error('Could not locate the prepared correction INSERT and bind call.');
const sql = match[1];
const bindText = match[2];

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

const placeholders = (sql.match(/\?/g) ?? []).length;
const bindArgs = splitTopLevel(bindText);
if (placeholders !== bindArgs.length) {
  throw new Error(`Correction INSERT has ${placeholders} placeholders but .bind() supplies ${bindArgs.length} values.`);
}

const db = new DatabaseSync(':memory:');
db.exec(migration);
const sample = [
  'test-id', 'https://qazaq-lens.test/myths/borat/', 'Test page',
  'A sufficiently detailed test issue.', 'A sufficiently detailed test reason.',
  'https://example.test/source', 'Test source', null, null, null, 0, 'en-US',
];
if (sample.length !== placeholders) throw new Error(`Audit fixture has ${sample.length} values but SQL requires ${placeholders}.`);
db.prepare(sql).run(...sample);
const row = db.prepare("SELECT id, status, may_credit FROM correction_reports WHERE id='test-id'").get();
if (!row || row.status !== 'new' || row.may_credit !== 0) throw new Error('Correction INSERT did not persist the expected row.');
console.log(`Correction function audit passed: ${placeholders} placeholders, ${bindArgs.length} bindings, migration and INSERT valid.`);
