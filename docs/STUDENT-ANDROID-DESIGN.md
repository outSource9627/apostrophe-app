# Student Android redesign — status and deviations

Source of truth: Claude Design project "Apostrophe Student Portal Redesign", file
`Student App Android.dc.html` (artboards M1–M17). Web counterpart:
`apostrophe-user/docs/DESIGN-DEVIATIONS.md` (same real-data rules).

## Foundation

- **Tokens.** `src/theme/tokens.ts` is a synced copy of `apostrophe-user/lib/theme/tokens.ts` — never edit it
  here; edit the canonical file, run `npm run theme:generate` there, then `npm run theme:sync` here.
  Mobile additions in the canonical file: `fontFamilyNative` → Geist / Geist Mono, heights (`top-bar`,
  `screen-header`, `tab-title`, `tab-pill-*`, `fab`, `deck-*`, `room-*`, `bubble-*`, `date-tile-*`, `tier-row`,
  `day-card`, `score-cell`, `step-bar`, `otp-cell-mobile` …), `spaceHalf` (6/10/14/18/24), colours
  (`accentOnInkSoft`, `successHalo`, `neutralHalo`), native tracking/leading steps.
- **Fonts.** `src/assets/fonts/Geist-{Light,Regular,Medium,SemiBold,Bold}.ttf`, `GeistMono-{Regular,Medium,SemiBold}.ttf`
  (Google Fonts static cuts, OFL), also in `android/app/src/main/assets/fonts`. The old Libre Franklin / IBM Plex
  files are still in the repo, unused — delete after review.
- **Shared components** (all read tokens only):
  `ui/student.tsx` — AppHeader, BrandMark, Avatar, CreditChip, ScreenHeader, TabTitle, StickyFooter, StepBars,
  OptionTile, PhoneInput, InkCard/InkPill/InkButton, FilmThumb, Fab.
  `ui/student-jobs.tsx` — JobsHeader, PipelineDots, JobDeckCard, DeckStamp, DeckActions, UndoToast.
  Restyled in place (shared with Employer/Interviewer, so they change too): `AppBar`, `TabBar`, `Sheet`,
  `Field`/`Input`/`OtpInput`, `Button` (lg = 52 / 16), `ScoreRow`, `Toggle` (+ `tone="success"`), `text.displayLg` (28/600).
- **Navigation.** Student bottom bar = Home, Interviews, Jobs, Interests, Chat. No Profile tab: the header avatar
  opens Account, which lists My profile, profile steps, videos, applications, connections, notifications, stats.
  The bar is hidden for unpaid students (ST-12, same as web).

## Screens

| Artboard | Native screen | State |
|---|---|---|
| M1 OTP | VerifyMobileScreen | restyled, logic untouched |
| M10 Create account | CreateAccountScreen | restyled |
| — Sign in, Welcome | SignInScreen, WelcomeScreen | same patterns as M1/M10 |
| M2 Profile builder | ProfileWizardScreen | step bars, header, footer; 6 steps and autosave untouched |
| M3 Pricing | PricingScreen, CheckoutScreen, Confirming, PaymentFailed, PayBar | restyled |
| M4 Home | HomeScreen | rebuilt (paid dashboard) |
| M5 Booking | BookInterviewScreen, SlotPicker | day cards, Morning/Afternoon/Evening groups |
| M6 Confirmed | ConfirmedScreen | restyled + prep checklist |
| M7 Device check | ReadinessScreen | restyled (see deviations) |
| M8 Room | RoomScreen | overlays, controls, tile restyled; logic untouched |
| M9 Scorecard | FeedbackScreen | ink score card, 10-cell bars |
| M11 Jobs deck | JobFeedScreen | deck, actions, stamps, undo toast |
| M12 Saved & applied | SavedJobsScreen, ApplicationsScreen | shared Jobs header, pipeline dots |
| M13 My interviews | InterviewsScreen | filters, date tiles, FAB |
| M14 / M15 Chat | ChatListScreen, ThreadScreen, parts | accent bubbles, pill composer |
| M16 / M17 Profile | ProfileViewScreen, VisibilityScreen | card sections |
| — no artboard | InterviewDetail, Reschedule, Cancel, Ended, TopUp, JobDetail, Apply, Interests, Connections, Videos, Account, Notifications, NotificationSettings, Stats, DataRights, Health | pick up header, Geist, cards, buttons; some layout retained |

