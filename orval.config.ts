import { defineConfig } from 'orval'

export default defineConfig({
  campus: {
    input: './contracts/backend/openapi.yaml',
    output: {
      client: 'axios-functions',
      clean: true,
      mode: 'split',
      schemas: './src/api/generated/models',
      target: './src/api/generated/client.ts',
      override: { mutator: { name: 'campusRequest', path: './src/api/campus-mutator.ts' } }
    }
  }
})
