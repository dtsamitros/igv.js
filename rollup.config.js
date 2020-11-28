/**
 * Build configuration
 */

import resolve from 'rollup-plugin-node-resolve';
import babel from 'rollup-plugin-babel';
import strip from 'rollup-plugin-strip';
import commonjs from '@rollup/plugin-commonjs';
import { terser } from 'rollup-plugin-terser'

import pkg from './package.json';

export default [

    {
        input: 'src/main.js',
        output: [
            { file: pkg.main, format: 'cjs' },
            { file: pkg.module, format: 'es' },
            { file: pkg.main.replace(/\.js$/, '.min.js'), format: 'cjs', sourcemap: true, plugins: [terser()] },
            { file: pkg.module.replace(/\.js$/, '.min.js'), format: 'es', sourcemap: true, plugins: [terser()] }
        ],
        plugins: [
            strip({
                debugger: true,
                functions: ['console.log', 'assert.*', 'debug']
            })
        ]
    },

    {
        input: 'src/main.js',
        output: [
            { file: pkg.browser, format: 'umd', name: 'igvData' },
            { file: pkg.browser.replace(/\.js$/, '.min.js'), format: 'umd', name: 'igvData', sourcemap: true, plugins: [terser()] },
        ],
        plugins: [
            strip({
                debugger: true,
                functions: ['console.log', 'assert.*', 'debug']
            }),
            commonjs(),
            resolve(),
            babel()
        ]
    },
];
