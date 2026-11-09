import mongoose from 'mongoose';
import path from 'path';
import fs from 'fs';
import Metric from '../models/Metric';
import { MongooseMetricRepository } from '../infrastructure/mongooseMetricRepository';
import { metricService } from '../application/metricService';
import { METRIC_TTL_DAYS } from '../domain/metricTypes';


const DAYS = parseInt(process.env.METRICS_REPORT_DAYS ?? '90', 10);
const OUT_DIR = path.resolve(__dirname, '../../../docs/metrics');

async function main(): Promise<void> {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error('MONGODB_URI is required');
        process.exit(1);
    }

    await mongoose.connect(uri);
    const repo = new MongooseMetricRepository();
    const since = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000);

    const [summary, totalCount, firstDoc, lastDoc] = await Promise.all([
        metricService.getSummary(repo, { since }),
        Metric.countDocuments({}),
        Metric.find({}).sort({ timestamp: 1 }).limit(1).lean(),
        Metric.find({}).sort({ timestamp: -1 }).limit(1).lean(),
    ]);

    const report = {
        reportType: 'core-web-vitals-fps-baseline',
        phase: 'phase-1-metrics',
        thesisNote: 'Pre-360° baseline: captured before the WebGL viewer exists (ROADMAP.md Phase 1)',
        generatedAt: new Date().toISOString(),
        retentionDays: METRIC_TTL_DAYS,
        period: { days: DAYS, since: since.toISOString() },
        dataCoverage: {
            totalDocuments: totalCount,
            earliest: firstDoc[0] ? String(firstDoc[0].timestamp) : null,
            latest: lastDoc[0] ? String(lastDoc[0].timestamp) : null,
        },
        summary,
    };

    fs.mkdirSync(OUT_DIR, { recursive: true });
    const date = new Date().toISOString().slice(0, 10);
    const outFile = path.join(OUT_DIR, `metrics-baseline-${date}.json`);
    fs.writeFileSync(outFile, JSON.stringify(report, null, 2), 'utf8');

    console.log(`Report written to ${outFile}`);
    console.log(`Documents in window: ${summary.total} (of ${totalCount} total)`);

    await mongoose.disconnect();
}

main().catch(async (err) => {
    console.error('Export failed:', err);
    await mongoose.disconnect().catch(() => undefined);
    process.exit(1);
});
