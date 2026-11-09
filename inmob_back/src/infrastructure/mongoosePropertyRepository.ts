import Property from '../models/Property';
import {
    PropertyEntity,
    NewProperty,
    PropertyUpdate,
    PropertyCriteria,
    SortField,
    SortOrder
} from '../domain/property';
import { PropertyRepository, PropertyListResult, NearbyQuery, BoundsQuery, UpdateOptions } from '../interfaces/propertyRepository';
import {
    documentToProperty,
    newPropertyToDocument,
    propertyUpdateToDocument,
    criteriaToFilter,
    notDeletedFilter
} from './propertyMapper';

const SORT_DIRECTION: Record<SortOrder, 1 | -1> = { asc: 1, desc: -1 };

export class MongoosePropertyRepository implements PropertyRepository {
    async list(options: {
        criteria: PropertyCriteria;
        sort: SortField;
        order: SortOrder;
        skip: number;
        limit: number;
    }): Promise<PropertyListResult> {
        const { criteria, sort, order, skip, limit } = options;
        const filter = { ...criteriaToFilter(criteria), ...notDeletedFilter(criteria) };
        const [docs, totalCount] = await Promise.all([
            Property.find(filter)
                .sort({ [sort]: SORT_DIRECTION[order] })
                .skip(skip)
                .limit(limit)
                .lean(),
            Property.countDocuments(filter)
        ]);
        return {
            properties: docs.map(documentToProperty),
            total: totalCount
        };
    }

    async findById(id: string): Promise<PropertyEntity | null> {
        const doc = await Property.findOne({ _id: id, deletedAt: null }).lean();
        return doc ? documentToProperty(doc) : null;
    }

    async create(data: NewProperty): Promise<PropertyEntity> {
        const saved = await Property.create(newPropertyToDocument(data));
        return documentToProperty(saved.toObject());
    }

    async findByIdAndUpdate(id: string, update: PropertyUpdate, options: UpdateOptions = {}): Promise<PropertyEntity | null> {
        const doc = await Property.findOneAndUpdate(
            { _id: id, deletedAt: null },
            propertyUpdateToDocument(update),
            {
                returnDocument: 'after',
                runValidators: options.runValidators ?? false
            }
        ).lean();
        return doc ? documentToProperty(doc) : null;
    }

    async softDelete(id: string): Promise<PropertyEntity | null> {
        const doc = await Property.findOneAndUpdate(
            { _id: id, deletedAt: null },
            { $set: { deletedAt: new Date() } },
            { returnDocument: 'after' }
        ).lean();
        return doc ? documentToProperty(doc) : null;
    }

    async findByCriteria(criteria: PropertyCriteria): Promise<PropertyEntity[]> {
        const docs = await Property
            .find({ ...criteriaToFilter(criteria), ...notDeletedFilter(criteria) })
            .lean();
        return docs.map(documentToProperty);
    }

    async findFeatured(): Promise<PropertyEntity[]> {
        const docs = await Property
            .find({ featured: true, deletedAt: null })
            .sort({ updatedAt: -1 })
            .lean();
        return docs.map(documentToProperty);
    }

    async findInBounds(query: BoundsQuery): Promise<PropertyEntity[]> {
        const { northEast, southWest } = query;
        const docs = await Property.find({
            'location.coordinates': {
                $geoWithin: {
                    $box: [
                        [southWest.lng, southWest.lat],
                        [northEast.lng, northEast.lat]
                    ]
                }
            },
            deletedAt: null
        }).lean();
        return docs.map(documentToProperty);
    }

    async aggregateNearby(query: NearbyQuery): Promise<(PropertyEntity & { distance: number })[]> {
        const { center, radiusInMeters, limit } = query;
        const docs = await Property.aggregate([
            {
                $geoNear: {
                    near: {
                        type: 'Point',
                        coordinates: [center.lng, center.lat]
                    },
                    distanceField: 'distance',
                    maxDistance: radiusInMeters,
                    spherical: true,
                    distanceMultiplier: 0.001
                }
            },
            { $match: { deletedAt: null } },
            { $limit: limit }
        ]);
        return docs.map((doc) => ({ ...documentToProperty(doc), distance: Number(doc.distance ?? 0) }));
    }
}
