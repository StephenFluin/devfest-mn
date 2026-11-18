import { slugify, speakerPromoCode, summarize } from './slug';

describe('slugify', () => {
  it('lowercases and joins words with single dashes', () => {
    expect(slugify('Hello (World)!')).toBe('hello-world');
    expect(slugify("What's your rate? Billing for human effort")).toBe(
      'what-s-your-rate-billing-for-human-effort',
    );
  });

  it('drops dashes from both ends', () => {
    expect(slugify('  --AI & Agents--  ')).toBe('ai-agents');
  });

  it('is empty for a missing or symbol-only value', () => {
    expect(slugify(undefined)).toBe('');
    expect(slugify('***')).toBe('');
  });
});

describe('speakerPromoCode', () => {
  it("is the speaker's name in capitals with dashes", () => {
    expect(speakerPromoCode('Jane Doe')).toBe('JANE-DOE');
    expect(speakerPromoCode('Barry S. Stahl')).toBe('BARRY-S-STAHL');
  });

  it("stays within Eventbrite's 30 characters without ending on a dash", () => {
    // Character 30 of the slug is the dash before "jones".
    const code = speakerPromoCode('Alexandria Bartholomew-Smythe Jones');
    expect(code).toBe('ALEXANDRIA-BARTHOLOMEW-SMYTHE');
    expect(code.length).toBeLessThanOrEqual(30);
  });

  it('is empty when there is no name to build it from', () => {
    expect(speakerPromoCode(undefined)).toBe('');
  });
});

describe('summarize', () => {
  it('keeps link and image text and drops the Markdown around it', () => {
    expect(
      summarize('# Hi\n\nRead **my** [blog](https://example.com) and `code`. ![logo](a.png)'),
    ).toBe('Hi Read my blog and code. logo');
  });

  it('leaves text that fits alone', () => {
    expect(summarize('Short and sweet.', 160)).toBe('Short and sweet.');
  });

  it('cuts at a word boundary and adds an ellipsis', () => {
    const summary = summarize('one two three four five six seven', 16);
    expect(summary).toBe('one two three…');
    expect(summary.length).toBeLessThanOrEqual(16);
  });
});
