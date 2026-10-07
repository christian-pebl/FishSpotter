# FishSpotter engagement: deep check and next steps, 7 October 2026

A check of the engagement plan against the live database (read-only queries, 7 Oct 2026),
the code on `main` (`705d866`), the Business Brain and Atlas reporting files, and published
research on citizen-science retention. It builds on the 2 September growth plan
(`implementation/2026-09-02/master-priorities.md` and `engagement-plan.md`, which exist only
as untracked files in the `E:` checkout). Step 1 below is the PR this file ships with.

## The goal is a funder number

FishSpotter is the engine for Atlas (National Lottery Climate Action Fund, via WWF-UK)
Objective 3. The indicator is OP 3.2, public citizen scientists active, meaning at least one
identification in the last 30 days. The recovery curve is 12 by the end of 2026, 25 by
mid-2027 and 40 by 31 July 2027. The semi-annual report for July to December is due
31 January 2027, with drafts in mid-December, and it releases the February tranche.
Source: `Ocean/05 - R&D - PEBL/11-Atlas/01 - Reporting and admin/260731-Reporting ending July 2026/Atlas Community & Engagement Plan - MEL recovery.md`.

The new `/admin/metrics` card computes it as distinct spotters with an ID in the 30 UTC days
up to and including the day, PEBL staff excluded, guests and children included.

| Day (end of) | Active, last 30 days |
|---|---|
| 31 Jul 2026 | 36 |
| 31 Aug 2026 | 26 |
| 30 Sep 2026 | 85 |
| 7 Oct 2026 | 85 |

The target is met today, but it will not hold on its own:

- Almost everyone in the count was last active in September. If none of them return, about
  68 drop out by 25 October and nearly all by early November.
- New spotters are arriving at about 8 a week (18 the week before).
- Holding 40 needs roughly 10 new or returning spotters a week, every week, including
  December (when Christian is on leave and nothing is deployed) and July 2027.

So the job is a steady inflow that runs without Christian, not a one-off spike.

## What the check found

| Earlier claim | Verdict | Evidence |
|---|---|---|
| The 29 Aug spike was an idle tab | Right, and larger | The tracker counted any time a clip was the active card in a visible tab, with no idle or playback check. One signed-out tab logged 1,151 of the 2,837 minutes in the 90 days. Capping one tab at 5 minutes per clip leaves 1,419. |
| Not coming back is the main leak | Numbers right, conclusion wrong | Of the 127 spotters whose first ID was at least 14 days ago, 72% played on one day and 10% came back after a week. The Zooniverse mean across seven projects is 73% one-day (Sauermann and Franzoni 2015). It is normal. |
| Return is low | Understated | Guest logins lapsed 7 days after the last visit. A guest returning later started again as a new player with no Pebbles. Fixed in step 1. |
| We cannot reach most people | Right, and worse | 194 accounts, 150 of them guests. 44 have an email, 14 verified. 1 digest opt-in, 2 new-clip email opt-ins. The digest opt-in exists only on `/account`. |
| Power users are running out of clips | Wrong | The top spotter has done 96 of the 143 live clips (67%). Nobody has cleared the board. |
| SciStarter is the channel that works | Half right | It brought 51 of the 87 spotters with a traceable first session, but 1 of those 51 came back after a week (5 of 22 from direct links). Its sessions fell from 19 a week in late September to 7, then 2. |
| Links were not tagged | Wrong | The festival flyer carried `utm_source=flyer`. The app dropped tags when a visitor landed on `/` and tapped Start spotting. Zero tagged sessions were ever recorded. Fixed in step 1. |
| Something broke on 29 Sep | Ruled out | 11 of the 12 people who signed up from 29 Sep made IDs. Fewer people arrived. |

### Channels (first consented session per spotter)

| Channel | Spotters | IDs | Came back another day | Came back after 7+ days |
|---|---|---|---|---|
| SciStarter | 51 | 458 | 10 | 1 |
| Direct or unknown | 22 | 302 | 10 | 5 |
| Facebook | 5 | 25 | 0 | 0 |
| Search | 4 | 24 | 1 | 0 |
| Reddit | 3 | 4 | 0 | 0 |
| Teams | 2 | 2 | 0 | 0 |

64 spotters have no consented session, so no channel. Sessions here mean consented tabs that
reached the feed, not site visits.

### Groups

Four bursts of 4 to 11 accounts were created within a single hour.

| Started | Accounts | Came from | IDs | Came back another day |
|---|---|---|---|---|
| 3 Sep, 15:00 UTC | 10 | direct link | 163 | 8 |
| 16 Sep, 17:00 UTC | 11 | SciStarter | 98 | 0 |
| 17 Sep, 17:00 UTC | 7 | SciStarter | 67 | 0 |
| 23 Sep, 17:00 UTC | 4 | SciStarter | 48 | 2 |

Eight of the ten in the 3 Sep group came back on later days, mostly in sessions at the same
hour the following week, the best retention in the data. It is one group, so treat it as a
lead, not proof. It suggests a leader who runs a second session brings people back, and a
one-off assignment does not.

### Audience

