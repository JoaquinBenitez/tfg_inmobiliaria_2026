/**
 * Lighthouse runner — repeatable before/after methodology for the thesis.
 *
 * Audits (performance category only, mobile emulation by default):
 *   - /                (home)
 *   - /venta           (listing page)
 *   - /propiedades/:id (property detail — auto-fetched from the backend API;
 *                       this is where the 360° tour will land in Phase 2, so it
 *                       is the critical LCP before/after page)
 *
 * Usage:
 *   npm run lighthouse -- --label before          # Phase 1 baseline (pre-360°)
 *   npm run lighthouse -- --label after           # Phase 4 final run
 *   npm run lighthouse -- --emulation desktop     # desktop preset instead
 *   npm run lighthouse -- --urls /,/alquiler      # explicit page list
 *
 * Artifacts are written to docs/lighthouse/<label>-<YYYY-MM-DD>/ at the repo
 * root: one JSON + HTML report per page, plus a summary.json with the key
 * metrics for easy before/after diffing.
 *
 * Requirements: a Chrome/Chromium binary (set CHROME_PATH if not in a standard
 * location) and the dev servers running (frontend :3001, backend :3000).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as lighthouseModule from 'lighthouse';
import * as chromeLauncherModule from 'chrome-launcher';

const lighthouse = lighthouseModule.default ?? lighthouseModule;
const chromeLauncher = chromeLauncherModule.default ?? chromeLauncherModule;
const { launch } = chromeLauncher;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOCS_DIR = path.resolve(__dirname, '../../docs/lighthouse');

const FRONTEND_ORIGIN = process.env.LIGHTHOUSE_ORIGIN ?? 'http://localhost:3001';
const API_URL = process.env.LIGHTHOUSE_API_URL ?? 'http://localhost:3000/api';

const AUDITS = {
    fcp: 'first-contentful-paint',
    lcp: 'largest-contentful-paint',
    tbt: 'total-blocking-time',
    cls: 'cumulative-layout-shift',
    si: 'speed-index',
};

function parseArgs(argv) {
    const args = { label: 'run', emulation: 'mobile', urls: null, runs: 1 };
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--label') args.label = argv[++i];
        else if (argv[i] === '--emulation') args.emulation = argv[++i];
        else if (argv[i] === '--urls') args.urls = argv[++i].split(',').map((u) => u.trim());
        else if (argv[i] === '--runs') args.runs = Math.max(1, parseInt(argv[++i], 10) || 1);
    }
    if (!['mobile', 'desktop'].includes(args.emulation)) {
        throw new Error(`Invalid emulation '${args.emulation}' (expected mobile|desktop)`);
    }
    return args;
}

function screenEmulation(emulation) {
    return emulation === 'mobile'
        ? { mobile: true, width: 412, height: 823, deviceScaleFactor: 1.75, disabled: false }
        : { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false };
}

function slugFor(pathname) {
    return pathname === '/' ? 'home' : pathname.replaceAll('/', '-').replace(/^-/, '');
}

async function fetchPropertyPath() {
    try {
        const res = await fetch(`${API_URL}/properties/all?limit=1`);
        if (!res.ok) throw new Error(`API responded ${res.status}`);
        const body = await res.json();
        const property = body.properties?.[0];
        if (property?._id) return `/propiedades/${property._id}`;
    } catch (err) {
        console.warn(`⚠ Could not auto-fetch a property page (${err.message}); auditing without it.`);
    }
    return null;
}

function extractSummary(lhr) {
    const metrics = {};
    for (const [key, auditId] of Object.entries(AUDITS)) {
        const audit = lhr.audits[auditId];
        if (!audit) continue;
        metrics[key] = {
            id: auditId,
            title: audit.title,
            displayValue: audit.displayValue ?? null,
            value: typeof audit.numericValue === 'number' ? Math.round(audit.numericValue) : null,
            score: audit.score,
        };
    }
    return {
        score: typeof lhr.categories?.performance?.score === 'number'
            ? Math.round(lhr.categories.performance.score * 100)
            : null,
        metrics,
    };
}

async function auditPage(chrome, url, emulation) {
    const flags = {
        port: chrome.port,
        output: ['json', 'html'],
        logLevel: 'error',
    };
    const config = {
        extends: 'lighthouse:default',
        settings: {
            onlyCategories: ['performance'],
            formFactor: emulation,
            screenEmulation: screenEmulation(emulation),
            throttlingMethod: 'simulate',
            maxWaitForLoad: 45_000,
        },
    };
    const result = await lighthouse(url, flags, config);
    const [jsonReport, htmlReport] = result.report;
    return { lhr: JSON.parse(jsonReport), files: { json: jsonReport, html: htmlReport } };
}

async function main() {
    const args = parseArgs(process.argv.slice(2));

    let paths = args.urls;
    if (!paths) {
        const propertyPath = await fetchPropertyPath();
        paths = ['/', '/venta', ...(propertyPath ? [propertyPath] : [])];
    }

    const date = new Date().toISOString().slice(0, 10);
    const outDir = path.join(DOCS_DIR, `${args.label}-${date}`);
    fs.mkdirSync(outDir, { recursive: true });

    const chromeFlags = ['--headless=new'];
    if (process.getuid?.() === 0) chromeFlags.push('--no-sandbox'); // root containers

    console.log(`Lighthouse run '${args.label}' (${args.emulation} emulation)`);
    console.log(`Pages: ${paths.join(', ')}`);
    console.log(`Output: ${outDir}\n`);

    let chrome;
    const summary = {
        label: args.label,
        emulation: args.emulation,
        generatedAt: new Date().toISOString(),
        origin: FRONTEND_ORIGIN,
        pages: [],
    };

    try {
        try {
            chrome = await launch({ chromeFlags });
        } catch (err) {
            console.error(
                `✗ Could not launch Chrome/Chromium (${err.message}).\n` +
                    '  Install Chrome or point CHROME_PATH at a Chromium binary.'
            );
            process.exit(1);
        }

        for (const pagePath of paths) {
            const url = `${FRONTEND_ORIGIN}${pagePath}`;
            const slug = slugFor(pagePath);
            process.stdout.write(`  ${pagePath} ... `);
            try {
                const { lhr, files } = await auditPage(chrome, url, args.emulation);
                fs.writeFileSync(path.join(outDir, `${slug}.json`), files.json, 'utf8');
                fs.writeFileSync(path.join(outDir, `${slug}.html`), files.html, 'utf8');
                const pageSummary = { path: pagePath, url, ...extractSummary(lhr) };
                summary.pages.push(pageSummary);
                console.log(`score ${pageSummary.score} · LCP ${pageSummary.metrics.lcp?.displayValue ?? '—'}`);
            } catch (err) {
                summary.pages.push({ path: pagePath, url, error: err.message });
                console.log(`FAILED (${err.message})`);
            }
        }
    } finally {
        if (chrome) await chrome.kill();
    }

    fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2), 'utf8');
    console.log(`\nSummary written to ${path.join(outDir, 'summary.json')}`);

    const succeeded = summary.pages.filter((p) => !p.error);
    process.exit(succeeded.length > 0 ? 0 : 1);
}

main();
