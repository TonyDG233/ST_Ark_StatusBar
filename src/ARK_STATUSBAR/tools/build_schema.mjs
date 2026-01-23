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

  // 1. Bundle all schemas into a single file using esbuild
  const result = await esbuild.build({
    entryPoints: [entryPoint],
    bundle: true,
    write: false,
    format: 'iife',
    target: 'esnext',
    external: ['zod'],
    charset: 'utf8',
    globalName: 'MVUSchemas', // Expose schemas to a global object
    banner: {
      js: `import { registerMvuSchema } from 'https://testingcf.jsdelivr.net/gh/StageDog/tavern_resource/dist/util/mvu_zod.js';`
    },
    footer: {
      js: `
// Late registration after document is ready
$(() => {
  if (window.registerMvuSchema && MVUSchemas.Schema) {
    console.log('Registering MVU Schema...');
    registerMvuSchema(MVUSchemas.Schema);
    console.log('✅ MVU Schema registered.');
  } else {
    console.error('❌ Could not register MVU Schema. registerMvuSchema or Schema not found.');
  }
});
      `,
    },
  });

  const bundledCode = result.outputFiles[0].text;

  // 2. Remove all instances of "import { z } from 'zod';"
  const finalContent = bundledCode.replace(/import\s*{\s*z\s*}\s*from\s*['"]zod['"];?/g, '');
  
  // 3. Write the final bundle to the dist directory
  await fs.mkdir(path.dirname(outputFile), { recursive: true });
  await fs.writeFile(outputFile, finalContent);

  console.log(`✅ Schema bundle created successfully at ${outputFile}`);
}

build().catch(error => {
  console.error('❌ Schema bundle build failed:', error);
  process.exit(1);
});
