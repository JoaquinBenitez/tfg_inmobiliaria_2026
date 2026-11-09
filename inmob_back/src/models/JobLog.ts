import mongoose, { Schema, Document } from 'mongoose';
import { JOB_STATUSES, JOB_CHANNELS } from '../domain/syndicationTypes';

export { JOB_STATUSES, JOB_CHANNELS };
export type JobStatus = (typeof JOB_STATUSES)[number];
export type JobChannel = (typeof JOB_CHANNELS)[number];

export interface IJobLog extends Document {
    jobId: string;
    channel: JobChannel;
    propertyId: mongoose.Types.ObjectId;
    /** Snapshot desnormalizado para que el tablero de publicación sobreviva al borrado de la propiedad (C10) */
    propertyTitle: string;
    /** Referencia al artefacto externo (id de post FB / JSON con id de media IG) en intentos exitosos — el unpublish lee el último éxito */
    externalRef: string;
    status: JobStatus;
    attempt: number;
    durationMs: number;
    error: string;
    createdAt: Date;
    updatedAt: Date;
}

const JobLogSchema: Schema = new Schema({
    jobId: {
        type: String,
        required: true
    },
    channel: {
        type: String,
        enum: JOB_CHANNELS,
        required: true
    },
    propertyId: {
        type: Schema.Types.ObjectId,
        ref: 'Property',
        required: true
    },
    propertyTitle: {
        type: String,
        default: '',
        maxlength: [200, 'propertyTitle snapshot must not exceed 200 characters']
    },
    status: {
        type: String,
        enum: JOB_STATUSES,
        default: 'queued'
    },
    attempt: {
        type: Number,
        default: 0,
        min: 0
    },
    durationMs: {
        type: Number,
        default: 0,
        min: 0
    },
    error: {
        // Guarda contra stack traces sin tope; los escritores deben truncar antes de guardar
        type: String,
        default: '',
        maxlength: [2000, 'error must not exceed 2000 characters']
    },
    externalRef: {
        type: String,
        default: '',
        maxlength: [300, 'externalRef must not exceed 300 characters']
    }
}, { timestamps: true, versionKey: false });

// Log de intentos idempotente (C10): un documento por (job, intento) — un reintento
// de BullMQ que se dispare doble no puede producir filas de auditoría duplicadas.
JobLogSchema.index({ jobId: 1, attempt: 1 }, { unique: true });
JobLogSchema.index({ propertyId: 1, channel: 1, updatedAt: -1 });

export default mongoose.model<IJobLog>('JobLog', JobLogSchema);
