export default function PropertyListLoading() {
    return (
        <div className="container mx-auto px-4 py-8 pt-24">
            <div className="h-8 w-48 bg-muted rounded animate-pulse mb-8" />
            
            <div className="mb-8 p-4 bg-muted/30 rounded-lg">
                <div className="h-10 bg-muted rounded animate-pulse" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, index) => (
                    <div key={index} className="border rounded-lg overflow-hidden">
                        <div className="h-48 bg-muted animate-pulse" />
                        <div className="p-4">
                            <div className="h-6 bg-muted rounded animate-pulse mb-2" />
                            <div className="h-4 bg-muted rounded animate-pulse mb-2" />
                            <div className="h-6 bg-muted rounded animate-pulse mb-4" />
                            <div className="flex justify-between">
                                <div className="h-4 w-16 bg-muted rounded animate-pulse" />
                                <div className="h-4 w-16 bg-muted rounded animate-pulse" />
                                <div className="h-4 w-16 bg-muted rounded animate-pulse" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
} 