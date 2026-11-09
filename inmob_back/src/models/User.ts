import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
    email: string;
    password: string;
    name: string;
    role: 'admin' | 'editor';
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    comparePassword(candidatePassword: string): Promise<boolean>;
}

const UserSchema: Schema = new Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        validate: {
            validator: function(email: string) {
                // Patrón moderno pragmático (C9): local@dominio.tld — permite +tags,
                // guiones y cualquier TLD ≥ 2 caracteres. El índice unique es la verdadera
                // defensa contra duplicados; esto solo rechaza input evidentemente malformado.
                return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
            },
            message: 'Please enter a valid email address'
        }
    },
    password: {
        type: String,
        required: true,
        minlength: 6,
        select: false
    },
    name: {
        type: String,
        required: true,
        trim: true,
        minlength: 2,
        maxlength: 50
    },
    role: {
        type: String,
        enum: ['admin', 'editor'],
        default: 'editor'
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, { 
    timestamps: true,
    versionKey: false
});

// Hashear la contraseña antes de guardar
UserSchema.pre('save', async function() {
    if (!this.isModified('password')) return;

    const saltRounds = 12;
    this.password = await bcrypt.hash(this.password as string, saltRounds);
});

// Método de instancia para comparar contraseñas
UserSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
    return bcrypt.compare(candidatePassword, this.password);
};

// Índice para consultas más rápidas (el índice de email lo crea unique: true automáticamente)
UserSchema.index({ role: 1, isActive: 1 });

export default mongoose.model<IUser>('User', UserSchema);