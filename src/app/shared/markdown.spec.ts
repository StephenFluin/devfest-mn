import { renderMarkdown, storedHtml, withRenderedMarkdown } from './markdown';

describe('renderMarkdown', () => {
  it('renders Markdown to HTML', async () => {
    expect(await renderMarkdown('Hello **world**, see [my site](https://example.com).')).toContain(
      '<p>Hello <strong>world</strong>, see <a href="https://example.com">my site</a>.</p>',
    );
  });

  it('keeps a single line break, as people expect when typing a bio', async () => {
    expect(await renderMarkdown('Line one\nLine two')).toContain('<p>Line one<br>Line two</p>');
  });

  it('is null for nothing to render', async () => {
    for (const empty of ['', '  \n ', null, undefined]) {
      expect(await renderMarkdown(empty)).toBeNull();
    }
  });
});

describe('withRenderedMarkdown', () => {
  it("renders a speaker's bio alongside it", async () => {
    const saved = await withRenderedMarkdown({ name: 'Jane', bio: 'Builds *things*.' });
    expect(saved).toMatchObject({ name: 'Jane', bio: 'Builds *things*.' });
    expect(saved.renderedBio).toContain('<em>things</em>');
    expect(saved).not.toHaveProperty('renderedDescription');
  });

  it("renders a session's description alongside it", async () => {
    const saved = await withRenderedMarkdown({ title: 'Talk', description: '- one\n- two' });
    expect(saved.renderedDescription).toContain('<li>one</li>');
    expect(saved).not.toHaveProperty('renderedBio');
  });

  it('clears the HTML when the Markdown is cleared', async () => {
    expect(await withRenderedMarkdown({ bio: '' })).toEqual({ bio: '', renderedBio: null });
    expect(await withRenderedMarkdown({ description: null })).toEqual({
      description: null,
      renderedDescription: null,
    });
  });

  it("leaves the stored HTML alone when a save doesn't include the Markdown", async () => {
    const item: { published: boolean; bio?: string } = { published: true };
    expect(await withRenderedMarkdown(item)).toEqual({ published: true });
  });
});

describe('storedHtml', () => {
  it('prefers the HTML rendered when the text was saved', () => {
    expect(storedHtml('<p>Saved</p>', 'Different')).toBe('<p>Saved</p>');
  });

  it('shows text saved before rendering existed as paragraphs', () => {
    expect(storedHtml(null, 'First.\nStill first.\n\n  Second.  \n\n\n')).toBe(
      '<p>First.<br>Still first.</p><p>Second.</p>',
    );
  });

  it('escapes HTML in that older text', () => {
    expect(storedHtml(undefined, `<b>"Tom" & 'Jerry'</b>`)).toBe(
      '<p>&#60;b&#62;&#34;Tom&#34; &#38; &#39;Jerry&#39;&#60;/b&#62;</p>',
    );
  });

  it('is empty with neither', () => {
    expect(storedHtml(null, undefined)).toBe('');
  });
});
