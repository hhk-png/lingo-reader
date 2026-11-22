import { fileURLToPath } from 'node:url'

import { nodeResolve } from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import dts from 'rollup-plugin-dts'
import esbuild from 'rollup-plugin-esbuild'
import rollupReplace from '@rollup/plugin-replace'
// import terser from '@rollup/plugin-terser'

const __filename = fileURLToPath(import.meta.url)
globalThis.__filename = __filename

function replace(opts) {
  return rollupReplace({
    ...opts,
    preventAssignment: true,
  })
}

const external = ['@lingo-reader/shared', 'jszip', 'xml2js', 'fflate']

function nodeConfig(input, output) {
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
      nodeResolve(),
      commonjs(),
      // terser({
      //   format: {
      //     comments: false,
      //   }
      // }),
    ],
  }
}

function browserConfig(input, output) {
  return {
    input,
    external,
    output: [
      {
        file: output.mjs,
        format: 'esm',
      },
      {
        file: output.cjs,
        format: 'cjs',
      },
    ],
    treeshake: {
      moduleSideEffects: false,
    },
    plugins: [
      replace({
        '__BROWSER__': JSON.stringify(true),
        'process.cwd': '(()=>"/")',
      }),
      esbuild(),
      nodeResolve(),
      commonjs(),
      // terser({
      //   format: {
      //     comments: false,
      //   }
      // }),
    ],
  }
}

function dtsConfig(input, output) {
  return {
    input,
    external,
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
  nodeConfig('./src/index.ts', {
    cjs: './dist/index.node.cjs',
    esm: './dist/index.node.mjs',
  }),
  browserConfig('./src/index.ts', {
    cjs: './dist/index.browser.cjs',
    mjs: './dist/index.browser.mjs',
  }),
  dtsConfig('./src/index.ts', './dist/index.d.ts'),
]
