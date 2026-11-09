export const constants = {
    development: {
        apiTimeout: 5000,
        maxFileSize: 5242880, // 5MB
        allowedFileTypes: ['image/jpeg', 'image/png'],
        imageQuality: 80,
    },
    production: {
        apiTimeout: 3000,
        maxFileSize: 2097152, // 2MB
        allowedFileTypes: ['image/jpeg'],
        imageQuality: 70,
    },
} as const; 