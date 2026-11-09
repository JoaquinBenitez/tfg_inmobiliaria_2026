import JobLog from '../models/JobLog';
import {
    JobLogRepository,
    JobLogAttemptRecord,
    JobLogDashboardEntry
} from '../interfaces/jobLogRepository';
import { JobChannel } from '../domain/syndicationTypes';

const MAX_ERROR_LENGTH = 2000;

/**
 * Trunca al tope del schema — los escritores son dueños de este contrato (C10).
 * Los stack traces se truncan por el principio (la cabeza informativa está al comienzo).
 */
function truncateError(error: string | undefined): string {
    if (!error) return '';
    return error.length > MAX_ERROR_LENGTH ? error.slice(0, MAX_ERROR_LENGTH - 3) + '...' : error;
}

export class MongooseJobLogRepository implements JobLogRepository {
    async recordAttempt(record: JobLogAttemptRecord): Promise<void> {
        await JobLog.updateOne(
            { jobId: record.jobId, attempt: record.attempt },
            {
                $set: {
                    jobId: record.jobId,
                    channel: record.channel,
                    propertyId: record.propertyId,
                    propertyTitle: record.propertyTitle,
                    status: record.status,
                    attempt: record.attempt,
                    durationMs: record.durationMs ?? 0,
                    error: truncateError(record.error),
                    externalRef: record.externalRef ?? ''
                }
            },
            { upsert: true }
        );
    }

    async findLatestSuccess(propertyId: string, channel: JobChannel) {
        const doc = await JobLog
            .findOne({ propertyId, channel, status: 'success', externalRef: { $ne: '' } })
            .sort({ updatedAt: -1 })
            .lean();
        if (!doc) return null;
        return {
            externalRef: doc.externalRef,
            propertyTitle: doc.propertyTitle ?? ''
        };
    }

    async countRecentSuccesses(channel: JobChannel, sinceMs: number): Promise<number> {
        return JobLog.countDocuments({
            channel,
            status: 'success',
            updatedAt: { $gte: new Date(Date.now() - sinceMs) }
        });
    }

    async findLatestPerPropertyChannel(): Promise<JobLogDashboardEntry[]> {
        const rows = await JobLog.aggregate([
            { $sort: { propertyId: 1, channel: 1, updatedAt: -1 } },
            {
                $group: {
                    _id: { propertyId: '$propertyId', channel: '$channel' },
                    jobId: { $first: '$jobId' },
                    propertyTitle: { $first: '$propertyTitle' },
                    status: { $first: '$status' },
                    attempt: { $first: '$attempt' },
                    durationMs: { $first: '$durationMs' },
                    error: { $first: '$error' },
                    externalRef: { $first: '$externalRef' },
                    lastAttemptAt: { $first: '$updatedAt' }
                }
            },
            { $sort: { lastAttemptAt: -1 } }
        ]);
        return rows.map(row => ({
            jobId: row.jobId,
            propertyId: String(row._id.propertyId),
            propertyTitle: row.propertyTitle ?? '',
            channel: row._id.channel,
            status: row.status,
            attempt: row.attempt,
            durationMs: row.durationMs,
            error: row.error ?? '',
            externalRef: row.externalRef ?? '',
            lastAttemptAt: row.lastAttemptAt
        }));
    }
}
