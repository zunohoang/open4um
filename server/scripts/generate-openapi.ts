import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { buildOpenApi } from '../src/docs/buildOpenApi'

const destination = resolve(__dirname, '../src/docs/swagger.json')
const content = JSON.stringify(buildOpenApi(), null, 2) + '\n'
if (process.argv.includes('--check')) {
  if (readFileSync(destination, 'utf8').replace(/\r\n/g, '\n') !== content) {
    throw new Error('swagger.json is stale; run npm run docs:generate')
  }
  console.log('OpenAPI document matches validators and implemented routes.')
} else {
  writeFileSync(destination, content)
  console.log('Generated ' + destination)
}
