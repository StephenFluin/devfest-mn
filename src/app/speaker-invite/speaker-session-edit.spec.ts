import {
  placeholderSessionTitle,
  presents,
  SESSION_KEY,
  SESSION_LIMITS,
  speakerSessionUpdate,
} from './speaker-session-edit';

describe('speakerSessionUpdate', () => {
  it('trims the title and description', () => {
    expect(speakerSessionUpdate({ title: '  My talk ', description: ' About things. \n' })).toEqual(
      { update: { title: 'My talk', description: 'About things.' } },
    );
  });

  it('clears an empty description with null, which removes it from the database', () => {
    expect(speakerSessionUpdate({ title: 'My talk', description: '   ' })).toEqual({
      update: { title: 'My talk', description: null },
    });
    expect(speakerSessionUpdate({ title: 'My talk' })).toEqual({
      update: { title: 'My talk', description: null },
    });
  });

  it('only ever returns the title and description, whatever else is sent', () => {
    const result = speakerSessionUpdate({
      title: 'My talk',
      description: 'About things.',
      room: 'Auditorium',
      startTime: '2026-12-05T09:00-06:00',
      published: true,
      speakers: { a: 'someone-else' },
    });
    expect(result).toEqual({ update: { title: 'My talk', description: 'About things.' } });
  });

  it('requires a title', () => {
    for (const body of [{}, null, { title: '   ' }, { title: 42 }, 'My talk']) {
      expect(speakerSessionUpdate(body)).toEqual({ error: 'Your session needs a title' });
    }
  });

  it('allows a title and description up to their limits, and no longer', () => {
    const title = 'a'.repeat(SESSION_LIMITS.title);
    const description = 'b'.repeat(SESSION_LIMITS.description);
    expect(speakerSessionUpdate({ title, description })).toEqual({
      update: { title, description },
    });
    expect(speakerSessionUpdate({ title: `${title}a`, description })).toHaveProperty('error');
    expect(speakerSessionUpdate({ title, description: `${description}b` })).toHaveProperty('error');
  });
});

describe('presents', () => {
  const session = { speakers: { '-pushId1': 'speaker-a', '-pushId2': 'speaker-b' } };

  it("finds a speaker among the session's presenters", () => {
    expect(presents(session, 'speaker-b')).toBe(true);
    expect(presents(session, 'speaker-c')).toBe(false);
  });

  it("doesn't mistake the map's ids for speakers", () => {
    expect(presents(session, '-pushId1')).toBe(false);
  });

  it('is false for a session with no speakers, or no session', () => {
    expect(presents({}, 'speaker-a')).toBe(false);
    expect(presents(null, 'speaker-a')).toBe(false);
    expect(presents(undefined, 'speaker-a')).toBe(false);
  });
});

describe('placeholderSessionTitle', () => {
  it('names the session after the speaker until they write their own title', () => {
    expect(placeholderSessionTitle('  Jane Doe ')).toBe("Jane Doe's session");
  });
});

describe('SESSION_KEY', () => {
  it('accepts database push ids and nothing that could reach another path', () => {
    expect(SESSION_KEY.test('-P66g8biGrgWeKkki1uh')).toBe(true);
    expect(SESSION_KEY.test('')).toBe(false);
    expect(SESSION_KEY.test('a/b')).toBe(false);
    expect(SESSION_KEY.test('a.json')).toBe(false);
    expect(SESSION_KEY.test('a'.repeat(65))).toBe(false);
  });
});
