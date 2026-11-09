'use client';

export default function PropertyListError({
    error,
    reset,
}: {
    error: Error;
    reset: () => void;
}) {
    return (
        <div className="container mx-auto px-4 py-8 pt-24">
            <div className="text-center">
                <h2 className="text-2xl font-bold text-destructive mb-4">
                    Error al cargar las propiedades
                </h2>
                <p className="text-muted-foreground mb-4">{error.message}</p>
                <button
                    onClick={reset}
                    className="bg-primary text-primary-foreground px-4 py-2 rounded hover:bg-primary/90 transition-colors"
                >
                    Intentar nuevamente
                </button>
            </div>
        </div>
    );
} 