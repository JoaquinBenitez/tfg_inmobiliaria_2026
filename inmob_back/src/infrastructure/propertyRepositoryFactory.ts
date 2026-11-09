import { PropertyRepository } from '../interfaces/propertyRepository';
import { MongoosePropertyRepository } from './mongoosePropertyRepository';

export class PropertyRepositoryFactory {
    private static instance: PropertyRepository | null = null;

    static getRepository(): PropertyRepository {
        if (!this.instance) {
            this.instance = new MongoosePropertyRepository();
        }
        return this.instance;
    }

    static resetInstance(): void {
        this.instance = null;
    }
}
