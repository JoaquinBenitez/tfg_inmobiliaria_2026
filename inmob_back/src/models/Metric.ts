import mongoose, { Schema, Document } from 'mongoose';
import { METRIC_NAMES, RATINGS, METRIC_TTL_DAYS, MetricName, Rating } from '../domain/metricTypes';

export interface IMetric extends Document {
    metric: MetricName;
    value: number;
    rating: Rating;
    pagePath: string;
    sessionId: string;
    detail?: Record<string, number>;
    userAgent: string;
    connection: string;
    timestamp: Date;
}

const MetricSchema: Schema = new Schema({
    metric: {
        type: String,
        enum: METRIC_NAMES,
        required: true,
        index: false
    },
    value: {
        type: Number,
        required: true,
        min: [0, 'Metric value must be non-negative']
    },
    rating: {
        type: String,
        enum: RATINGS,
        required: true
    },
    pagePath: {
        type: String,
        required: true,
        maxlength: [200, 'pagePath must not exceed 200 characters']
    },
    sessionId: {
        type: String,
        required: true,
        maxlength: [64, 'sessionId must not exceed 64 characters']
    },
    detail: {
        type: Map,
        of: Number,
        default: undefined
    },
    userAgent: {
        type: String,
        default: ''
    },
    connection: {
        type: String,
        default: ''
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
}, { timestamps: false, versionKey: false });

MetricSchema.index({ metric: 1, timestamp: -1 });
MetricSchema.index({ pagePath: 1, timestamp: -1 });
// C14: el endpoint de resumen filtra métrica + pagePath juntos
MetricSchema.index({ metric: 1, pagePath: 1, timestamp: -1 });
MetricSchema.index(
    { timestamp: 1 },
    { expireAfterSeconds: METRIC_TTL_DAYS * 24 * 60 * 60, name: 'timestamp_ttl' }
);

export default mongoose.model<IMetric>('Metric', MetricSchema);
