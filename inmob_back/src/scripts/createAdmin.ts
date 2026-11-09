import mongoose from 'mongoose';
import User from '../models/User';
import { connectDB } from '../config/database';


/**
 * Script para crear un usuario admin por defecto para testing
 * Ejecutar con: npx ts-node src/scripts/createAdmin.ts
 */

const createDefaultAdmin = async () => {
    try {
        // Conectar a la base de datos
        await connectDB();
        
        const adminEmail = 'admin@inmob.com';
        const adminPassword = 'admin123456';
        
        // Verificar si el admin ya existe
        const existingAdmin = await User.findOne({ email: adminEmail });
        if (existingAdmin) {
            console.log('✅ Admin user already exists');
            console.log('Email:', adminEmail);
            console.log('Role:', existingAdmin.role);
            return;
        }
        
        // Crear usuario admin
        const adminUser = new User({
            email: adminEmail,
            password: adminPassword,
            name: 'Admin User',
            role: 'admin',
            isActive: true
        });
        
        await adminUser.save();
        
        console.log('🎉 Admin user created successfully!');
        console.log('Email:', adminEmail);
        console.log('Password:', adminPassword);
        console.log('Role:', adminUser.role);
        console.log('');
        console.log('🔐 You can now login at: http://localhost:3001/admin/login');
        console.log('');
        console.log('⚠️  IMPORTANT: Change the default password after first login!');
        
    } catch (error) {
        console.error('❌ Error creating admin user:', error);
    } finally {
        // Cerrar conexión a la base de datos
        await mongoose.connection.close();
        process.exit(0);
    }
};

// Ejecutar el script
createDefaultAdmin();