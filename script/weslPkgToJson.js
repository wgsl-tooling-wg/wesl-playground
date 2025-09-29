#!/usr/bin/env node

import * as fs from 'fs'
import * as path from 'path'

function readModule(dir, mod, files = {}) {
  const parent = path.dirname(dir)
  const base = path.basename(dir)
  const file = path.join(parent, base + '.wesl')

  console.log('processing module', mod)

  const fileStat = fs.statSync(file, { throwIfNoEntry: false })
  if (fileStat && fileStat.isFile()) {
    const src = fs.readFileSync(file, 'utf-8')
    files[mod] = src
  }

  const dirStat = fs.statSync(dir, { throwIfNoEntry: false })
  if (dirStat && dirStat.isDirectory()) {
    for (const entry of fs.readdirSync(dir)) {
      const name = path.basename(entry, '.wesl')
      const subDir = path.join(dir, name)
      const subMod = `${mod}::${name}`
      // TODO: this is processed twice, for the file and the dir of same name.
      // doesn't matter, they produce the same result.
      readModule(subDir, subMod, files)
    }
  }

  return files
}

function help(script) {
  script = path.basename(script)
  console.error(`Usage: ${script} <pkgName> <inputPath> <outputPath>`)
  console.error()
  console.error('Write a WESL package to a single JSON database.')
  console.error(' - pkgName: package name')
  console.error(' - inputPath: package root directory to read')
  console.error(' - outputPath: JSON database file to write')
}

const [_node, script, pkgName, inputPath, outputPath] = process.argv

if (!inputPath || !outputPath) {
  help(script)
  process.exit(1)
}

const files = readModule(inputPath, pkgName)
fs.writeFileSync(outputPath, JSON.stringify(files))
