/**
 * Realtime Database and Eventbrite data arrive as loosely shaped JSON (Firebase even turns some
 * maps into sparse arrays), so code that walks it checks fields where it reads them.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type UntypedJson = any;
