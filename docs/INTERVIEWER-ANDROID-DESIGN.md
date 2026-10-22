# Interviewer Android redesign: status and deviations

The Interviewer section of the app is rebuilt to the Claude Design file *Interviewer App Android*. It has four artboards:
- **M1:** Home dashboard.
- **M2:** Availability, where you tap hours.
- **M3:** Live room cockpit, with the sheet.
- **M4:** Scorecard.

Every other interviewer screen is restyled in the same design language. Each one's API calls are fixed the way the web build fixed them. Student and Employer screens are not changed.

The same rules as the Student and Employer redesigns apply:
- Every value comes from the shared tokens (`apostrophe-user/lib/theme/tokens.ts`, then `theme:generate` and `theme:sync`).
- Numbers an admin controls are read from `/config` (`config.interviewer`, `config.tiers`, `config.qualifications`, `config.chat`, `config.masterData`).
- Where the server does not send a number, the sentence leaves the number out.
- Only real data is drawn.
- The web Interviewer build's decisions are followed (`apostrophe-user/docs/DESIGN-DEVIATIONS.md`, "Interviewer · …").

Decisions agreed for this build:
- **Scope:** the 4 artboards exactly, plus a restyle of the rest.
- **Room:** the full cockpit, with the video stubbed.
- **Availability:** one hour cell per hour.
- **Scorecard:** the Recommendation and Qualification check are extra rows in the same style.

## Foundation
- **`lib/api/interviewer.ts`:** rewritten against the server's real contracts (apostrophe-admin `src/contracts/interviewer.ts`, `scorecard.ts`, and the routes under `api/v1/interviewers`). Every response is unwrapped from `{data}`.
- **`lib/interviewer/useInterviewer.ts`:** react-query hooks.
  - Hooks: `useInterviewerMe` (with the `suspended`, `mustChangePassword` and `deactivated` flags), `useInterviewerInterviews`, `useInterviewerIdentity` (name, email and mobile from `/auth/me`), `useInterviewerUnread`, `useForgetInterviewer`, `useAppConfig`.
  - Nothing is requested until a screen that needs it mounts.
- **`lib/interviewer/state.ts`:** IST helpers (fixed +05:30).
  - The join window: `joinState`, from `joinOpensAt` or `config` join-opens and no-show minutes.
  - The scorecard clocks: `scorecardClock`, `owedClock`, `interviewClock`. They use `dueAt`, or else `sessionEndedAt` plus `scorecardWindowHours`. A clock is URGENT under `scorecardReminderHoursBefore`.
  - The list groups: live, upcoming, owed and past.
- **`lib/interviewer/availability.ts`:**
  - Converts between a slot set and weekly rules. Neighbouring blocks are merged, as the server does.
  - Builds the week strip and the hour cells from `slotMinutes`.
  - Reads booked slots from `GET /interviewers/me/availability/overview`.
- **`lib/interviewer/useInterviewerRoom.ts`:** the cockpit's state.
  - On entry: fetches the credentials once and records `JOIN`.
  - Polls the interview every 3 s. The clock comes from the server's `sessionStartedAt`.
  - Events: `HIGHLIGHT` marks a moment; leaving without ending records `LEAVE`.
  - Ending sends `LEAVE`, then `POST …/session {action:'END'}`.
  - A 503 from the room route (no video provider) still counts as joined, because the server stamps presence before it checks the provider.
- **`lib/interviewer/wallet.ts`:** the minimum withdrawal, the blocked reason, and the withdrawal status labels.
- **`components/interviewer/iv.tsx`:** the artboards' parts.
  - Text and layout: `IvLabel`, `IvCard`.
  - Figures: `IvStat`, the mono 22 figure.
  - Decoration: `IvGlow`, the accent radial.
  - Actions: `IvAction`, the 50 px pill.
  - Rows: `IvOwedRow`, the owed scorecard with its mono clock.
