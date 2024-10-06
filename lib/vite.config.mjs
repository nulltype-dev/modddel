/// <reference types="vitest" />
import { defineConfig } from 'vite'

export default defineConfig({
  test: {
    coverage: {
      all: true,
      exclude: ['src/index.ts', 'src/**/types.ts'],
      include: ['src/**/*.ts'],
    },
    globals: true,
    root: './',
  },
})
