/**
 * The Apostrophe component library for React Native, built to Foundations v1.
 *
 * Everything here is assembled only from design tokens — there is not a raw
 * colour, size or radius anywhere in this folder, and `npm run theme:check`
 * fails if one appears. When a screen needs a value these components do not
 * offer, the value becomes a token first.
 *
 * All of it is presentational: these components take props and render. No
 * fetching, no navigation, no business rules — a screen supplies the data and
 * decides what an action does.
 *
 * Grouped the way the foundations document is, so the two read side by side.
 */

// §03 type — three families, one job each
export { text } from './typography'
export { Eyebrow, Display, Body, Figure, Meta, Divider, Spacer } from './Type'

// §05 buttons and controls
export { Button, IconButton } from './Button'
export { Chip, Tag, Toggle, Segmented } from './controls'

// §06 fields, and the six states
export { Field, Input, LockedField, OtpInput, FileField, ListRow } from './fields'

// §02 status pairs and the application ladder
export { StatusPill, StatusDot, StatusLadder, VerifiedSeal, UnverifiedMark } from './status'
export type { Tone } from './status'

// §04 / §08 surfaces, cards, progress
export { Card, ObjectRow, NextAction, ProgressBar, ProgressRing, CompletionCard, ScoreRow } from './data'

// §07 video — the most important pieces in the system
export {
  VerifiedVideo,
  SelfUploadedVideo,
  ProcessingVideo,
  FailedVideo,
  CompositeVideo,
  CaptureFrame,
  VideoThumb,
} from './video'

// §09 navigation, sheets, modals
export { Sheet, Toast, PaywallBanner, AppBar, TabBar, ListSection } from './overlay'
export type { TabItem } from './overlay'

// §10 the six screen states
export { Skeleton, EmptyState, ErrorState, SuccessState, PendingState, DisabledAction } from './states'

// §11 feedback & controls
export { Banner } from './Banner'
export type { BannerTone } from './Banner'
export { GoogleButton } from './GoogleButton'

// The job feed — student app only
export { SwipeCard, SwipeActions } from './SwipeCard'
