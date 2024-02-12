import * as esbuild from 'esbuild'

await esbuild.build({
    entryPoints: ['./src/index.ts'],
    bundle: true,
    outdir: 'dist/code-customizations',
    minify: true,
    treeShaking: true,
    logLevel: 'debug',
    target: 'node18',
    platform: 'node'
})
