import { JobLogRepository } from '../interfaces/jobLogRepository';
import { MongooseJobLogRepository } from './mongooseJobLogRepository';

export class JobLogRepositoryFactory {
    private static instance: JobLogRepository | null = null;

    static getRepository(): JobLogRepository {
        if (!this.instance) {
            this.instance = new MongooseJobLogRepository();
        }
        return this.instance;
    }

    static resetInstance(): void {
        this.instance = null;
    }
}
