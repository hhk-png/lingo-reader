import { fileURLToPath } from 'node:url'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import dts from 'rollup-plugin-dts'
import esbuild from 'rollup-plugin-esbuild'
import rollupReplace from '@rollup/plugin-replace'

const __filename = fileURLToPath(import.meta.url)
globalThis.__filename = __filename

function replace(opts) {
  return rollupReplace({
    ...opts,
    preventAssignment: true,
  })
}

function resolve(opts) {
  return nodeResolve({
    ...opts,
    preferBuiltins: true,
    resolveOnly: ['events'],
  })
}

const external = ['path-browserify', 'sax', 'events']

function commonjsAndEsmConfig(input, output) {
  return {
    input,
    external,
    output: [
      {
        file: output.cjs,
        format: 'cjs',
      },
      {
        file: output.esm,
        format: 'esm',
      },
    ],
    treeshake: {
      moduleSideEffects: false,
    },
    plugins: [
      replace({
        __BROWSER__: JSON.stringify(false),
      }),
      esbuild(),
      resolve(),
      commonjs(),
    ],
  }
}

function browserConfig(input, output) {
  return {
    input,
    external,
    output: [
      {
        file: output,
        format: 'esm',
      },
    ],
    treeshake: {
      moduleSideEffects: false,
    },
    plugins: [
      replace({
        __BROWSER__: JSON.stringify(true),
      }),
      esbuild(),
      resolve(),
      commonjs(),
    ],
  }
}

function dtsConfig(input, output) {
  return {
    input,
    external: [...external, 'buffer'],
    output: [
      {
        file: output,
        format: 'es',
      },
    ],
    plugins: [dts()],
  }
}

export default [
  // reader.ts
  commonjsAndEsmConfig('./src/index.ts', {
    cjs: './dist/index.cjs',
    esm: './dist/index.mjs',
  }),
  browserConfig('./src/index.ts', './dist/index.browser.mjs'),
  dtsConfig('./src/index.ts', './dist/index.d.ts'),
]