- **`InterviewerShell`:** the brand bar (logo, and initials that open Account), a back bar, or a title bar.
  - Shows the suspension band with `statusReason`.
  - When the password must change, it sends the user to the forced change.
  - Pull-to-refresh.
  - It no longer draws a second bottom bar (`InterviewerNav` is unused and left in place).
- **Tokens added:**
  - Font sizes `meta-tile` (22) and `meta-band` (16), with their line heights.
  - Typography entries `metaTile`, `metaBand` and `metaFigure`.
  - `EmDateField` gained `max` and `clearable`.

## Screens
| Artboard / screen | File | Notes |
|---|---|---|
| M1 Home | `InterviewerDashboardScreen.tsx` | Stats: done, completion, on-time, and this month's earnings. The next-interview card has a countdown and the join action. Owed scorecards show live clocks. |
| M2 Availability | `AvailabilityScreen.tsx` | Week strip, then a day card with a switch. Hour cells show "n slots" or "k of n"; booked cells show the name and cannot be tapped. Publish shows the change count. Override chips sit below. |
| M3 Live room | `InterviewerRoomScreen.tsx` (new) | Video placeholder, REC, timer with the over-time and warning bands, mic/cam/end. The sheet has Script (the next prompt plus a checklist), Notes (autosave, "+ mm:ss" moment stamps) and Resume tabs. End dialog. |
| M4 Scorecard | `ScorecardDraftScreen.tsx` | Due band. Five competency steppers with bars. Rows for Strengths & coaching, Recommendation and Qualification check, each opening a sheet. Submit releases the fee. |
| Interviews | `InterviewerInterviewsScreen.tsx` | Pills: All / Live / Upcoming / Owed / Past. When the account is suspended, falls back to the owed list. |
| Interview detail | `InterviewerDetailScreen.tsx` | Status and action, message, candidate, question script, private notes (GET then PUT), decline dialog, submitted summary. |
| Scorecards owed | `PendingScorecardsScreen.tsx` | Open and Closed lists. |
| Date overrides | `OverridesScreen.tsx` | Upcoming overrides and an "Add an override" sheet (day off, or own hours). The weekly rules are sent back unchanged. |
| Wallet | `InterviewerWalletScreen.tsx` | Available balance, Withdraw or the blocked reason, pending / in withdrawal / lifetime, open request, payout account, recent ledger. |
| Ledger | `InterviewerLedgerScreen.tsx` | Pills: All / Interview fees / Withdrawals / Adjustments. Loads more in pages of 50. |
| Withdraw | `WithdrawScreen.tsx` | Amount with min and max checks, a Minimum and an All chip, request history. |
| Bank account | `BankAccountScreen.tsx` | Holder, account number with a confirm field, IFSC and PAN, each checked with the server's patterns. |
| Statements | `StatementsScreen.tsx` | Request a date range (up to `statementMaxDays`). The list polls while a statement is Preparing, then offers Open. |
| Account | `InterviewerAccountScreen.tsx` | Identity and status, facts, fee per tier, stats over `statsWindowDays`, links, sign out. |
| Notifications | `InterviewerNotificationsScreen.tsx` | All / Unread, mark all read. Tapping a row opens its chat (`threadId`), scorecard or interview (`interviewId`), or the wallet (payments). |
| Messages | `InterviewerChatsScreen.tsx` | Real threads (previously sample data). The chat window rule comes from `config.chat`. |
| Conversation | `InterviewerThreadScreen.tsx` (new) | Bubbles, receipts and typing over the socket. Text only, because the interviewer API takes no attachments. A lock line appears when the chat is not open. |
| Sign in | `InterviewerSignInScreen.tsx` | Nothing is fetched before sign-in. A temporary password leads to the forced change. Any other role is signed back out. |
| Password | `InterviewerPasswordScreen.tsx` | Forced change and ordinary change (both need the current password, at least 10 characters, and a new password different from the current one). Forgot-password request, then reset code and new password. Every path ends at "sign in again". |
| Apply | `InterviewerApplyScreen.tsx` | The server's real body. Domains and languages come from `config.masterData`. Optional CV upload (PDF or Word). |
| Join us | `JoinUsScreen.tsx` | Each tier's interview length and qualifications from `/config`, the rules from `config.interviewer`, and the web's "how it works" steps. |

