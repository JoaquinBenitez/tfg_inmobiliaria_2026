import mongoose, { Schema, Document } from 'mongoose';

export interface ISiteSettings extends Document {
    key: string;
    heroImages: string[];
    heroTitle: string;
    heroSubtitle: string;
}

const SiteSettingsSchema: Schema = new Schema({
    key: {
        type: String,
        required: true,
        unique: true,
        default: 'site_settings'
    },
    heroImages: {
        type: [String],
        default: [],
        validate: {
            validator: function (val: string[]) {
                return val.length <= 3;
            },
            message: 'Maximum 3 hero images allowed'
        }
    },
    heroTitle: {
        type: String,
        default: '',
        maxlength: [200, 'Hero title must not exceed 200 characters']
    },
    heroSubtitle: {
        type: String,
        default: '',
        maxlength: [300, 'Hero subtitle must not exceed 300 characters']
    },
}, { timestamps: true, versionKey: false });

/**
 * Obtiene el documento singleton de settings, creándolo si no existe
 */
SiteSettingsSchema.statics.getSettings = async function (): Promise<ISiteSettings> {
    return this.findOneAndUpdate(
        { key: 'site_settings' },
        { $setOnInsert: { key: 'site_settings' } },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    ).lean();
};

export default mongoose.model<ISiteSettings>('SiteSettings', SiteSettingsSchema);