## Deviations from the artboards (real data only)

- **M1** No on-screen keypad (canvas chrome), no "Use WhatsApp" (no backend). The "AUTO-READ" note reads "TIP"
  and says "paste all six" — no auto-read claim.
- **M3** No "5× more replies" card, no GST line (no data). Tier rows are display-only (the tier is set by
  qualification). Only the student's own tier shows "YOURS".
- **M4** No prep checklist %, render steps or 64%. One film card in its real state. "N views · N interests" has no
  time window. Visibility switch disabled with "Not live yet" until a film is published. Scorecard row added.
- **M5** No "3 experts match you"; the card shows the real tier and length. Slot groups are computed from real
  slots by IST hour. The Confirm button label is "Confirm · uses 1 credit".
- **M6** Interviewer card omitted (unnamed until the session, SC-16). Prep list = the four items web uses; ticks are local.
- **M7** No live camera preview: this screen cannot open the camera (it opens in the room), so the capture frame
  and check rows stay.
- **M8** The student's control is "Leave" (only the interviewer ends the interview); no confirmation sheet added.
- **M9** No "placement readiness" title or cohort median; the ink card shows the real overall score.
  Strengths/improvements are the interviewer's real text, in full.
- **M11** Video jobs show a poster with play glyph (no in-deck playback existed). No "why this job" line. The
  deck position counter is omitted; segmented "Saved / Applied" carry no counts.
- **M12** Saved and Applied are two screens sharing one header, not one scrolling screen.
- **M13** Filters are local (client-side) over the loaded list.
- **M15** Attachments and system lines keep the app's existing behaviour.
- Razorpay sheet colour now uses `color.accent` (was a hard-coded crimson).

## Round 2 (after first device test)

- **Buy again.** "Buy an interview" on the no-credit booking screen opened Home; it now opens Pricing. Pricing
  lets a paid student with no credit left pay again (same rule as web: pay when unpaid OR no unused credit); a
  student holding a credit sees "Book an interview". The no-credit screen uses the M3 tier row + footer.
- **Support** buttons open email to support@apostrophe.work (`src/lib/support.ts`) instead of the dev Health screen.
- **Receipts.** New backend route `GET /api/v1/payments` (apostrophe-admin, documented in docs/API.md): the
  student's SUCCESS/REFUNDED payments with receipt number, GST breakdown and a signed PDF URL when the PDF exists.
  New native `ReceiptsScreen`. PDFs are not generated by the backend yet, so rows offer "email support" instead.
- **Your videos.** Pick a video from the gallery (react-native-image-picker), checked against `/config`
  uploads.SELF_VIDEO and selfVideoMaxSeconds, uploaded via `/uploads/sign` with progress and cancel
  (`src/lib/api/uploads.ts`). The "Your interview" row no longer claims Verified until the film is published.
- **Admin values from /config** (`src/lib/interviews/rules.ts`, mirrors web): booking window, profile gate %,
  join opens/closes, reschedule cutoff, free-cancellation window, interest cooldown/expiry. Missing → error
  state or the sentence drops the number; nothing is guessed.
- **Job feed:** tap / ⓘ opens a details sheet (facts, role, what you'll do, looking for, benefits, skills, about
  the company, video player, Not interested / Save / Apply with video resume); the next card grows into place as
  you drag; undo button + undo toast. "Why it matches you" and the recruiter's name are not drawn (no API data).