## Broken flows this fixes
Each of these was wrong in the old app screens:
- **Scorecard submit:** returned 400 because the body shape was wrong. It now sends the flat body the server validates.
- **Live room:** it used the student room and stuck on "connecting", so a session never ended and no scorecard could be written. It is replaced by the cockpit.
- **Forced password change:** returned 400 because no current password was sent. The server always requires it.
- **Apply:** returned 400. The screen sent `phone`, `bio`, `domain` and `resumeUrl`; the server wants `mobile`, `city`, `background`, `yearsExperience`, `domains`, `languages` and `resumeKey`.
- **Private notes:** saving overwrote them, because they were never loaded first. They are now read, then written.
- **Availability:**
  - Merged blocks broke the grid.
  - Saving the rules could wipe the date overrides.
  - Overrides could be saved before availability had loaded.
- **Wallet:** the balance fields were misread. The ledger was empty (wrong response shape). The payout form saved a made-up PAN.
- **Notifications:** read the wrong endpoint.
- **Chats:** showed sample conversations.
- **Duplicate bottom bar:** two bottom bars were drawn.
- **Requests before sign-in:** interviewer data was requested before the user had signed in.

## Deviations from the artboards (real data only)
- **Video:** the M3 footage and self view are placeholders. Agora is not installed in the app. The cockpit, clock, events, notes, script and end flow all run on the real API. Mic and camera toggle only locally.
- **Session start:** the server starts the session when both people are present. Until the student joins, the cockpit shows the lobby. END is offered only once the session is live, because the server refuses to end a session that never started. Before that, the button is EXIT.
- **Not built:**
  - M3's difficulty chips and quick-note phrases have no API.
  - The web omits them too.
