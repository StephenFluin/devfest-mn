import { editChanges, editLogEntry, EditLogEntry } from './edit-log';

describe('editChanges', () => {
  it('is undefined when a save changes nothing', () => {
    const speaker = { name: 'Jane', bio: 'Builds things.', published: true };
    expect(editChanges(speaker, { ...speaker, updatedAt: { '.sv': 'timestamp' } })).toBeUndefined();
  });

  it('gives each changed field its value before and after', () => {
    expect(
      editChanges(
        { company: 'Hallmentum LLC', published: false },
        { company: 'FreeDOS', published: true },
      ),
    ).toEqual({
      company: { from: 'Hallmentum LLC', to: 'FreeDOS' },
      published: { from: false, to: true },
    });
  });

  it('only looks at the fields being written', () => {
    expect(editChanges({ name: 'Jane', bio: 'old', company: 'Acme' }, { bio: 'new' })).toEqual({
      bio: { from: 'old', to: 'new' },
    });
  });

  it('leaves out the side of a change that was empty', () => {
    expect(editChanges({ company: 'Acme' }, { company: '', twitter: 'jane' })).toEqual({
      company: { from: 'Acme' },
      twitter: { to: 'jane' },
    });
  });

  it("doesn't count unchecked, cleared and never set as different", () => {
    expect(
      editChanges(
        { name: 'Jane' },
        { name: 'Jane', published: false, company: '', twitter: undefined, website: null },
      ),
    ).toBeUndefined();
  });

  it("doesn't count an older session's length saved as text as a change", () => {
    expect(editChanges({ blocks: '2' }, { blocks: 2 })).toBeUndefined();
    expect(editChanges({ blocks: '2' }, { blocks: 3 })).toEqual({ blocks: { from: '2', to: 3 } });
  });

  it('ignores fields nobody edits', () => {
    expect(
      editChanges(
        { $key: 'k', bio: 'same', renderedBio: '<p>old</p>', updatedAt: 1 },
        { bio: 'same', renderedBio: '<p>new</p>', adminNotes: null, updatedAt: 2 },
      ),
    ).toBeUndefined();
  });

  it("lists a new item's fields with no before", () => {
    expect(editChanges(undefined, { name: 'Jane', company: 'Acme', published: false })).toEqual({
      name: { to: 'Jane' },
      company: { to: 'Acme' },
    });
  });

  it('lists everything a deleted item had', () => {
    expect(
      editChanges({ $key: 'k', name: 'Jane', bio: 'Hi', updatedAt: 1, speakers: { a: 'S1' } }),
    ).toEqual({ name: { from: 'Jane' }, bio: { from: 'Hi' }, speakers: { from: ['S1'] } });
  });

  describe("a session's speakers", () => {
    it('are compared by who is on it, not by their ids in the map', () => {
      expect(editChanges({ speakers: { a: 'S1' } }, { speakers: { b: 'S1' } })).toBeUndefined();
    });

    it('are logged as a sorted list of speaker keys', () => {
      expect(editChanges({ speakers: { a: 'S2' } }, { speakers: { z: 'S2', b: 'S1' } })).toEqual({
        speakers: { from: ['S2'], to: ['S1', 'S2'] },
      });
    });

    it('can come back from the database as a sparse array', () => {
      expect(editChanges({ speakers: [null, 'S1'] }, { speakers: {} })).toEqual({
        speakers: { from: ['S1'] },
      });
    });
  });

  it('clips very long text so the entry stays within what the rules accept', () => {
    const { bio } = editChanges({}, { bio: 'x'.repeat(9000) });
    expect(bio.to).toHaveLength(6001);
    expect(String(bio.to).endsWith('…')).toBe(true);
  });
});

describe('editLogEntry', () => {
  const change: Pick<EditLogEntry, 'path' | 'key' | 'label' | 'action' | 'changes'> = {
    path: 'speakers',
    key: 'S1',
    label: '  Jim Hall ',
    action: 'update',
    changes: { bio: { to: 'Hello' } },
  };
  const anonymous = { uid: 'anon-uid', email: null, displayName: null };
  const google = { uid: 'google-uid', email: 'ada@example.com', displayName: 'Ada Admin' };

  it('credits an admin by account, even when they used a speaker’s link', () => {
    expect(editLogEntry(change, google, true, 'S1')).toEqual({
      ...change,
      label: 'Jim Hall',
      via: 'admin',
      uid: 'google-uid',
      email: 'ada@example.com',
      name: 'Ada Admin',
    });
  });

  it("credits anyone else to the speaker's edit link", () => {
    expect(editLogEntry(change, anonymous, false)).toEqual({
      ...change,
      label: 'Jim Hall',
      via: 'invite',
      uid: 'anon-uid',
      speaker: 'S1',
    });
  });

  it('keeps the Google account of a link holder who happens to be signed in', () => {
    expect(editLogEntry(change, google, false)).toMatchObject({
      via: 'invite',
      email: 'ada@example.com',
      speaker: 'S1',
    });
  });

  it('needs to be told whose link it was for a change to a session', () => {
    const session = { ...change, path: 'schedule' as const, key: 'X1' };
    expect(editLogEntry(session, anonymous, false, 'S1')).toMatchObject({
      via: 'invite',
      key: 'X1',
      speaker: 'S1',
    });
    expect(editLogEntry(session, anonymous, false)).toBeUndefined();
  });

  it('has no empty or undefined fields, which the database would refuse', () => {
    const entry = editLogEntry({ ...change, label: '  ', changes: undefined }, anonymous, false);
    expect(Object.values(entry)).not.toContain(undefined);
    expect(entry).not.toHaveProperty('label');
    expect(entry).not.toHaveProperty('email');
    expect(entry).not.toHaveProperty('changes');
  });

  it('caps the label and name at the lengths the rules allow', () => {
    const entry = editLogEntry(
      { ...change, label: 'L'.repeat(300) },
      { ...google, displayName: 'N'.repeat(300) },
      true,
    );
    expect(entry.label).toHaveLength(200);
    expect(entry.name).toHaveLength(100);
  });
});
