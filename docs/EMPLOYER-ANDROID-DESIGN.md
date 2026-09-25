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
