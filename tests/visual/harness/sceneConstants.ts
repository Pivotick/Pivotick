/**
 * Numbers a scene is built from that a spec also has to assert against.
 *
 * Kept apart from `harness.ts`: that module pulls in the library and its SCSS for the browser
 * page, so a spec importing a value (rather than a type) from it would drag all of that into
 * the Node process running the tests.
 */

/** The `border-radius` the `roundedCard` subject carries, which its ring has to match. */
export const ROUNDED_CARD_RADIUS = 12

/** The badges `TierSpec.badges` puts on every node. */
export const TIER_BADGES = ['1', '2']
/** The badges `TierSpec.focusBadges` has the focus card declare instead. */
export const FOCUS_TIER_BADGES = ['F']

/** The text on the badge `LegendSpec.badgeFirst` declares. */
export const LEGEND_BADGE_TEXT = 'E'
