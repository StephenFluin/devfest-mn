/**
 * Speaker bios and session descriptions are written in Markdown and rendered to HTML when they're
 * saved (renderedBio, renderedDescription), so public pages show stored HTML and never download a
 * Markdown parser. The parser is imported on demand, so only a save pulls it in.
 */

/** Markdown to HTML. Single line breaks are kept, as people expect when typing a bio. */
export async function renderMarkdown(markdown: string | null | undefined): Promise<string | null> {
  if (!markdown?.trim()) return null;
  const { marked } = await import('marked');
  return marked.parse(markdown, { async: false, gfm: true, breaks: true });
}

/**
 * Adds the rendered HTML for whichever Markdown field an item being saved includes: a speaker's bio
 * or a session's description. Clearing the Markdown clears the HTML.
 */
export async function withRenderedMarkdown<
  T extends { bio?: string | null; description?: string | null },
>(item: T): Promise<T & { renderedBio?: string | null; renderedDescription?: string | null }> {
  return {
    ...item,
    ...('bio' in item && { renderedBio: await renderMarkdown(item.bio) }),
    ...('description' in item && { renderedDescription: await renderMarkdown(item.description) }),
  };
}

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

/**
 * HTML to show for a bio or description: the HTML rendered when it was saved, or, for text saved
 * before rendering existed, the plain text as paragraphs. The result is left for Angular to
 * sanitize when bound to [innerHTML].
 */
export function storedHtml(rendered: string | null | undefined, markdown: string | undefined) {
  if (rendered) return rendered;
  return (markdown ?? '')
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`)
    .join('');
}