Since the age question went live on 17 Sep, 32 of the 47 sign-ups who gave an age are under
18 (24 aged 13 to 17, 8 under 13). 33 of the 85 currently active are under 18. The crowd's
leading answers name 43 different species across 8 sites. 103 of the 143 live clips have reached
consensus; 10 have fewer than three IDs.

## Code facts that shaped the steps (main at `705d866`)

- Guest sessions lapsed 7 days after the last visit, and a lapsed guest cannot sign back in.
- Guest starts shared the auth limit of 5 per 15 minutes per address.
- UTM tags were read from the feed's URL at the first consented clip, after the query was gone.
- Watch time had no idle check, and counted while paused, behind the tour or the age gate.
- The digest opt-in is only on `/account`. The streak nudge uses the same opt-in, adults only.
- A "N new clips since your last visit" banner exists for signed-in accounts, guests
  included, and an opt-in daily new-clips email for verified ones.
- No share button on clips on the live site (only the archive's "share this selection").
  About 500 lines of uncommitted share and digest work sit in the `E:` checkout on
  `fix/snip-metadata-gate`, 96 commits behind main.
- The prize is visible only on `/pebbles`. #191 (merged 7 Oct) lets staff mark a prize as
  posted without the trust and activity checks, which the published prize rules (16 Sep)
  still describe.
- No class, group, team or join-code concept exists. No SciStarter integration exists.

## Next steps

**1. Plumbing PR (this PR).** Claude built it; Christian reviews, about 45 minutes.
- Keep campaign tags from the landing page, in memory only. Until it merges, point any QR
  code at `/feed?utm_source=...`.
- Give guest starts their own limit of 40 per 15 minutes per address, so a group can start
  together. Sign-in, signup and claim stay at 5.
- Keep guests signed in for 90 days, members and staff for 7 as before.
- Count watch time only within 2 minutes of the last input, and cap one tab at 5 minutes
  per clip in the totals.
- Put the Atlas number on `/admin/metrics`, in the CSV and in `db:stats`.

**2. Restart SciStarter, October.** Christian or Anjali, about an hour.
- Refresh the listing. It predates Spot It and the prizes, and says nothing about ages.
- Email info@scistarter.org for a newsletter or blog slot.
- Affiliate status is free and unlocks teachers' class tracking, but it means sending a
  hashed email for each linked SciStarter member. Wait until the child-safety sign-offs close.

**3. Three adult group pilots, October to November.** Anjali.
- Run the two adult groups WWF was told about in the July MEL update, one university marine
  cohort (SAMS or MBA) and one Wildlife Trust group, plus Seasearch through Beth Ford.
- A 30-minute session, then a second one a week later. The repeat is what made the 3 Sep
  group stick.
- A tagged link per group (`?utm_campaign=<group>`) once step 1 is live, so we can see which
  groups come back.

**4. A monthly clip drop from November.** Dani, as the 3 Oct estate review proposes, if
Christian confirms. The banner and email exist and have nothing to announce. A fixed day each
month gives groups and lapsed spotters a reason to return and the January report a story.

**5. The email ask, after step 1.** Claude.
- An unticked "email me when new clips land" box in the save prompt, adults first. A
  pre-ticked box is not valid consent (ICO, Planet49), and a CIC cannot use the soft opt-in.
  13 to 17 year olds can consent themselves, but the Children's Code wants a DPIA before
  marketing email to them.
- A note about a week after someone's last visit saying wrong guesses still help. It is the
  one re-engagement email with a randomised trial behind it (Segal et al. 2015).

### Decisions for Christian

1. Confirm the estate review's line (hold the product, fix the plumbing, adults first) and
   Dani owning the monthly drop.
2. Close the open child-safety items: solicitor review, privacy-notice phone number, director
   sign-offs, prize closing date. Minors are already 39% of active spotters.
3. Align the published prize rules with #191's staff posting, or the code with the rules,
   before anyone is awarded.
4. Salvage or drop the uncommitted share and digest work in the `E:` checkout.

### Dropped for now

Class codes (nothing to extend, sign-offs open, adults first), weekly clip drops (nobody has
run out), web push (iPhones only support it once the site is added to the home screen), and
the contested-clips shelf.

### Time

About 2 hours of Christian's time in October (PR review, SciStarter email, decisions), none in
December if steps 1 to 4 are running by mid-November.

## Sources

- Sauermann and Franzoni 2015, crowd science contribution patterns: https://pmc.ncbi.nlm.nih.gov/articles/PMC4311847/
- Segal et al. 2015, re-engagement email trial: https://archives.iw3c2.org/www2015/documents/proceedings/companion/p331.pdf
- Spiers et al. 2019, contribution inequality across 63 Zooniverse projects: https://jcom.sissa.it/archive/18/01/JCOM_1801_2019_A04
- ICO, consent for marketing email: https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-direct-marketing-using-electronic-mail/how-do-we-comply-with-the-pecr-electronic-mail-marketing-rules/
- Data (Use and Access) Act 2025, s114 (charity soft opt-in): https://www.legislation.gov.uk/ukpga/2025/18/section/114
- SciStarter affiliates: https://scistarter.org/affiliates
- SciStarter participation API: https://scistarter.org/api-key-and-hashing-example-source-code
- FishSpotter on SciStarter: https://scistarter.org/fishspotter
- WebKit, web push on iOS: https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
