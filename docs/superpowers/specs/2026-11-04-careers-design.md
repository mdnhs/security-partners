# Careers — design

Figma (file n9okZmcE9G39grNSyZRJfc): listing 548:18, job detail 549:285,
application form 550:285. Read with the figma-desktop MCP
(`get_design_context` per section) while building each page.

## Goal

The site gets a Careers area the owner runs alone from the admin panel:
publish job openings, close them, and receive and process applications
(with CV), with no developer involved.

## Public pages

1. `/careers` (548:18): PageHero; "Why Join Security Partners" (4 icon cards);
   "Open Positions" (search box, location and contract-type selects, category
   chips with counts, job cards: category tag, Open/Urgent tag, title,
   location, employment type, shift, pay, "Posted … ago", Apply now);
   "Previous Openings" (closed/filled jobs, "Closed on …", "Position filled");
   "Our Hiring Process" (4 numbered steps); closing CTA banner ("Don't see the
   right role?", Send your CV → contact, Call).
2. `/careers/<slug>` (549:285): hero with tags, title, meta chips, Apply now and
   Share; About the role; Key responsibilities; What we're looking for
   (Essential / Desirable); What we offer (intro + icon list); equal-opportunity
   note; sidebar Job summary (reference, location, type, hours, pay, start,
   closing date, Apply, Share), "Questions about this role?" (contact person),
   "Before you apply" checklist; "Similar roles" (3, same category first).
3. `/careers/<slug>/apply` (550:285): seven numbered sections — 01 Personal
   details, 02 Right to work in Ireland, 03 PSA licence (+ card upload,
   qualifications), 04 5-year history & screening (repeatable periods, Garda
   vetting, lived abroad), 05 Experience & availability (shifts), 06 CV & cover
   note (CV upload, cover note, how did you hear), 07 Declaration & consent;
   sidebar: applying for, what happens next, your data, need help. A success
   state replaces the form after submitting.

Header nav and footer quick links gain "Careers" (between Blog and Contact).

## Admin

- Pages › Careers: every piece of page copy on the three pages (hero, cards,
  section headings, hiring steps, CTA, job-page shared copy such as "Before you
  apply", equal-opportunity note and the default contact person, apply-page
  intro and sidebar copy) — a fixed page `careers` with its own template,
  edited in the existing page editor (draft, publish, revisions, SEO).
- Careers › Jobs: list (status Draft / Open / Closed, filter), create, edit
  (versioned editor: draft, publish, revisions, preview; metadata comes from the title and summary, no per-job SEO overrides), change
  address (301 from a published one), mark filled, delete.
- Careers › Applications: list (filter by job and status, search name/email),
  detail (every answer, CV and PSA card download), status
  (new → reviewing → shortlisted → interview → offered → hired / rejected),
  internal note, delete. A "new" count badge on the nav item.
- Settings › Careers: notification recipients, retention months.

## Rules

- A job is **open** when published, not marked filled, and its closing date is
  today or later (Europe/Dublin). Open jobs list under Open Positions and accept
  applications; published jobs that are not open list under Previous Openings
  (newest closing date first, at most 6) and their detail page shows a closed
  notice without Apply; their apply page shows the same notice and the API
  refuses submissions.
- Unknown or unpublished `/careers/<slug>` and `/careers/<slug>/apply` are real
  404s decided in proxy.ts (as `/services/<slug>`). A live job address is a live
  page for the redirects feature; sitemap lists `/careers` and published jobs;
  the detail page carries schema.org JobPosting JSON-LD (validThrough = closing
  date).
- Applications are personal data: files are stored privately (never a media
  row, never served by the public media route), downloaded only through an
  admin route with `application:read`; emails never attach files; applications
  older than `careers.retentionMonths` are purged with their files by a
  recurring job. Honeypot, Turnstile (when configured) and a rate limit
  (5 per 10 minutes per IP) guard the public endpoint, as for leads.
- Uploads: CV PDF/DOC/DOCX ≤ 5 MB (required); PSA card JPG/PNG/PDF ≤ 5 MB
  (optional); the type is decided by sniffing the bytes, not the name.
- Permissions: `job` read/create/update/publish/delete (owner, admin, editor;
  marketer and viewer read); `application` read/update/delete
  (owner, admin; intake read/update).
- Copy is never hard-coded in components: it comes from the careers page,
  the job, or settings.

## Out of scope

Applicant accounts and emails to applicants, ATS/Indeed integrations,
scheduled job publishing, multiple languages. The design's "Save Job" becomes
"Share" (native share / copy link), the same action as the sidebar's
"Share this job".
