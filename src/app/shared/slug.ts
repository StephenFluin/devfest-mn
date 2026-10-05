/** URL-friendly version of a title or name, e.g. "Hello (World)!" -> "hello-world". */
export function slugify(value: string | undefined): string {
    return (value || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

/** Plain-text first ~160 characters of a markdown string, for meta descriptions. */
export function summarize(markdown: string, max = 160): string {
    const text = markdown
        .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/[*_`#>]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    return text.length > max ? `${text.slice(0, max - 1).replace(/\s+\S*$/, '')}…` : text;
}