- **Redesigned (no artboard):** Interview detail, Reschedule, Cancel, Ended, Top-up, Account, Notifications,
  Notification settings, Stats, Data rights, Interests, Connections, Job page (shared `jobParts.tsx`).
  New shared pieces: `MenuGroup`, `MenuRow`.
- **Stats** said "Last 30 days" but `profileViews` is a lifetime counter; it now says "All time". The web
  (`apostrophe-user/app/stats/StatsClient.tsx`) still says "Last 30 days" — not changed.

## Round 3 — the video-resume screen (SP-07, RC-10..RC-13)

New `VideoResumeScreen` (`src/screens/profile/VideoResumeScreen.tsx`, route `VideoResume`). No artboard exists for it
(M4/M17 only draw the film's card); it is the native twin of the web `/profile/video-resume` page and follows the
same rules, so the two say the same thing in the same words.

- **States (all from `GET /students/me/video-resume`).** PUBLISHED: a 9:16 player (max width `container['film-player']`)
  with the poster, the Verified seal carrying the interview date, native controls, and Duration / Published /
  Interviewed facts. PROCESSING: "being prepared" (or "not ready yet" when `pipelinePending`) + Check again.
  FAILED: "could not be made" + Talk to support. UNPUBLISHED: "taken down" + the admin's reason in a "Reason given"
  well + Talk to support. NONE: "no video resume yet" + Book an interview. A PUBLISHED film with no address is drawn
  as PROCESSING, never as a dead player.
- **Signed link.** The address lasts ~15 minutes (RC-06). It lives only in a query with `gcTime: 0` and is read
  again on every open. When the player errors (a lapsed link, a broken segment) it asks for a new one and resumes
  from where it stopped; a second error within 8 s says so with a Try again instead of looping.
- **Where it opens from.** Home's film card (every state but "none", which still books), Profile → "Watch my film"
  (published only), Stats and Interests "video resume" links (they went to Profile before), and the three
  `interview.video.*` notifications (live / taken down / could not be made), which used to open the interview.
- **`FilmThumb`** now takes `status` (+ `posterUrl`, `width`) and draws a ground and glyph per state — footage
  only for PUBLISHED, a spinner for PROCESSING, "!" on rose for FAILED, eye-off for UNPUBLISHED, dashed for NONE.
  Existing callers are unchanged (default PUBLISHED, list-row size).

Deviations from the web page (all deliberate): no "Preview as employer" button (there is no native employer-preview
screen); the duration reads `m:ss` (`clock`) rather than "N min"; the player uses the native controls of
react-native-video rather than a drawn bar. Nothing here states who is at fault or what was charged — the API does not
say — even though the backend now issues the automatic free re-interview for a COMPLETED interview (the notification
says so); if the API starts returning that, this is the place to add it.

### Round 3b — a session that ended below the completion threshold (6.3 / 6.5)

The Ended screen used to say "Your paid interview still stands — book the rest of it", but the credit is spent and
nothing gave it back. Now: an INCOMPLETE session says it is **under review** (no booking offered, no promise); when an
admin decides, the backend issues what 6.5 says the student is owed (free reschedule / free re-interview) in the same
step, and the student's screens read the outcome from `reviewedAs` on the interview. Ended hands a reviewed session
over to `InterviewDetail`, which tells the story: interviewer left / student left ("Ended early", free reschedule) or
"Platform / technical issue" (free re-interview at no charge) with a **Book your free reschedule / re-interview**
button. The pre-join no-show panel now says the same as the web (no refund, one free reschedule; an interviewer who did
not join is "not on you") instead of "Your interview was spent. Nothing was refunded."

## Not done / not verified

- **Nothing has been run on a device by me** (including the video-resume screen: jest renders each state and the
  types/lint pass, but playback and link renewal were never exercised on Android). Type-check, lint (no new errors) and jest pass; the raw-value check
  has no findings in Student files. The emulator was booted once but the app was not exercised.
- iOS: `Info.plist` / `project.pbxproj` still list the old fonts (run `npx react-native-asset`); Android only was in scope.
- Employer and Interviewer files were not edited, but they read the same tokens and shared components, so their
  fonts, colours, headers, buttons and tab bar changed too.
- Pre-existing, untouched: `interviewer.ts` `accountHolder` type error, `useInterviewer.ts` unused import, raw-value
  findings in Employer/Interviewer screens.
- Interests unread badge, notification/unread counts on tabs, and the profile-wizard step content components
  (`wizardSteps.tsx`) keep their existing look beyond the shared chip/field restyle.

## Round 4b — profile view, badge date, feedback state, notifications

Backend already done (apostrophe-admin); nothing there or in apostrophe-user was edited. Same real-data rules as above:
tokens only, no invented numbers, admin values from `/config`.

- **Profile → film card (SP-01/SP-02).** `ProfileViewScreen` drew the film card from the AUDIENCE flag
  (`published ? card : "Book an interview"`), so a film that was being made, had failed or was taken down told the
  student to book, and so did any failed audience call. It now reads `getVideoResume()`: NONE keeps the "Book an
  interview" card; PROCESSING / FAILED / UNPUBLISHED / PUBLISHED draw one card (`FilmThumb status=`, `StatusPill` or
  the Verified seal, and a button to the `VideoResume` screen — "Watch my film" when published, "See details"
  otherwise). While the film request is loading the card is a skeleton; if it fails the card says so with Try again —
  it never falls back to a guess. The film's signed addresses are dropped on the way into the query cache (only status,
  dates, `pipelinePending`, `reason` are kept), and no poster is drawn on the card (same as Home's card). The audience
  query still drives the feed-visibility row below, as before.
- **Copy fix (SP-04).** "…This is the only video employers see." became "The film from your interview. Employers
  watch this first; any videos you add yourself appear below it, marked as not verified." (The same sentence on the video-resume screen is the other agent's file; a grep shows it is gone from `src`.)
- **Your videos (SP-04).** New section under Documents from `listSelfVideos()` (query key `['videos']`, shared with
  the videos screen so its add/edit/delete invalidations refresh this list): title (or the kind's name), kind · length
  (`m:ss`), a status pill and the `UnverifiedMark` on every row, in the dashed / sunken frame the video components
  use for self-recorded footage. "Manage videos" opens the existing videos screen; empty state "No videos yet.".
  Status wording ("Live on your profile", "Waiting for review", "Not published") is a local copy of the videos
  screen's — if one changes, change both. A rejection reason is not repeated here.
- **Badge date.** The Verified seal now carries the INTERVIEW date (`interviewedAt ?? publishedAt`) on the profile
  card and on `ApplyScreen`, which reads it from the video-resume response (its own query, dates only). If that call
  fails the seal carries no date rather than the profile's `publishedAt` (set once, never moves). Both now use
  `fmtDayMonthYear` (IST, "25 September 2026") like the video-resume screen — Apply used to print UTC "25 Sep 2026",
  which could be the wrong day. Home's film card never drew a date, so nothing changed there. Apply's "not published"
  gate still reads `profile.publishedAt` (unchanged; the server also refuses with `PROFILE_NOT_PUBLISHED`).
- **Feedback state (SP-08).** `StudentInterview` gains `feedback?: 'READY' | 'AWAITING' | 'UNAVAILABLE'`. On a 404
  from `/interviews/:id/feedback` the scorecard screen fetches the interview and reads that: AWAITING → "on its way"
  with "…has up to N hours after the session to send it" where N is `scorecard.windowHours` from `/config` (the sentence
  drops the number when absent — the hard-coded "within a day" is gone); UNAVAILABLE, or an interview that is not
  COMPLETED → "Feedback will not be available for this interview." with Back to my interviews and no time or
  notification promised; anything else (interview unreadable, or it says READY because the scorecard landed in
  between) → "Could not load your feedback." with Try again. `InterviewDetail`'s "See my scorecard" shows only when
  `feedback === 'READY'`; otherwise a quiet line ("Feedback on its way" / "No feedback for this interview") in the
  "Your interview is done" card, whose sentence "Your scorecard arrives separately" was dropped (false for UNAVAILABLE).
  The interviews list has no scorecard button, so its COMPLETED rows carry the same quiet line (none for READY).
  A COMPLETED interview with NO `feedback` field (older backend) therefore shows neither button nor line.
- **Home scorecard row (beyond the literal file scope, flagged).** Home mapped every 404 to "Scorecard on its way —
  we'll notify you the moment it lands". `loadDashboard` now maps by the interview's `feedback` (`'unavailable'`), and
  the row says "No scorecard / No feedback for this interview" (not tappable). ~10 lines in `lib/home/dashboard.ts` and
  `HomeScreen.tsx`; revert if unwanted.
- **Notifications.** `profile.video.approved | rejected | removed` open the `Videos` screen (before the generic
  `interviewId` rule). Other routes unchanged.
- **Dead code.** `components/employer/CandidateCard.tsx` was imported nowhere and invented "Immediate" for a null
  availability; deleted. `CertificateRail.tsx` was used only by it and is now unused too (not deleted — not asked).
  The employer/interviewer design docs still list `CandidateCard` as an unused file.
- **Tests (new files).** `__tests__/profileViewFilm.test.tsx` — every film state (PROCESSING/FAILED/UNPUBLISHED never
  offer booking, even when the audience call fails), the interview date on the seal, the new copy, the videos section;
  `__tests__/feedbackState.test.tsx` — UNAVAILABLE / AWAITING (with and without `windowHours`) / READY / non-COMPLETED.
  The notification routing has no test (`routeFor` is not exported).
- **Not verified.** Nothing was run on a device or emulator. `tsc`, `theme:check` (no findings in touched files —
  the remaining ones are older Employer/Interviewer/Room files) and the new jest suites pass; `npm run lint` shows no
  new errors in touched files (its 10 errors are `ios/Pods` and `jest.setup.js`); `__tests__/App.test.tsx` still fails
  on NitroModules, unrelated. The self-videos section and the film card were checked only in the test renderer, not
  for layout on a narrow phone. `VideoResume.live` / `held` (from the other agent's types) are not used on the
  profile card: a PUBLISHED film that is held off the feed still reads "Employers watch this first".

## Round 4a — self-video management and interview videos

Backend was already done (`apostrophe-admin`); this round is `src/lib/api/student.ts`, `VideosScreen`, `VideoResumeScreen`
and jest (`__tests__/videos.test.tsx` new, `__tests__/videoResume.test.tsx` extended). No artboard exists for either
screen, so everything is built from existing components and tokens (`Sheet`, `Banner`, `Field`/`Input`, `Chip`, `Button`,
`StatusPill`, `UnverifiedMark`, `VideoThumb`, `Card`) — no new shared component, and `theme:check` has no findings in the
files touched.

- **API** (`student.ts`). `VideoResume` gains `live` and `held`; `getVideoResume({ interviewId? })`. New exports:
  `InterviewVideoStatus`, `InterviewVideoRow`, `InterviewVideos`, `PrimaryInterviewResult`, `SelfVideo` (`SelfVideoKind`,
  `SelfVideoStatus`), `SelfVideoEdit`, `SelfVideoInput`, and `getInterviewVideos`, `setPrimaryInterview`, `listSelfVideos`,
  `editSelfVideo`, `deleteSelfVideo`, `addSelfVideo`. `getVideoResume` takes an options object, so it can no longer be
  passed bare as a react-query `queryFn` (the context object is not its options type) — wrap it: `() => getVideoResume()`.
- **Your videos — remove and edit.** Each row has **Edit** and **Delete** (accessible names carry title and kind).
  Delete asks first ("Remove this video? This cannot be undone.") and shows the server's message if it fails; the row stays.
  Edit opens a sheet with the title (max 80) and the three kinds. An approved clip shows, before saving, "Editing sends this
  video back for review. Employers will not see it until it is approved again."; a rejected one shows the reason and the action
  reads "Edit and resubmit"; a pending one is edited in place. After saving the screen reports the server's own reply
  (`changed:false` → "Nothing changed."; `resubmitted` → "Saved. This video is back in review…"; otherwise "Saved.").
- **Your videos — the rest.** At the cap the add card is replaced by "That is all N. Delete one to add another." (N from
  `/config` `limits.selfVideoMaxCount`); with none, "No videos yet." Every row carries `UnverifiedMark` beside its dashed
  thumbnail. A clip with a signed address plays (tap the thumbnail) in a full-screen ink modal with the native controls; on a
  player error the list is read ONCE more for a fresh address and playback resumes where it stopped, a second error says so with
  Try again. A clip with no address is not tappable. Copy: pending "We will tell you when it has been reviewed.", approved "Shown
  on your full profile to employers, marked not verified.", and "Edited · back in review" when `editedAt` is set on a pending clip.
- **Upload checks.** A picker duration that is 0, missing or not finite sends NO `durationSec` (the server reads the file; the
  old code sent a made-up `1`); a known length over `selfVideoMaxSeconds` is refused before anything is uploaded. When
  `/config` `uploads` is missing nothing is silently skipped or blocked: the card says the file type and size are checked at
  upload, and the server refuses what it must.
- **Video resume.** A published film that is not `live` says so above the player: held → "Your video resume is not live yet. A
  top-up on your interview is outstanding — employers cannot see it until it is settled."; otherwise, when previewing a
  non-primary one, "You are previewing a video that is not your primary one." The intro line now reads "The film from your
  interview. Employers watch this first; any videos you add yourself appear below it, marked as not verified."
- **Your interview videos** (2+ interviews). One card per interview: date, length, state pill (Primary / Ready / Being made /
  Could not be made / Taken down / Archived), **Watch** (loads that interview's film into the same player; the link renewal
  re-requests the same interview) and **Make primary** (only where the API says `selectable`; otherwise the API's `reason` is
  shown). After Make primary the list and film are read again and the screen says "This is now your primary video.", plus, from
  the reply, "Your profile stays off the feed until your top-up is settled." (`held`) and "A newer interview will not replace this
  one until you choose it." (`pinned`; also shown whenever the list says `pinned`). A refused choice shows the API's 400 message inline.

### Deviations and unverified (Round 4a)

- **Title limit 80 is a constant in `VideosScreen`.** `/config` carries no title length; the server validates it and its message
  is shown if it disagrees. Everything else numeric (count, seconds, size, types) is read from `/config`.
- **Unverified mark sits beside the thumbnail, not on it.** The dashed thumbnail is 58 wide; the "Unverified" pill is wider.
- **Status pill for an approved clip is "Approved"** (was "Live on your profile"): approved does not mean employers see it while the
  profile is hidden or not published, so the pill no longer says live. The "Your interview" row now says "Leads your profile" only
  when `live`, "Held back until your top-up is settled" when `held`, else "Not live on your profile yet"; its thumbnail now draws the
  film's real state instead of always drawing footage.
- **No poster for a self-video thumbnail** (the API sends no poster address), so the thumb is the dashed frame with a play mark.
- Watch on the primary row re-reads the primary film rather than asking for it by id.
- **Not run on a device.** Jest covers rendering, the API calls, copy and the renewal logic; playback, the signed-address renewal,
  the full-screen player, the gallery picker, and the on-screen keyboard over the edit sheet (the shared `Sheet` is a plain modal, so
  the field may sit under the keyboard on a small phone) have not been exercised on Android.
- Jest reports a worker that did not exit gracefully after these suites (open timer); all tests pass.
