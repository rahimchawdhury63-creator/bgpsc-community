#!/usr/bin/env node
/**
 * Generate src/types/database.ts from supabase/migrations/*.sql
 *
 * The @supabase/supabase-js client is generic over a `Database` type whose
 * Tables/Views entries MUST satisfy `GenericTable` / `GenericView`, which both
 * require a `Relationships` array. Hand-maintained types drift from the SQL and
 * silently collapse every row type to `never`. This script derives the type
 * from the migrations so the two can never drift again.
 *
 * Usage: node scripts/gen-db-types.mjs [--check]
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATIONS_DIR = join(ROOT, 'supabase', 'migrations');
const OUT_FILE = join(ROOT, 'src', 'types', 'database.ts');
const CHECK = process.argv.includes('--check');

// ---------------------------------------------------------------------------
// SQL helpers
// ---------------------------------------------------------------------------

/** Remove `-- line comments`, ignoring `--` that appears inside a string literal. */
function stripLineComments(sql) {
  return sql
    .split('\n')
    .map((line) => {
      let inString = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === "'") {
          // '' is an escaped quote inside a string literal
          if (inString && line[i + 1] === "'") i++;
          else inString = !inString;
        } else if (!inString && ch === '-' && line[i + 1] === '-') {
          return line.slice(0, i);
        }
      }
      return line;
    })
    .join('\n');
}

/** Blank out every `$$ ... $$` body, keeping the signature that precedes it. */
function blankDollarBodies(sql) {
  let out = '';
  let i = 0;
  while (i < sql.length) {
    const start = sql.indexOf('$$', i);
    if (start === -1) {
      out += sql.slice(i);
      break;
    }
    const end = sql.indexOf('$$', start + 2);
    if (end === -1) {
      out += sql.slice(i);
      break;
    }
    out += sql.slice(i, start) + '$$';
    i = end + 2;
  }
  return out;
}

