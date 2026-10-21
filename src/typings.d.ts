// Typings reference file, see links for more information
// https://github.com/typings/typings
// https://www.typescriptlang.org/docs/handbook/writing-declaration-files.html

declare var System: any;

// Bundled as bytes by the "loader" option in angular.json, for server-side share cards.
declare module '*.wasm' {
  const bytes: Uint8Array;
  export default bytes;
}
declare module '*.woff' {
  const bytes: Uint8Array;
  export default bytes;
}
// satori's type definitions import React, but only for the type of the element it renders; the
// server builds plain element objects instead (see src/speaker-card.ts).
declare module 'react' {
  export type ReactNode = unknown;
}
