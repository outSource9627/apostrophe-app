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

## Not done / not verified

- **Nothing has been run on a device by me.** Type-check, lint (no new errors) and jest pass; the raw-value check
  has no findings in Student files. The emulator was booted once but the app was not exercised.
- iOS: `Info.plist` / `project.pbxproj` still list the old fonts (run `npx react-native-asset`); Android only was in scope.
- Employer and Interviewer files were not edited, but they read the same tokens and shared components, so their
  fonts, colours, headers, buttons and tab bar changed too.
- Pre-existing, untouched: `interviewer.ts` `accountHolder` type error, `useInterviewer.ts` unused import, raw-value
  findings in Employer/Interviewer screens.
- Interests unread badge, notification/unread counts on tabs, and the profile-wizard step content components
  (`wizardSteps.tsx`) keep their existing look beyond the shared chip/field restyle.
