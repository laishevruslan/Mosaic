import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildSchema, parse, specifiedRules, validate } from 'graphql';

import { mosaicGraphqlSdl } from '../src/adapters/http/graphql-sdl.js';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..');
const gqlRoot = join(
  repoRoot,
  'packages',
  'common',
  'graphql',
  'src',
  'graphql'
);
const wontfixPath = join(here, '..', 'docs', 'graphql-wontfix.json');

export interface GraphQLSurfaceReport {
  implemented: string[];
  wontfix: string[];
  unclassified: string[];
}

function walkGql(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkGql(full));
    } else if (entry.name.endsWith('.gql')) {
      out.push(full);
    }
  }
  return out.sort();
}

function resolveImports(file: string, seen = new Set<string>()): string {
  if (seen.has(file)) {
    return '';
  }
  seen.add(file);
  const source = readFileSync(file, 'utf8');
  const dir = dirname(file);
  const fragments: string[] = [];
  const body = source.replace(
    /^#import\s+['"]([^'"]+)['"]\s*$/gm,
    (_match, spec: string) => {
      fragments.push(resolveImports(join(dir, spec), seen));
      return '';
    }
  );
  return `${fragments.join('\n')}\n${body}`;
}

export function reportGraphqlSurface(): GraphQLSurfaceReport {
  const schema = buildSchema(mosaicGraphqlSdl);
  const wontfix = new Set(
    (JSON.parse(readFileSync(wontfixPath, 'utf8')) as string[]).map(item =>
      item.replaceAll('\\', '/')
    )
  );
  const implemented: string[] = [];
  const listed: string[] = [];
  const unclassified: string[] = [];
  for (const file of walkGql(gqlRoot)) {
    const rel = relative(gqlRoot, file).replaceAll('\\', '/');
    const source = resolveImports(file);
    const document = parse(source);
    const hasExecutable = document.definitions.some(
      def => def.kind === 'OperationDefinition'
    );
    if (!hasExecutable) {
      continue;
    }
    const errors = validate(schema, document, specifiedRules);
    if (errors.length === 0) {
      implemented.push(rel);
      continue;
    }
    if (wontfix.has(rel)) {
      listed.push(rel);
      continue;
    }
    unclassified.push(rel);
  }
  return { implemented, wontfix: listed, unclassified };
}

const isMain =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const report = reportGraphqlSurface();
  if (report.unclassified.length > 0) {
    console.error(
      'Unclassified GraphQL documents (add a resolver or list in backend/docs/graphql-wontfix.json):\n' +
        report.unclassified.map(item => `  ${item}`).join('\n')
    );
    process.exit(1);
  }
  console.log(
    `GraphQL surface: ${report.implemented.length} implemented, ${report.wontfix.length} wontfix`
  );
}