/** Given a string that starts at an opening paren, return the index after its match. */
function matchParen(text, openIdx) {
  let depth = 0;
  let inString = false;
  for (let i = openIdx; i < text.length; i++) {
    const ch = text[i];
    if (ch === "'") {
      if (inString && text[i + 1] === "'") i++;
      else inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === '(') depth++;
    else if (ch === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Split on commas that sit at paren-depth zero. */
function splitTopLevel(text) {
  const parts = [];
  let depth = 0;
  let inString = false;
  let current = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "'") {
      if (inString && text[i + 1] === "'") {
        current += "''";
        i++;
        continue;
      }
      inString = !inString;
      current += ch;
      continue;
    }
    if (!inString) {
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
      else if (ch === ',' && depth === 0) {
        parts.push(current);
        current = '';
        continue;
      }
    }
    current += ch;
  }
  if (current.trim()) parts.push(current);
  return parts.map((p) => p.trim()).filter(Boolean);
}

function* matches(sql, re) {
  let m;
  while ((m = re.exec(sql)) !== null) yield m;
}

/**
 * Split `name TYPE [constraints...]` into its parts.
 *
 * The type is everything before the first constraint keyword. Greedy/lazy
 * regex groups are unreliable here because both the type and the constraint
 * list are open-ended, so we anchor on the keyword set instead.
 */
const CONSTRAINT_KEYWORD =
  /\b(?:NOT\s+NULL|NULL|DEFAULT|PRIMARY\s+KEY|UNIQUE|CHECK|REFERENCES|GENERATED|CONSTRAINT|COLLATE)\b/i;

function parseNameType(decl) {
  const head = decl.match(/^"?(\w+)"?\s+/);
  if (!head) return null;
  const name = head[1];
  const rest = decl.slice(head[0].length);
  const kw = rest.search(CONSTRAINT_KEYWORD);
  const sqlType = (kw === -1 ? rest : rest.slice(0, kw)).trim();
  const constraints = kw === -1 ? '' : rest.slice(kw);
  if (!sqlType) return null;
  return { name, sqlType, constraints };
}

// ---------------------------------------------------------------------------
// Type mapping
// ---------------------------------------------------------------------------

const ENUMS = new Map(); // name -> string[]

function mapSqlType(raw, colName) {
  let t = raw.trim().replace(/\s+/g, ' ');
  const upper = t.toUpperCase();

  // Array forms: `TEXT[]`, `_text`
  const bracket = t.match(/^([\w ]+?)\s*(\(\d+(?:,\s*\d+)?\))?\s*(\[\])+$/);
  if (bracket) return `${mapSqlType(bracket[1].trim())}[]`;
  if (upper.startsWith('_')) return `${mapSqlType(t.slice(1))}[]`;

  const bare = t.replace(/\(.*\)/, '').trim().toUpperCase();

  switch (bare) {
    case 'UUID':
    case 'TEXT':
    case 'CITEXT':
    case 'VARCHAR':
    case 'CHAR':
    case 'CHARACTER':
    case 'BPCHAR':
    case 'NAME':
    case 'TSVECTOR':
    case 'INET':
    case 'INTERVAL':
      return 'string';
    case 'INTEGER':
    case 'INT':
    case 'INT4':
    case 'SMALLINT':
    case 'INT2':
    case 'BIGINT':
    case 'INT8':
    case 'SERIAL':
    case 'BIGSERIAL':
    case 'DECIMAL':
    case 'NUMERIC':
    case 'REAL':
    case 'FLOAT4':
    case 'DOUBLE':
    case 'FLOAT8':
      return 'number';
    case 'BOOLEAN':
    case 'BOOL':
      return 'boolean';
    case 'TIMESTAMPTZ':
    case 'TIMESTAMP':
    case 'DATE':
    case 'TIME':
    case 'TIMETZ':
      return 'string';
    case 'JSON':
    case 'JSONB':
      return 'Json';
    case 'VECTOR':
      return 'number[]';
    default:
      break;
  }

  const enumName = t.toLowerCase();
  if (ENUMS.has(enumName)) return pascal(enumName);
  if (upper.startsWith('VECTOR')) return 'number[]';

  return 'unknown';
}

function pascal(s) {
  return s
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join('');
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

const migrationFiles = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith('.sql'))
  .sort();

const rawSql = migrationFiles
  .map((f) => stripLineComments(readFileSync(join(MIGRATIONS_DIR, f), 'utf8')))
  .join('\n');

const sql = blankDollarBodies(rawSql);

// --- enums -----------------------------------------------------------------
for (const m of matches(sql, /CREATE\s+TYPE\s+(\w+)\s+AS\s+ENUM\s*\(/gi)) {
  const open = rawSql.indexOf('(', m.index + m[0].length - 1);
  const close = matchParen(rawSql, open);
  const values = splitTopLevel(rawSql.slice(open + 1, close)).map((v) =>
    v.trim().replace(/^'|'$/g, ''),
  );
  ENUMS.set(m[1].toLowerCase(), values);
}

// --- tables ----------------------------------------------------------------
const TABLE_CONSTRAINT_STARTS = /^(PRIMARY|FOREIGN|UNIQUE|CHECK|CONSTRAINT|EXCLUDE)\b/i;

const tables = new Map(); // name -> { columns: Map, pk: string[], uniques: string[][] }

for (const m of matches(sql, /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)\s*\(/gi)) {
  const name = m[1];
  const open = sql.indexOf('(', m.index + m[0].length - 1);
  const close = matchParen(sql, open);
  if (close === -1) continue;
  const body = sql.slice(open + 1, close);

  const table = { columns: new Map(), pk: [], uniques: [] };
  tables.set(name, table);

  for (const line of splitTopLevel(body)) {
    if (TABLE_CONSTRAINT_STARTS.test(line)) {
      const pkMatch = line.match(/^PRIMARY\s+KEY\s*\(([^)]*)\)/i);
      if (pkMatch) table.pk = pkMatch[1].split(',').map((c) => c.trim().replace(/"/g, ''));
      const uniqMatch = line.match(/^UNIQUE\s*\(([^)]*)\)/i);
      if (uniqMatch) table.uniques.push(uniqMatch[1].split(',').map((c) => c.trim()));
      continue;
    }

    const parsed = parseNameType(line);
    if (!parsed) continue;

    const { name: colName, sqlType, constraints: rest } = parsed;

    const notNull = /\bNOT\s+NULL\b/i.test(rest);
    const isPk = /\bPRIMARY\s+KEY\b/i.test(rest);
    const isUnique = /\bUNIQUE\b/i.test(rest);
    const hasDefault = /\bDEFAULT\b/i.test(rest);
    const isGenerated = /\bGENERATED\s+ALWAYS\b/i.test(rest);
    const refMatch = rest.match(/REFERENCES\s+(\w+)\s*\((\w+)\)/i);

    table.columns.set(colName, {
      name: colName,
      tsType: mapSqlType(sqlType, colName),
      nullable: !notNull && !isPk,
      hasDefault,
      isGenerated,
      isUnique,
      ref: refMatch ? { table: refMatch[1], column: refMatch[2] } : null,
    });
  }

  for (const pkCol of table.pk) {
    const col = table.columns.get(pkCol);
    if (col) col.nullable = false;
  }
}

// --- ALTER TABLE ... ADD COLUMN --------------------------------------------
// Later migrations extend tables created in earlier ones. Skipping these would
// silently drop columns (e.g. posts.images_count) from the generated types.
for (const m of matches(
  sql,
  /ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(\w+)\s+ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?([^;]+);/gis,
)) {
  const table = tables.get(m[1]);
  if (!table) continue; // e.g. a table outside the public schema
  const parsed = parseNameType(m[2].trim());
  if (!parsed) continue;
  if (table.columns.has(parsed.name)) continue; // IF NOT EXISTS: original wins

  const notNull = /\bNOT\s+NULL\b/i.test(parsed.constraints);
  const isPk = /\bPRIMARY\s+KEY\b/i.test(parsed.constraints);
  const refMatch = parsed.constraints.match(/REFERENCES\s+(\w+)\s*\((\w+)\)/i);

  table.columns.set(parsed.name, {
    name: parsed.name,
    tsType: mapSqlType(parsed.sqlType),
    nullable: !notNull && !isPk,
    hasDefault: /\bDEFAULT\b/i.test(parsed.constraints),
    isGenerated: /\bGENERATED\s+ALWAYS\b/i.test(parsed.constraints),
    isUnique: /\bUNIQUE\b/i.test(parsed.constraints),
    ref: refMatch ? { table: refMatch[1], column: refMatch[2] } : null,
  });
}

// --- views -----------------------------------------------------------------
const views = new Map();

for (const m of matches(sql, /CREATE\s+(?:OR\s+REPLACE\s+)?VIEW\s+(\w+)\s+AS\s+SELECT\s+([\s\S]*?)\bFROM\b/gi)) {
  const name = m[1];
  const columns = [];
  for (const item of splitTopLevel(m[2])) {
    const asMatch = item.match(/\bas\s+"?(\w+)"?\s*$/i);
    if (asMatch) {
      columns.push(asMatch[1]);
      continue;
    }
    // Bare reference, optionally table-qualified: `p.id`, `id`, `"id"`.
    const plain = item.match(/^(?:\w+\.)?"?(\w+)"?$/);
    if (plain) columns.push(plain[1]);
  }
  if (columns.length) views.set(name, columns);
}

// --- functions -------------------------------------------------------------
const functions = new Map();

const fnRe = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(\w+)\s*\(/gi;
for (const m of matches(sql, fnRe)) {
  const name = m[1];
  const open = sql.indexOf('(', m.index + m[0].length - 1);
  const close = matchParen(sql, open);
  if (close === -1) continue;
  const argBody = sql.slice(open + 1, close);

  // RETURNS <type> — may be TABLE(...) / SETOF <type>
  const after = sql.slice(close + 1);
  const retMatch = after.match(/^\s*RETURNS\s+/i);
  let returns = 'unknown';
  let returnsRows = null;
  if (retMatch) {
    const rest = after.slice(retMatch[0].length);
    const tableRet = rest.match(/^TABLE\s*\(/i);
    if (tableRet) {
      const tOpen = rest.indexOf('(');
      const tClose = matchParen(rest, tOpen);
      returnsRows = {};
      for (const col of splitTopLevel(rest.slice(tOpen + 1, tClose))) {
        const parsed = parseNameType(col);
        if (parsed) returnsRows[parsed.name] = mapSqlType(parsed.sqlType);
      }
      // The concrete row type is named in the emit pass (see fnRowTypes).
      returns = 'unknown';
    } else {
      const setof = rest.match(/^SETOF\s+([\w ]+?)(?=\s+(?:AS|LANGUAGE|STABLE|VOLATILE|IMMUTABLE|SECURITY)|\s*$)/i);
      const simple = rest.match(/^([\w ]+?)(?:\s*\(\s*\d+(?:,\s*\d+)?\s*\))?(?=\s+(?:AS|LANGUAGE|STABLE|VOLATILE|IMMUTABLE|SECURITY)|\s*$)/i);
      const typeStr = (setof || simple) ? (setof || simple)[1].trim() : 'unknown';
      const mapped = typeStr.toUpperCase() === 'VOID' ? 'undefined' : mapSqlType(typeStr);
      returns = setof ? `${mapped}[]` : mapped;
    }
  }

  const args = [];
  for (const a of splitTopLevel(argBody)) {
    const parsed = parseNameType(a);
    if (!parsed) continue;
    const hasDefault = /\bDEFAULT\b/i.test(parsed.constraints);
    const notNull = /\bNOT\s+NULL\b/i.test(parsed.constraints);
    args.push({
      name: parsed.name,
      tsType: mapSqlType(parsed.sqlType),
      // A DEFAULT makes the argument omittable over RPC. Without one, PostgREST
      // requires the key to be present — pass `null` explicitly for a nullable
      // argument, or the function call cannot be resolved at all.
      optional: hasDefault,
      nullable: !notNull,
    });
  }

  functions.set(name, { args, returns, returnsRows });
}

// ---------------------------------------------------------------------------
// Emit
// ---------------------------------------------------------------------------

const lines = [];
lines.push('// ---------------------------------------------------------------------------');
lines.push('// Generated by scripts/gen-db-types.mjs from supabase/migrations/*.sql');
lines.push('// DO NOT EDIT BY HAND — run `npm run gen:types` after changing a migration.');
lines.push('// ---------------------------------------------------------------------------');
lines.push('');
lines.push('export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];');
lines.push('');

// Enums
for (const [name, values] of ENUMS) {
  lines.push(`export type ${pascal(name)} = ${values.map((v) => `'${v}'`).join(' | ')};`);
}
lines.push('');

// Row interfaces
for (const [name, table] of tables) {
  lines.push(`export type ${pascal(name)}Row = {`);
  for (const col of table.columns.values()) {
    lines.push(`  ${col.name}: ${col.tsType}${col.nullable ? ' | null' : ''};`);
  }
  lines.push('};');
  lines.push('');
}

// View rows
for (const [name, cols] of views) {
  lines.push(`export type ${pascal(name)}Row = {`);
  for (const c of cols) lines.push(`  ${c}: unknown;`);
  lines.push('};');
  lines.push('');
}

// Function return row types
const fnRowTypes = new Map();
for (const [name, fn] of functions) {
  if (!fn.returnsRows) continue;
  const typeName = `${pascal(name)}Result`;
  fnRowTypes.set(name, typeName);
  lines.push(`export type ${typeName} = {`);
  for (const [k, v] of Object.entries(fn.returnsRows)) lines.push(`  ${k}: ${v};`);
  lines.push('};');
  lines.push('');
}

function insertType(col) {
  const base = `${col.tsType}${col.nullable ? ' | null' : ''}`;
  return col.optional ? `?: ${base}` : `: ${base}`;
}

lines.push('export type Database = {');
lines.push('  public: {');

// Tables
lines.push('    Tables: {');
for (const [name, table] of tables) {
  const Row = `${pascal(name)}Row`;
  lines.push(`      ${name}: {`);
  lines.push(`        Row: ${Row};`);

  const inserts = [];
  for (const col of table.columns.values()) {
    if (col.isGenerated) continue;
    col.optional = col.hasDefault || col.nullable;
    inserts.push(`          ${col.name}${insertType(col)};`);
  }
  if (inserts.length) {
    lines.push('        Insert: {');
    lines.push(...inserts);
    lines.push('        };');
  } else {
    lines.push('        Insert: Record<string, never>;');
  }

  const updates = [];
  for (const col of table.columns.values()) {
    if (col.isGenerated) continue;
    updates.push(`          ${col.name}?: ${col.tsType}${col.nullable ? ' | null' : ''};`);
  }
  if (updates.length) {
    lines.push('        Update: {');
    lines.push(...updates);
    lines.push('        };');
  } else {
    lines.push('        Update: Record<string, never>;');
  }

  const rels = [];
  for (const col of table.columns.values()) {
    if (!col.ref) continue;
    if (col.ref.table === 'auth' || col.ref.table === 'users') continue;
    const isOneToOne = table.pk.length === 1 && table.pk[0] === col.name;
    rels.push(
      `          { foreignKeyName: '${name}_${col.name}_fkey'; columns: ['${col.name}']; isOneToOne: ${isOneToOne}; referencedRelation: '${col.ref.table}'; referencedColumns: ['${col.ref.column}'] },`,
    );
  }
  lines.push('        Relationships: [');
  lines.push(...rels);
  lines.push('        ];');
  lines.push('      };');
}
lines.push('    };');

// Views
lines.push('    Views: {');
for (const [name, cols] of views) {
  lines.push(`      ${name}: {`);
  lines.push(`        Row: ${pascal(name)}Row;`);
  lines.push('        Relationships: [];');
  lines.push('      };');
}
lines.push('    };');

// Functions
lines.push('    Functions: {');
for (const [name, fn] of functions) {
  if (fn.args.length === 0) {
    // Trigger / helper functions are not callable over RPC in any useful way,
    // but declaring them with `never` args keeps the schema shape honest.
    lines.push(`      ${name}: { Args: Record<string, never>; Returns: ${fn.returns} };`);
    continue;
  }
  const argParts = fn.args.map(
    (a) => `${a.name}${a.optional ? '?' : ''}: ${a.tsType}${a.nullable ? ' | null' : ''}`,
  );
  const returns = fnRowTypes.get(name) ? `${fnRowTypes.get(name)}[]` : fn.returns;
  lines.push(`      ${name}: { Args: { ${argParts.join('; ')} }; Returns: ${returns} };`);
}
lines.push('    };');

lines.push('    Enums: {');
for (const name of ENUMS.keys()) {
  lines.push(`      ${name}: ${pascal(name)};`);
}
lines.push('    };');
lines.push('    CompositeTypes: { [_ in never]: never };');
lines.push('  };');
lines.push('};');
lines.push('');

// ---------------------------------------------------------------------------
// App-facing aliases.
//
// Components import singular names (`Profile`, `Post`, ...) while the schema
// types above are plural (`ProfilesRow`, `PostsRow`, ...). Keep the aliases
// here rather than in a hand-written file so they stay in step with the SQL.
// ---------------------------------------------------------------------------
lines.push('// --- App-facing aliases ----------------------------------------------------');
lines.push('');

const ALIASES = {
  Profile: 'profiles',
  Post: 'posts',
  Comment: 'comments',
  Like: 'likes',
  Follow: 'follows',
  Message: 'messages',
  Conversation: 'conversations',
  Notification: 'notifications',
  RegistrationApplication: 'registration_applications',
  PostImage: 'post_images',
  PostLink: 'post_links',
  Academic: 'academics',
  PushSubscription: 'push_subscriptions',
  PushOutboxItem: 'push_outbox',
};

for (const [alias, table] of Object.entries(ALIASES)) {
  if (!tables.has(table)) {
    console.error(`gen-db-types: alias ${alias} -> missing table '${table}'`);
    process.exit(1);
  }
  lines.push(`export type ${alias} = ${pascal(table)}Row;`);
}

if (views.has('public_academics')) {
  lines.push('export type PublicAcademics = PublicAcademicsRow;');
}
if (functions.has('search_all') && fnRowTypes.has('search_all')) {
  lines.push(`export type SearchResult = ${fnRowTypes.get('search_all')};`);
}

lines.push('');
lines.push('/**');
lines.push(' * A post with its author, and optionally its inline media.');
lines.push(' *');
lines.push(' * These are type aliases (not interfaces): supabase-js checks');
lines.push(' * `Row extends Record<string, unknown>`, and only object *type aliases* get');
lines.push(' * an implicit index signature. Using `interface` silently collapses the whole');
lines.push(' * schema to `never`.');
lines.push(' */');
lines.push('export type PostWithAuthor = PostsRow & {');
lines.push('  author: ProfilesRow;');
lines.push('  images?: PostImagesRow[];');
lines.push('  links?: PostLinksRow[];');
lines.push('};');
lines.push('');
lines.push('/** A comment with its author and, when threaded, its replies. */');
lines.push('export type CommentWithAuthor = CommentsRow & {');
lines.push('  author: ProfilesRow;');
lines.push('  replies?: CommentWithAuthor[];');
lines.push('};');
lines.push('');

const output = lines.join('\n');

if (CHECK) {
  const current = (() => {
    try {
      return readFileSync(OUT_FILE, 'utf8');
    } catch {
      return null;
    }
  })();
  if (current !== output) {
    console.error('src/types/database.ts is out of date. Run: npm run gen:types');
    process.exit(1);
  }
  console.log('src/types/database.ts is up to date.');
  process.exit(0);
}

writeFileSync(OUT_FILE, output);
console.log(
  `Wrote ${OUT_FILE}: ${tables.size} tables, ${views.size} views, ${functions.size} functions, ${ENUMS.size} enums.`,
);
