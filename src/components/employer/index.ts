/**
 * The employer onboarding and verification pieces (EM-02..EM-07), shared by
 * every employer screen and drawn to the canvas at
 * docs/design/canvas/employer-onboarding in apostrophe-admin.
 *
 * Composition only: every colour, size and radius comes from the tokens and
 * the library in components/ui. Unlike components/ui, some of these read the
 * employer's state (EmployerShell) or own a lifecycle (DocumentSlot), because
 * the prompt and the upload rules must not be re-implemented per screen.
 */
export { EmployerShell } from './EmployerShell'
export { VerificationPrompt } from './VerificationPrompt'
export { VerifiedEmployerBadge } from './VerifiedEmployerBadge'
export { DocumentStatusRow } from './DocumentStatusRow'
export { DocumentSlot, DropZone } from './DocumentSlot'
export type { DocumentSlotHandle, SlotFile, SlotStatus } from './DocumentSlot'
export { CodeRow } from './CodeRow'
export { FeedExplainer } from './FeedExplainer'
export { CompanyMonogram, Glyph, TextAction, initials } from './parts'
export type { GlyphName } from './parts'
