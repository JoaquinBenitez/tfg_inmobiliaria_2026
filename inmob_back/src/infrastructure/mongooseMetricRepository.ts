import Metric from '../models/Metric';
import {
    MetricRepository,
    MetricRecordInsert,
    MetricSummaryQuery
} from '../interfaces/metricRepository';

export class MongooseMetricRepository implements MetricRepository {
    async insertBatch(records: MetricRecordInsert[]): Promise<number> {
        if (records.length === 0) return 0;
        const docs = await Metric.insertMany(records, { ordered: false });
        return docs.length;
    }

    async fetchSummaryWindow(query: MetricSummaryQuery): Promise<MetricRecordInsert[]> {
        const filter: Record<string, unknown> = { timestamp: { $gte: query.since } };
        if (query.metric) filter.metric = query.metric;
        if (query.pagePath) filter.pagePath = query.pagePath;

        const docs = await Metric.find(filter)
            .sort({ timestamp: -1 })
            .limit(10000)
            .lean();

        return docs.map((doc) => {
            const d = doc as Record<string, any>;
            const detail = d.detail && typeof d.detail === 'object' && typeof d.detail.toJSON === 'function'
                ? d.detail.toJSON()
                : d.detail;
            return {
                metric: d.metric,
                value: d.value,
                rating: d.rating,
                pagePath: d.pagePath,
                sessionId: d.sessionId,
                detail,
                userAgent: d.userAgent,
                connection: d.connection,
                timestamp: d.timestamp
            };
        });
    }
}
