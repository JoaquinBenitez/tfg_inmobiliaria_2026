export const routes = {
    sale: {
        base: '/venta',
        houses: '/venta?propertyType=casa',
        apartments: '/venta?propertyType=departamento',
        land: '/venta?propertyType=terreno',
    },
    rent: {
        base: '/alquiler',
        houses: '/alquiler?propertyType=casa',
        apartments: '/alquiler?propertyType=departamento',
        offices: '/alquiler?propertyType=oficina',
    },
    about: '/nosotros',
} as const; 