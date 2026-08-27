/**
 * Numbers a scene is built from that a spec also has to assert against.
 *
 * Kept apart from `harness.ts`: that module pulls in the library and its SCSS for the browser
 * page, so a spec importing a value (rather than a type) from it would drag all of that into
 * the Node process running the tests.
 */

/** The `border-radius` the `roundedCard` subject carries, which its ring has to match. */
export const ROUNDED_CARD_RADIUS = 12
