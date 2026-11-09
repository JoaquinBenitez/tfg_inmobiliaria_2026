import { MetricRepository } from '../interfaces/metricRepository';
import { MongooseMetricRepository } from './mongooseMetricRepository';

export class MetricRepositoryFactory {
    private static instance: MetricRepository | null = null;

    static getRepository(): MetricRepository {
        if (!this.instance) {
            this.instance = new MongooseMetricRepository();
        }
        return this.instance;
    }

    static resetInstance(): void {
        this.instance = null;
    }
}