- **M3 Resume tab:** shows the candidate's real profile (education, experience, skills, languages, CV link), not the drawn sample.
- **M3 End dialog:** states the completion rule from `completionThresholdPct` only when the server sends it. Nothing else in it is an admin number.
- **M4 scores:**
  - Scores start at 7 (the web's choice).
  - The range is `config.interviewer.scorecard.scoreMin/scoreMax`.
  - The labels are the server's competency labels.
- **M4 extra rows:** Recommendation and Qualification check were added as rows styled like "Strengths & coaching".
  - The internal note sits in the Strengths sheet.
  - Qualification choices come from `config.qualifications`. "Diploma" is not offered because the server has no such value.
- **M2 hour range:** the grid shows 08:00–22:00, plus any hour outside that range that already has slots.
- **M1 figures:** a figure the server did not send shows "—". The month's earnings are `earnedThisMonth`.
- **Wallet:** no TDS line (the server sends none).
- **Account:** notification toggles are not built. The web omits them too.
- **Join us:** the old fees ("₹40 to ₹150"), "20-minute sessions", "4-question script" and "2+ years" were written into the app and are removed. The interviewer fee is not in the public `/config`, so it is described, not priced.

## Not done / not verified
- **Not run on a device:** type check (whole app), lint (interviewer files) and `jest` (11/11) pass. Every screen still needs a manual pass on a phone.
- **Video is stubbed:** a real call needs the Agora SDK and the room credentials wired into the cockpit.
- **CV upload on Android:** the upload reads the picked file with `fetch(uri).blob()`, the same way the chat upload does. It has not been tried against every document provider.
- **`theme:check` still fails** on four older files this work did not touch. `EmployerNav.tsx`, `InterviewerNav.tsx` and `CandidateCard.tsx` are imported nowhere. `CertificateRail.tsx` is used only by `CandidateCard.tsx`. None was deleted.

### Existing bugs in the web build (reported, not fixed; outside the app's scope)
In `apostrophe-user/lib/api/interviewer.ts` and `app/join-us/apply/page.tsx`:
- **Apply:** sends `experienceYears`, `currentCompany` and `currentRole`, and never sends `city`, `background` or `yearsExperience`. Every web application gets a 400.
- **CV upload:** the presign is requested with an empty body, but the server needs `contentType` and `sizeBytes`. Every web CV upload fails.
- **Password reset:** `resetPassword` posts `password`; the server wants `newPassword`.
- **Bank form:** saves `AAAAA1234A` (or `AAAAA` plus the last 4 digits) as the PAN when none is typed.

## Live room — direction A "Console, finished" (2026-10-06)

The user compared four room directions (`docs/interviewer-room-mockups.html`) and picked **A** for the app and the web. `InterviewerRoomScreen.tsx` was rebuilt to it.

- **Layout:** three bands and nothing covers the candidate. The candidate takes the top 55.5% of the screen (the mockup's 468 of 844), with REC (or "Not recording yet") and the clock over it, your 16:9 tile top-right, their name bottom-left. Under it, the dock: round icon controls with captions — Mute, Camera, Flag (Sound before the session), and a red, wider End. Under that, the panel: Script · Notes · Profile.
- **Script:** "Ask next" first (Mark asked, Skip for now), the opening line, Up next, Asked · n (tap to un-tick), the closing line. Asked prompts are kept on the phone (AsyncStorage `room:<id>:asked`); skips are not kept. Nothing is sent.
- **Lobby:** your own camera stands in the candidate's place with "Your camera · preview" and the setup check (camera, mic, network from the real local state and link quality).
- **Bands:** reconnecting (90 s), connection lost, student left (with the admin's `rejoinWindowMinutes` countdown from the room DTO; without it, no number), and the wrap-up from the server's first warning.
- **End sheet:** the session length, and whether it clears the completion mark, in the web room's words (under the mark it goes to review before it can be paid).
- **New plumbing:** `RoomEngine.receiveAudio` (Sound — silences the candidate on this phone only), `useInterviewerRoom` `soundOff`/`toggleSound`, `studentLeftAt`, `rejoinWindowMinutes`, `now`; the DTO types gained `studentLeftAt` and `rejoinWindowMinutes` (the server already sent both). Icons `mic`, `micOff`, `videoOff`, `hangUp`.
- **Deviations from the mockup:** the phone's Script tab lists every remaining prompt under Up next plus an Asked group (the mockup showed two rows), so nothing is lost on a phone; "Leave" in the lobby leaves without asking, as before (nothing has started).
- **Not verified:** not run on a device or against a live session. tsc, eslint and the raw-values check pass for the touched files.

## UI pass 2026-10-06 — labels, chat A, apply C, late join

- **Labels** in Geist, normal case.
- **Chat A:** "Messages" uses the shared chat pieces, search, a ⋯ with "View interview" and "Report this chat"; text only (the API takes no attachments).
- **Apply C:** brand band, +91 on mobile, CV limit from `/config`, success screen with the three next steps.
- **Late join:** Home next-session card, Interviews rows, detail and the room lobby show "{name} not in yet · N min late" / your own lateness with a negative timer and the red fill. The room now sends `issuedAt` with LEAVE so a stale leave is ignored.
- **Not verified on a device.**

## Live room — full-screen + half sheet (2026-10-15)

The owner picked **Room sheet A · Half sheet** and **Script: own button (3 buttons)** in `docs/feed-room-mockups.html` (§3, `?room=A&script=button`). `InterviewerRoomScreen.tsx` was rebuilt to it; the web room is unchanged.

- **Layout:** the candidate fills the whole screen (no more 55.5% band). REC and the clock, your self tile under the clock, the bands and the "has left" scrim are where they were. A soft shade (`color.inkDeep`, the mockup's `.rshade`: 0.45 → 0 over the top 14%, clear to 58%, 0.72 at 78%, 0.9 at the foot) keeps the controls readable on any picture.
- **Bottom column** (over the video, above `insets.bottom`): the candidate's name tag (live only) → the dock (Mute · Camera · Flag/Sound · End/Leave, same round controls, no background) → three glass buttons, 48 tall, 10 apart, 16 from the edges:
  - **Script n/m** (`list` icon), only when the interview has prompts.
  - **Notes** (`note` icon), with a 7 px dot: green (`successOnInk`) once saved, orange-red (`dangerOnInk`) when a save failed, none otherwise.
  - **Profile** (`user` icon).
- **Lobby:** your camera preview fills the screen; the waiting card (late-join band, setup checks) sits in the bottom column above the dock. The three buttons work before the start, as Notes and Profile did.
- **Sheet:** an in-screen view, not a Modal, with no scrim, so the candidate stays clear and live above it. White, 24 top radius, grab handle, then a Script · Notes · Profile switch (Script only with prompts) and a round ✕. Switching tabs keeps it open. It rests at 42% from the top (about 58% of the screen). The body is the old panel: Script (Ask next, Opening, Up next, Asked, Closing), Notes (status line, `+ mm:ss`, the field) and Profile (person, facts, skills, résumé). The logic is unchanged: debounced notes save, asked prompts in AsyncStorage, skip, flag stamps, `notesMaxChars` from `/config`.
- **Drag:** the handle and the head row drag the sheet (taps on the switch and ✕ still work). Up stretches it to just under REC and the clock. Down goes from full to half, and from half closes it. A drag of 44 or a flick moves to the next stop; anything less springs back.
- **Keyboard:** the sheet sits on top of the keyboard and its top moves to 25% of the screen, so the candidate keeps a band at the top. The overlap is worked out from the keyboard's `screenY` and the screen's own frame, as `KeyboardAvoidingView` does. That works whether `adjustResize` shrinks the window or not (`edgeToEdgeEnabled=true` usually means it does not). On a short screen the sheet keeps at least about 260 (its head plus a few lines). The Notes field fills the sheet and scrolls inside itself, so the caret stays above the keyboard.
- **Back:** hardware back closes the sheet first (the system closes the keyboard before that). Then, live, it opens the End sheet as before.
- **Unchanged:** the End sheet, the refused/ended overlays, `useInterviewerRoom`, the late-join band, Flag, timers and warnings.
- **Deviations from the mockup:**
  - The sheet's upward shadow (`0 -10px 30px`) has no token. It uses `shadow.modal`, which falls mostly below the sheet, so hardly any shadow shows over the video.
  - The buttons use `onInkGround` (0.12) without the mockup's backdrop blur, which RN does not have.
  - The foot sits `insets.bottom + 20` above the bottom of the screen (the mockup has 22 and no nav bar).
  - The mockup's hint "Flag in the dock drops a [mm:ss] stamp here too." shows only live, with the keyboard down.
  - The Notes field shows the mockup's focus ring (accent border + `shadow.focus`).
  - Pulled up fully, the sheet covers your self tile. The mockup only says REC and the clock stay visible.
- **Not verified:** not run on a device or emulator (none connected). Untested:
  - The drag feel and snap thresholds.
  - The keyboard overlap on a real edge-to-edge Android, including `screenY` from `getWindowVisibleDisplayFrame`.
  - That the white sheet covers the `zOrderMediaOverlay` self tile.
  - How the JS-driven `top` animation performs on a low-end phone.
  - Whether `boxShadow` renders on the sheet and the focus ring.

  On a 360 dp-wide phone, a long count (for example `10/12`) may shorten the Script label to "Scri…". `tsc --noEmit`, eslint and the raw-value check pass for this file.
