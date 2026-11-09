#!/usr/bin/env node
/**
 * Platform preflight — fails fast when node_modules were installed by (or
 * synced from) a different OS. Symptom this prevents: `exec: node.exe: not
 * found`, `Cannot find module '../lightningcss.win32-x64-msvc.node'`.
 *
 * Run automatically before dev/start/build/test (see package.json).
 * Fix it prints: delete node_modules + `npm ci` (per platform, per project).
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const isWin = process.platform === 'win32';
const nodeModules = join(process.cwd(), 'node_modules');
const fail = (reason, fixHint) => {
    console.error(`\n[x] ${reason}\n    ${fixHint}\n`);
    process.exit(1);
};

if (!existsSync(nodeModules)) {
    fail(
        'node_modules no existe en este proyecto.',
        'Instalá las dependencias primero: npm ci'
    );
}

// Windows npm rewrites .bin shims to call `node.exe`; on any other platform
// that string in a shim means the install came from (or through) Windows.
if (!isWin) {
    const binDir = join(nodeModules, '.bin');
    if (existsSync(binDir)) {
        for (const entry of readdirSync(binDir)) {
            const shim = join(binDir, entry);
            try {
                if (readFileSync(shim, 'utf8').includes('node.exe')) {
                    fail(
                        `node_modules contiene shims de Windows (${entry} llama a node.exe) — fueron sincronizados/copiados desde otra plataforma.`,
                        'Eliminá node_modules y reinstalá: rm -rf node_modules && npm ci  (en Windows: rmdir /s /q node_modules && npm ci). Excluí node_modules de tu herramienta de sincronización — el código viaja por git.'
                    );
                }
            } catch {
                // unreadable entry (socket, perms) — not our problem
            }
        }
    }

    // Belt and suspenders: known per-platform native packages
    const winMarkers = [
        join(nodeModules, '@img', 'sharp-win32-x64'),
        join(nodeModules, '@tailwindcss', 'oxide-win32-x64-msvc'),
        join(nodeModules, 'lightningcss-win32-x64-msvc')
    ];
    if (winMarkers.some(existsSync)) {
        fail(
            'node_modules contiene binarios nativos de Windows (sharp/tailwindcss/lightningcss win32-x64) en un entorno no-Windows.',
            'Eliminá node_modules y reinstalá: rm -rf node_modules && npm ci. Excluí node_modules de la sincronización — el código viaja por git.'
        );
    }
}

process.exit(0);
