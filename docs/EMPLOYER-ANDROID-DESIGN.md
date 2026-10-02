# Employer Android redesign: status and deviations

The Employer section of the app is rebuilt to the Claude Design file *Employer Android* (project `0ef80e49-…`, artboards EM-01 to EM-29; full source in `gen/a1.js`, `a2.js`, `a3.js`, `h.js`). Student and Interviewer screens are not changed.

It follows the same rules as the Student redesign:
- Every value comes from the shared tokens (`apostrophe-user/lib/theme/tokens.ts`, then `theme:generate` and `theme:sync`).
- Numbers an admin controls are read from `/config`. A sentence leaves its number out when the server does not send one.
- Only real data is drawn. Where the design shows sample content that the API does not carry, the item is omitted and listed below.
- The web Employer build's decisions (`apostrophe-user/docs/DESIGN-DEVIATIONS.md`, "Employer · …") are followed.

## Foundation
- **`components/employer/em.tsx`:** the design's building blocks.
  - Structure: `EmBar`, `EmTitle`, `EmCard`, `EmFoot`, `EmSheet`, `EmDialog`.
  - Labels and choices: `EmBadge`, `EmMono`, `EmPills`, `EmChip`, `EmLabel`, `EmRadioRow`.
  - Header controls: `EmIconButton`, `EmBell`, `EmAvatarButton`.
  - States: `EmEmpty`, `EmError`, `EmDone`.
  - Content: `EmSteps` (the timeline), `EmWell` (the reviewer's words), `EmPerson`.
- **`components/employer/form.tsx`:**
  - `EmField`: label, note, and an error or hint.
  - `EmSelect`: a field that opens a sheet of radio rows.
  - `EmSeg`: the segmented control.
  - `EmDateField`: a month grid in a sheet. There is no date-picker dependency.
- **`components/employer/feed.tsx`:** the feed top bar and filter chips, the film card, the stamps, the round controls, the toast and the locked card.
- **`components/employer/profile.tsx`:** the profile head, the three facts, the sections, and the self-uploaded clip player.
- **`EmployerShell`** has these props: `title`, `sub`, `big`, `back`, `right`, `footer`, `bar`, `onScroll`.
  - It draws the verification strip at the top.
  - By default the header shows the bell and the company initials. The initials open Account.
  - It no longer draws a second bottom bar.
- **Bottom tabs:** Feed, Shortlist, Interests, Jobs, Chats.
  - Every tab except Feed shows a padlock until the account is verified.
  - Chats shows an unread dot.
  - Home sits under the Feed tab.
- **Additions to the shared UI and libraries:**
  - `Button` sizes `cta` (50) and `pair` (46), and the `dangerText` variant.
  - `text.uiBaseMedium`, `text.metaBase` and `text.displayPoster`.
  - `useThreadSocket(id, handlers, rest?)`: an optional REST fallback per role. Student behaviour is unchanged.
  - `lib/chat/upload.ts`: chat photo and document attachments.
  - `lib/employer/feedFilters.ts`: the ten filters, in the server's canonical form.
  - `lib/employer/jobs.ts`: job states, IST helpers, and the job-video check and upload.
- **New tokens:**
  - `height['header-avatar']`
  - `leadingNative['display-page']`
  - `height['film-progress']`
  - `height['lock-shoulders-w']` and `height['lock-shoulders-h']`
  - `height['profile-thumb-w']` and `height['profile-thumb-h']`
  - `height['profile-film']`

## Screens
| Section | Screens |
|---|---|
| 01 Onboarding | Welcome EM-01, two-step registration EM-02/02b, two-code verify EM-03, sign in EM-01b/c, forgot password (new) |
| 02 Home and verification | Home EM-04 (pending) and EM-04b (verified, four real counts), Documents EM-05, Submitted EM-05b, Status EM-06 in review / 06b more documents / 06c not approved / 06d approved, Company EM-07 |
| 03 Discovery | Feed EM-08 (swipe deck) with its states 08b–08f, Filters EM-11, Saved searches EM-12, profile sheet, profile page EM-09/09b, full video EM-10b, Send Interest EM-13/13b/13c, Shortlist EM-14/14b, notes, tags and job EM-15, Interests EM-16/16b |
| 04 Jobs | Jobs EM-17/17b, two-step editor EM-18/18b with video EM-18c, job detail EM-19 and delete EM-19b, applicants EM-20, applicant EM-21 with the reject sheet EM-21b |
| 05 Chat | Connections EM-24 with the row menu and block EM-24b, Chats EM-25/25b with search, thread EM-26/26b |
| 06 Account | Account EM-27, Notifications EM-28/28b, Notification settings EM-29 |

**Old routes removed** (the design draws these as sheets): `FeedFilters`, `SavedSearches`, `SendInterest`, `ShortlistEntry`.

**`JobEditor`** now takes `{ id? }` for edit mode.

## Backend added for this (apostrophe-admin)
The full rows are in `docs/API.md`.
- **Feed filters:**
  - `GET/PUT/DELETE /employers/feed/filters` stores the ten filters on the account, so they are the same on the phone and the web.
  - `/employers/candidates` applies the stored set by default.
  - The cursor carries a fingerprint of the filter set, so a cursor from a different set restarts at page one.
- **Match count:** `GET /employers/feed/match-count` is free. It returns `{matches, narrowest}` and powers the count on the Filters sheet and the one-tap "Clear X to see N" on the caught-up state.
- **Saved searches:** now in the ten-field shape. The old shape is converted.
- **Document download:** `GET /employers/candidates/:id/documents/:docId` returns a 15-minute link. The profile now lists `documents`.
- **Contact details:** a connection returns `contact {email, mobile}` only when both the connection and the student's account are ACTIVE.
- **Last swipe:** `GET /employers/swipes/last` lets Undo work after a restart.
- **Migration:** `migrations/20260925000000-em11-feed-filters.js` must run in each environment. It backfills `feedTier` and `studyDomains`, creates the filters index and rewrites old saved searches. Until it runs, existing profiles match no Tier or Field-of-study filter.

## Deviations from the artboards (real data only)
**Onboarding and verification**
- **Welcome film card:** placeholders ("Candidate name", "QUALIFICATION · CITY · LENGTH"). The badge has no date.
- **Home (pending):**
  - The design draws only "in review". Not yet submitted, more documents and not approved reuse the same card, each with its own badge, step and action.
  - "Account created" has no date, because the API has no account creation date.
- **Home (verified):** each count comes from its own endpoint and shows a dash if its read fails. "Jobs · applicants" shows the applicant count only when every live job was read.
- **Documents:**
  - Kept from the web: the "what is accepted" line under the segmented control, and the errand modes (resubmit, add, answer).
  - The file is re-labelled when its kind is switched after upload.
  - The disabled button keeps its reason line.
- **Status:** adds a DOCUMENTS card listing every requirement with its own badge. A refusal names the document that failed; what passed stays passed.
- **EM-06b:** both the dashed card and the foot's Resubmit open Documents at the requested item. Uploads happen there.
- **Company profile:**
  - No About block and no Edit, because there is no field and no endpoint for them.
  - Live jobs are shown only when verified.

**Discovery**
- **Feed card:**
  - The "Full" button carries no length, because the card has no duration.
  - "Field of study" is not on the card; the tier and qualification line is used.
  - Remote willingness is not on the card either.
- **Filters:**
  - Experience is a floor (1+, 3+ or 5+ years), not the design's bands, because the API has a minimum only.
  - Availability is a "joins within" threshold.
  - The long master-data lists show the chosen values first, then 8 more, then a search field.
- **Profile sheet and page:**
  - The ⋯ menu on the profile page is not drawn, because the design gives it no actions.
  - Shortlisting from the profile is a right swipe, the same as the card. The old code sent a LEFT swipe, which was a bug.
- **Shortlist rows:**
  - The thumbnail is the photo (the row carries no film). It opens the full interview.
  - The Interest state comes from `/employers/interests`.
  - "Open chat" opens the thread when it is known.
  - CSV export opens the signed link.
- **Interests:**
  - No "Expired" tab, because an expiry reads as Not accepted to the sender.
  - Rows show the linked job, not tier and city, which are not in the payload.

**Jobs**
- "Not approved" is derived: a DRAFT that carries a moderator reason.
- **Editor:**
  - Required skills are hidden, because the API takes ids and no endpoint resolves them.
  - Hybrid is not offered, because there is one `remote` flag.
  - A Requirements list is added, because submitting needs one.
  - "Save draft" saves the whole post.
- **Applicant:**
  - A rejection reason is required (the server refuses a rejection without one).
  - Connected cannot be set by the employer.
  - "Open chat" opens the Chats list, because the application detail has no thread id.

**Chat**
- **Connections:**
  - One list, with active connections first and archived ones dimmed.
  - Withdraw uses the block dialog's frame with an optional reason.
  - Block with report needs a report reason, because the report API requires one.
- **Thread:** report reasons are chips.

**Account**
- **Account:**
  - VERIFIED next to the email and mobile shows only when `/auth/me` says so.
  - Sign out now also clears the session stored on the phone. The old screen did not.
- **Settings:** one row per category, because preferences are per category, not per event. Locked rows and unused channels come from the server.

## Not done / not verified
- None of this has been tested on a device yet; it needs your manual pass.
- Rename of a saved search (the backend has no `PATCH` yet).
- These files are no longer used but not deleted, because deleting is blocked: `components/employer/CandidateCard.tsx`, `CertificateRail.tsx`, `EmployerNav.tsx`, `FeedExplainer.tsx` and `DocumentStatusRow.tsx`. They are the only files `theme:check` still flags in `components/employer`.
- `src/lib/api/interviewer.ts(305)` still has its old type error, which is outside this work.

---

# Studio rebuild (2026-10-01)

The employer screens were rebuilt to the **Studio** direction the user chose for every screen. The approved mockup with specs is `docs/employer-app-studio.html`; the four-way comparison it came from is `docs/employer-app-mockups.html`.

## Shared pieces
- **`components/employer/studio.tsx`:** the Studio building blocks.
  - Layout: `StudioGreeting`, `StudioCard`, `StudioLabel`, `SectionBlock`.
  - Counts and progress: `CountCard`, `Meter`, `ExpiryBar`.
  - People and media: `FilmStill`, `GlassPill`, `Face`, `Initials`.
  - Content: `NoteWell`, `FactTile`, `SkillTags`.
  - Controls: `IconSquare`, `StudioChip`, `ChipRow`, `SegTabs`.
  - States and feedback: `StudioState`, `StudioToast`.
- **`lib/employer/feedDeck.ts`:** one candidate deck, shared by Home and the Feed.
  - The server charges a card each time it delivers one (`employerLimits.consumeQuota`) and does not de-duplicate. So Home's "Today's feed" films are the Feed's own first cards, and nothing is read twice.
  - The deck resets on a new employer session, on a new IST day, and when the filters change.
- **New icons:** `arrowU`, `chevU`, `grad`, `link`, `sort`, `arrowUR`.
- **Bottom bar:** the employer Chats tab now shows the unread count as a number badge instead of a dot.

## Screens
| Screen | Frames | Files |
|---|---|---|
| Home | H1 verified (top), H2 scrolled (the title moves into the bar), H3 pending | `EmployerHomeScreen.tsx` |
| Feed | F1 deck, F2/F3 swipes, F4 skip, F5 limit, F6 caught up, F7 filters | `EmployerFeedScreen.tsx`, `components/employer/feed.tsx`, `FeedFiltersModal.tsx` |
| Profile | P1 top, P2 scrolled (compact sticky header), P3 Send Interest sheet | `CandidateProfileScreen.tsx`, `components/employer/profile.tsx`, `SendInterestModal.tsx` |
| Shortlist | S1 cards with the note, S2 notes/tags/job sheet, S3 empty | `EmployerShortlistScreen.tsx`, `ShortlistEntryModal.tsx` |
| Interests | I1 awaiting, I2 accepted, not-accepted tab | `EmployerInterestsScreen.tsx` |
| Jobs | J1 list, J2 applicants | `EmployerJobsScreen.tsx`, `JobApplicationsScreen.tsx` |

## Feed behaviour
- **Swipe right / left:** unchanged — Shortlist, and Pass for `passHideDays`.
- **Scroll down (drag the card up) skips** the candidate.
  - The next card rises. No request is sent and nothing is saved; the toast's **Back** puts the card on top again.
  - A skipped person is not excluded, so they can come back when the deck restarts.
  - The card was already charged when it loaded, so a skip does not refund it.
- **Axis lock:** the drag's axis is decided once, after 12 dp, so one drag never triggers two actions.
- **Round controls:** Undo, Pass, Shortlist, Send Interest. Undo applies to a pass or shortlist only, not to a skip. Send Interest opens the sheet.
- **Profile:** tapping the name or facts opens the **profile page** (P1) instead of the old sheet.
  - Pass or Shortlist made there removes the card from the deck (`dropCard`) and goes back to the feed.
  - `CandidateProfileSheet.tsx` is no longer used by the feed.
- **Chips:** the first chip shows the live match count (`/employers/feed/match-count`, which costs nothing).

## Deviations and API gaps
- **Home:**
  - A film tile opens the feed at its top card, not at that candidate.
  - Activity rows open Notifications.
  - "Today's feed" reads 4 cards on the first visit of the day, which spends 4 of the day's cards. The feed continues from them.
- **Profile:**
  - The detail API sends no film, poster, headline, salary, notice period or interview duration. These come from the deck card when the candidate is in the deck; otherwise only the photo is shown.
  - "Full · 18:42" therefore shows no length.
  - The person line reads "Graduation · Tier 2", because the API sends qualification types, not degree names.
  - A profile read charged a card every time, so the next chevron made it easy to pay twice for someone the feed had already charged. **Fixed — see below.**
- **Shortlist:**
  - Rows carry no salary, joins or skills, and no tier or qualification today.
  - There are no per-tag counts and no tags endpoint, so every page is still read up front.
  - The card's small tag and job chips are under 44 dp.
- **Interests:**
  - The 48-hour amber window is a UI constant.
  - Contact details show only when the connection returns `contact` (active connections only).
  - Unread counts come from the first 50 threads.
- **Jobs:**
  - Applications return only the job id and title, so J2 also reads the job for its header.
  - The reject sheet is copied from `ApplicantDetailScreen`, not shared.
  - The "⋯" menu offers "Job post" and "Edit".
- **Sizes:** where the mockup's value has no token, the nearest token is used. Pills are 24 instead of 22; some labels are 14 instead of 13 or 14.5.

## Fixed after the rebuild (2026-10-01)
- **Expired films no longer cost cards.**
  - Before, the feed refreshed lapsed film links by reading a page of 15 cards again, and the server charged all 15.
  - Backend (apostrophe-admin):
    - `candidateFeed` now records every card it deals in a per-employer, per-IST-day Redis set.
    - New `POST /employers/feed/media {ids}` (`server/domain/feed/media.ts`, documented in `docs/API.md`) re-signs film, poster and photo for those cards only, for free.
    - Tests: 4 new in `tests/feed.test.ts` (47/47 pass); `employers` and `routeGuards` gate suites 353/353.
  - App:
    - `refreshDeckMedia` in `lib/employer/feedDeck.ts` calls the new endpoint.
    - It is used by the feed card, and by the profile film, whose `onError` previously did nothing.
  - No migration is needed; deploy the backend before (or with) the app.
- **A profile view costs at most one card per candidate per day.**
  - `candidateDetail` now claims the card in the same per-day "delivered" set the feed writes. It is free if the feed already dealt that card today, or the profile was already opened today — from the feed, the shortlist, Interests or a chat.
  - It still costs one card for someone not dealt today.
  - A dealt card's profile also opens after the day's cards are spent; before, it was refused.
  - A refused charge removes the claim.
  - Tests: 4 more in `tests/feed.test.ts` (51/51). The other suites that open profiles (`chat`, `feedFilters`, `selfVideoLifecycle`, `employers`, `routeGuards`, `eligibility`) pass. The 2 failures in `scorecard.test.ts` are in scorecard submission and the interviewer dashboard, not related to this change.
- **Shortlist on a profile always goes back now** to wherever the profile was opened from (the feed, Interests, a chat), the same as Pass; to the feed if there is nothing behind it.
- **The app crashed when any video started (the feed autoplays one)** with `NoSuchMethodError … androidx.media3.exoplayer.DefaultLoadControl.<init>` in `ReactExoplayerView$RNVLoadControl`.
  - Cause: `react-native-vision-camera` depends on `androidx.camera` 1.7.0-alpha03, which pulls `androidx.media3` up to **1.9.0**. `react-native-video` 6.19.2 was built for 1.8.0, and 1.9.0 changed that constructor.
  - Fix: `react-native-video` **6.19.3**, which builds its load control through `DefaultLoadControl.Builder` and supports Media3 1.8–1.10. Only that package changed in the lockfile.
  - Pinning media3 back to 1.8.0 was rejected: camera-video's media3-muxer needs 1.9.0, so video recording could break.
  - This needs a native rebuild (`npx react-native run-android`) on every machine after `npm install`.
- **"296 match" but one card in the deck (2026-10-02).**
  - Cause 1: the match count did not apply the feed's ready-video rule (RC-10), and the deck applied it only after the query. 290 seeded profiles with no recording were counted, and they made empty pages that the phone had to walk through.
    - Fix: `READY_VIDEO_STAGES` (`feed/aggregation.ts`) runs in the deck query (aggregation and Atlas drivers) and in match-count. The count is now exactly what the deck can deal.
  - Cause 2: a deck walk keeps its order for the day, so candidates published after it started, or ranked above where it had reached, never appeared.
    - App fix: when the deck has run out, coming back to the feed starts it again from page one.
    - Backend fix (so the restart is free): the feed charges only candidates not already dealt today. This is the same "one card per candidate per day" rule as profile views. At the day's limit, cards already paid for still come back, and the first new card is refused as before.
  - Tests: `feed` 54/54 (3 new) and `employers` 343/343. One employers test was updated from "a second walk is refused" to the new rule.
- **Small buttons are semibold again.** `Body` (`components/ui/Type.tsx`) now honours every weight it has a style for:
  - `sm` used to drop semibold, `xs` dropped medium and semibold, and `md`/`base` dropped medium.
  - Every `Button size="sm"` label, and the 15 `Body` uses that asked for those weights, now get the weight they asked for. This applies to every persona.
  - The Interests and Jobs workarounds (a bigger button squeezed down) were switched back to `size="sm"`.
- **Not fixed, outside this scope:**
  - The web feed (`apostrophe-user/app/employers/feed/FeedClient.tsx` `refreshStreams`) still re-reads a charged page; it can use the same endpoint.
  - `__tests__/App.test.tsx` fails to load in Jest, because `react-native-vision-camera`'s NitroModules has no Jest mock. This is unrelated to these changes.

## Not verified
- None of this has run on a device or emulator; it needs your manual pass. The swipe, skip and back gestures in particular need a feel check on a real phone.
- Checks run: `tsc` (0 errors), `eslint` (clean on the rebuilt files), `check-raw-design-values` (none in the rebuilt files), `jest` (6 of 7 suites, 64/64 tests; App.test cannot load, see above), and the Android production bundle (builds).

## Video feed — `docs/tinder-feed-mockups.html` design 1 (2026-10-02)

The feed keeps the Studio bar and filter chips, as the user chose ("keep both rows, dark"). While a card is up, the page, the bar, the chips and the tab bar go to ink, and the card runs down to 10 pt above the tab bar. The four round buttons (Undo · Pass · Shortlist · Interest) are fixed over the foot of the card, and the toast sits at the top of the card. The shared pieces are in `src/components/ui/feed-deck.tsx`; the student feed uses the same file.

- **Restored:** the **Full** button (watch the full interview) and the poster under the film while it loads. The uncommitted restyle had dropped both.
  - The poster now sits over the film until its first frame (`onReadyForDisplay`, with the first progress tick as a fallback), so there is no black flash.
- **Interest:** ✈ is disabled while an Interest is pending, and an "Interest sent" pill explains why. That matches the profile sheet.
- **Skip holds the controls** for its 240 ms, so an Undo or Back can't land mid-flight.
- **Dropped:** the white "third card" ghost behind the deck, which would show as a white slab on ink. The mockup draws two cards.
- **Light page kept for:** the lock state (with the how-to list), the day's limit, caught up and the error state.
- **Not verified on a device:** the emulator was signed in as a student.

### Mockup A built — "Twin + dark sheet" (2026-10-02)

Direction A of `docs/feed-details-mockups.html`, as on the student feed.

- **Card:**
  - The tag has no outline and reads "Verified interview · date".
  - The name is 22 pt.
  - The card has no bottom edge and fades into black straight into the tab bar.
  - The tab bar has no top rule.
- **Profile sheet:** `CandidateProfileSheet` is now the dark `FeedSheet`.
  - Head: face, name, the green tick, "T2 · Graduation · city", ✕.
  - The film row: the still, "Verified interview", and "Watch full interview".
  - Facts: Expected (pink), Joins, Experience, Based in.
  - Sections: experience, education, looking for, skills, languages, self-uploaded clips (they play in place), documents (a 15-minute link) and links.
  - Foot: ✕ Pass, ♥ Shortlist, and the pink "Send Interest", which reads "Interest sent" when one is pending.
  - Everything the old light sheet did still works: the Interest sheet, the clip player and the document download.
- **Unused now:** `ProfileHead`, `ProfileFacts` and `ProfileSections` in `components/employer/profile.tsx` have no other users. They were left in place.
- **Not verified on a device:** the emulator is signed in as a student.
