const ESCAPES: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;'
};

/** Escapado XML mínimo para el schema fijo y plano del feed. */
export function escapeXml(value: string | number | undefined): string {
    if (value === undefined || value === null) return '';
    return String(value).replace(/[&<>"']/g, ch => ESCAPES[ch]);
}

export const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8"?>';
