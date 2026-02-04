import * as esbuild from 'esbuild';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const entryPoint = path.resolve(__dirname, '../mvu/index.ts');
const outputFile = path.resolve(__dirname, '../../../dist/artifacts/mvu_schema_bundle.js');

async function build() {
  console.log('Starting schema bundle build...');

  // 1. Bundle all schemas into a single ESM file
  const result = await esbuild.build({
    entryPoints: [entryPoint],
    bundle: true,
    write: false,
    format: 'esm',
    target: 'esnext',
    external: ['zod', 'lodash'],
    charset: 'utf8',
  });

  let bundledCode = result.outputFiles[0].text;

  // 2. Remove import statements for external globals
  bundledCode = bundledCode.replace(/import\s*.*?from\s*['"]zod['"];?/g, '');
  bundledCode = bundledCode.replace(/import\s*.*?from\s*['"]lodash['"];?/g, '');
  
  // 3. CRITICAL: Replace all aliased variables (e.g., z2, z3, _2) back to the global variables (z, _)
  // esbuild renames imports to avoid collisions, we need to revert this.
  // This regex finds variables like z2, z3, _2, etc., and replaces them with z, _.
  bundledCode = bundledCode.replace(/\b(z)\d+\b/g, '$1');
  bundledCode = bundledCode.replace(/\b(_)\d+\b/g, '$1');

  // 4. Convert exports to local variables for script format
  bundledCode = bundledCode.replace(/export\s+const\s+/g, 'const ');
  bundledCode = bundledCode.replace(/export\s*{[^}]*};?/g, '');

  // 5. Wrap in the MVU registration boilerplate
  const finalContent = `
import { registerMvuSchema } from 'https://testingcf.jsdelivr.net/gh/StageDog/tavern_resource/dist/util/mvu_zod.js';

// --- Start of Bundled Schemas ---
${bundledCode.trim()}
// --- End of Bundled Schemas ---

$(() => {
  if (typeof Schema !== 'undefined') {
    console.log('Registering MVU Schema...');
    registerMvuSchema(Schema);
    console.log('✅ MVU Schema registered.');
  } else {
    console.error('❌ Schema variable is undefined. Check bundle logic.');
  }
});
`;

  // 6. Write the final bundle
  await fs.mkdir(path.dirname(outputFile), { recursive: true });
  await fs.writeFile(outputFile, finalContent.trim());

  console.log(`✅ Schema bundle created successfully at ${outputFile}`);
}

build().catch(error => {
  console.error('❌ Schema bundle build failed:', error);
  process.exit(1);
});

