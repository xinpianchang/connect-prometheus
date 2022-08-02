import { defineConfig } from 'rollup'
import swc from 'rollup-plugin-swc'
import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import pkg from './package.json'

const external = [
  ...Object.keys(pkg.dependencies || {}),
  ...Object.keys(pkg.optionalDependencies || {}),
  ...Object.keys(pkg.devDependencies || {}),
]

export default defineConfig({
  input: 'src/index.ts',
  output: {
    dir: './dist',
    format: 'cjs',
    indent: false,
    exports: 'default',
  },
  external,
  plugins: [
    resolve({
      extensions: ['.ts', '.js', '.json'],
      preferBuiltins: true,
    }),
    commonjs({ sourceMap: false }),
    swc({
      jsc: {
        parser: {
          syntax: 'typescript',
        },
        target: 'es2018',
        // externalHelpers: true,
      }
    }),
    // babel({
    //   extensions,
    //   include: ['src/**/*'],
    //   babelHelpers: 'bundled',
    // }),
  ],
})
