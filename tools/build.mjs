#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, '..');
const dist = resolve(root, 'dist');

function run(command) {
  execSync(command, {
    cwd: root,
    stdio: 'inherit'
  });
}

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

run('npx tsc --project tsconfig.json');

cpSync(resolve(root, 'manifest.json'), resolve(dist, 'manifest.json'));
cpSync(resolve(root, 'icons'), resolve(dist, 'icons'), { recursive: true });
cpSync(resolve(root, 'assets'), resolve(dist, 'assets'), { recursive: true });
cpSync(resolve(root, 'pages'), resolve(dist, 'pages'), { recursive: true });
cpSync(resolve(root, 'css'), resolve(dist, 'css'), { recursive: true });
