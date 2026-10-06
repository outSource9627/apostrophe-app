/**
 * The chat surface's shared pieces — direction A, "Clean & unified"
 * (docs/chat-redesign-mockups.html): one plate rule, one list row, one bubble,
 * one composer, for the student, employer and interviewer apps alike. Every
 * size and colour comes from the theme tokens.
 */
export { ChatPlate, CompanyTile, Plate, plateKindOf, tileTone, type PlateKind } from './plate'
export { BackButton, RoundButton, ReconnectingStrip } from './controls'
export { ChatRow, ChatSearchField, ChatListFrame, type ChatListStatus } from './list'
export { Bubble, DayDivider, SystemLine, TypingBubble, Transcript } from './transcript'
export { ChatHeader, RecordingPill, MaskInfo, ClosesLine, ReadOnlyFoot, Composer, type AttachKind } from './thread'
