import esbuild from 'rollup-plugin-esbuild'
import dts from 'rollup-plugin-dts'

const entryPoints = ['index', 'test-utils']

const external = ['@nulltype/event-emitter']

export default [
  {
    input: Object.fromEntries(
      entryPoints.map((entryPoint) => [entryPoint, `./src/${entryPoint}.ts`]),
    ),
    output: {
      dir: 'dist/cjs',
      format: 'cjs',
      sourcemap: false,
    },
    external,
    plugins: [esbuild()],
  },
  {
    input: Object.fromEntries(
      entryPoints.map((entryPoint) => [entryPoint, `./src/${entryPoint}.ts`]),
    ),
    output: {
      dir: 'dist/esm',
      format: 'esm',
      sourcemap: false,
    },
    external,
    plugins: [esbuild()],
  },
  {
    input: Object.fromEntries(
      entryPoints.map((entryPoint) => [entryPoint, `./src/${entryPoint}.ts`]),
    ),
    output: {
      dir: 'dist/types',
      format: 'es',
    },
    external,
    plugins: [dts()],
  },
]
