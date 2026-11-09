export function extractPublicId(url: string): string | null {
    const match = url.match(/\/upload\/(?:v\d+\/)?(.+)\.[^.]+$/);
    return match ? match[1] : null;
}

export function extractLocalPath(url: string): string | null {
    const match = url.match(/\/uploads\/(.+)$/);
    return match ? match[1] : null;
}

export function extractStorageId(url: string): string | null {
    return extractPublicId(url) ?? extractLocalPath(url);
}
