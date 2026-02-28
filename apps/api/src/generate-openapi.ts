import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from './server.js';

const app = await createServer();
await app.ready();
const spec = app.swagger();
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const outputPath = path.resolve(currentDir, '../openapi.json');
writeFileSync(outputPath, JSON.stringify(spec, null, 2));
await app.close();
console.log(`OpenAPI written to ${outputPath}`);
