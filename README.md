# Truwater Document Generator

A Next.js + shadcn/ui app that turns one form into Truwater Word documents (.docx):

- **RFQ**: the Quotation Project Summary (A4 landscape, Aptos)
- **Technical Proposal**: the cover page (A4 portrait, Arial)
- **Commercial Proposal**: the 9-page commercial proposal (cover, cover letter, pricing per tower, scope of
  supply, optional items, delivery schedule, terms)

Each document is filled from a real Word template in `public/templates/`, so the logo, photos, fonts,
sizes, borders and footer come straight from the original files. Filling happens in the browser with
[docxtemplater](https://docxtemplater.com).

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000. The sidebar has:

- **Dashboard** (`/`): quick links to start a document and, later, recent documents
- **Documents** (`/documents`): shared RFQ and Technical Proposal fields, plus a Commercial Proposal tab; each document can be downloaded as Word
- **History** (`/history`): saved projects, one per TTA quote number. Every "Save project" is kept as a version (compressed, in Vercel Blob under `projects/<quote>/`) with notes of what changed; each project and version opens from its own link, `/documents?project=TTA0160` (latest) or `&version=<id>`
- **Tower Selector** (`/selector`, master account only): finds the towers in each maker's CTI certified performance table (CTI_49 SI PDF, uploaded on the page and stored under `selector/tables/`) that cool a duty typed or scanned from the RFQ. Flows at the duty are fitted from the certified points (`src/lib/cti.ts`); motor and plan size come from the model name where the nomenclature is known (`modelDetails` in `src/lib/selector.ts`, EVAPCO AT/UT/USS so far)
- **Account**: reserved for login (coming soon)

Sidebar items are listed in `NAV_ITEMS` in `src/components/app-shell.tsx`.

## Templates

| Template | Placeholders |
| --- | --- |
| `public/templates/rfq.docx` | `{documentTitle}` (title + footer), `{projectTitle}`, `{projectAddress}`, `{quoteNumber}`, `{date}`, `{dateQuoteRequired}`, `{customerDetail}`, `{contactName}`, `{contactEmail}`, `{contactPhone}`, `{salesmanName}`, `{salesmanEmail}`, `{salesmanPhone}`, `{greeting}`, `{summaryIntro}`, `{#folderLink}…{/folderLink}`; the spec table sits in a `towerSpecs` loop (one table per tower type, with `{heading}` when there's more than one) holding `{spec_<key>}` for each row in `SPEC_ROWS` |
| `public/templates/technical-proposal.docx` | `{projectTitle}`, `{customerDetail}`, `{modelLine}` (one line per tower type), `{referenceNumber}`, `{r1_rev}` … `{r5_remarks}` (revision rows 1–5: `rev`, `date`, `status`, `preparedBy`, `checkedBy`, `approvedBy`, `remarks`) |
| `public/templates/commercial-proposal.docx` | Made from the original Word proposal. Cover: `{projectTitle}`, loops `coverParties` and `coverTowerLines`, `{commercialReference}`, revision rows. Letter: `{clientLine}`, `{attention}`. Pricing (towers 1–2): `{t1_equipment}` … `{t2_price}`, `{flowType}`. Scope: `scopeTables` loop (one table per tower type, with `{heading}` when there's more than one) around the `scope` table-row loop. Optional items: loops `constructionSpares`, `specialTools`, `recommendedSpares`, rates, `{travelTerms}`. Delivery: loop `responsibilities`, `{deliveryNotes}`, `{s1_description}` … `{s6_duration}`, `{deliveryTime}`. Terms: `{priceBasis}`, loop `priceClauses`, `{validity}`, `{paymentAdvance}`, `{paymentBalance}`, `{warranty}` |

To change a layout, open the template in Word, edit it, and keep the `{placeholders}` where the values go.
Whatever formatting a placeholder has (font, size, bold, colour) is what the filled value gets.

### Adding a regional partner

The Technical Proposal cover can be addressed to the customer, a regional partner or any other name
("Addressed To" on the form). The RFQ always keeps the customer. To add a region (e.g. Victoria,
Darwin), add one line to `PARTNERS` in `src/lib/proposal.ts`:

```ts
{ id: "victoria", region: "Victoria", name: "Company Name Pty Ltd" },
```

A button for it appears automatically on the form.

### Adding a new document

1. For a template-based document, save the Word file into `public/templates/` and add `{placeholders}` where values should go.
2. Add an entry to `DOCUMENTS` in `src/lib/templates.ts` with its label, template path, file name and a
   function mapping the form data to the placeholders. For programmatically authored Word files, add a
   generator in `src/lib/` and route its document kind through `generateDocument`.

A download button for it appears automatically at the bottom of the form.

## Where things live

- `src/lib/proposal.ts`: form fields, default values, spec rows, reference number
- `src/lib/templates.ts`: document registry and template filling
- `src/components/app-shell.tsx`: sidebar navigation
- `src/components/proposal-form.tsx`: the form UI
- `src/components/ui/*`: shadcn/ui components
