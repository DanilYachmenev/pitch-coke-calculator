# Pitch Coke Calculator

Client-side shipment economics calculator for Pitch Coke. No backend, account, database, analytics, external API, runtime dependency or build framework.

Website: https://danilyachmenev.github.io/pitch-coke-calculator/

## Features

- English/Russian interface, desktop layout and mobile expense cards.
- Editable expenses in USD/RUB/VND: per MT, per container, per shipment, percentage of revenue or transportation.
- Instant financial totals per MT, container and shipment.
- Eight reference scenarios, independent saved snapshots and side-by-side comparison.
- Automatic browser persistence, JSON backup/import, share links, CSV export and print/PDF layout.
- Separate cargo/bag arithmetic with fractional-bag warnings.

## Use locally

Download the source ZIP, extract it and open `index.html` in a modern browser. Keep the neighboring JS/CSS files together. This requires no internet connection. The hosted site has no service worker; download the files for reliable offline use.

Optional HTTP preview with Node.js 22 or newer:

```bash
cd pitch-coke-calculator
npm start
```

Open `http://127.0.0.1:8080`. Stop with Ctrl+C. No `npm install` is needed. Use `PORT=8081 npm start` for another port.

## Financial assumptions

All results are USD, before tax. Exchange rates mean RUB or VND per one USD. Values are model assumptions, not verified current freight quotations.

```text
Cargo MT       = containers × net MT per container
Gross revenue  = cargo MT × selling USD/MT
USD rate       = RUB amount / RUB-per-USD, or VND amount / VND-per-USD
Expense total  = USD rate × cargo MT, containers, or 1 shipment
Transport base = enabled non-percentage Transportation rows
Revenue fee    = percentage / 100 × gross revenue
Transport fee  = percentage / 100 × transport base
Total costs    = all enabled expense totals
Profit         = gross revenue − total costs
Cost per MT    = total costs / cargo MT
Profit margin  = profit / gross revenue × 100
```

Percentages never enter the transport commission base or compound. Categories control summary grouping; the commission base is displayed separately. The default base includes rail, sea and inland freight, excluding goods and additional expenses.

The model uses container counts, not railway platforms. Full JavaScript Number precision is retained until display. A zero denominator displays `—`; invalid active financial inputs block the entire financial result. Fixed shipment expenses still apply with zero containers. Changing container type requires separate loading and monetary transportation quotes; a type restores only its own previously entered profile.

## Reference scenarios

All cases use 114 containers, goods at $5/MT, rail at 86,900 RUB/container, sea at $925/container, additional expenses at $200/container, a revenue conversion fee of 4%, and RUB-per-USD of 85.10.

- A1–A4: selling price $153/MT, inland $450/container; loading is 20, 20, 18, 18 MT; Antin is 4%, off, 4%, off.
- B1–B4: selling price $145/MT, inland off; loading is 20, 20, 18, 18 MT; Antin is 4%, off, 4%, off.
- Expected shipment profits, respectively: A1 $16,598.67; A2 $27,525.12; A3 −$15,749.97; A4 −$4,823.52; B1 $52,440.27; B2 $61,314.72; B3 $21,842.67; B4 $30,717.12. Test tolerance: $0.02.

The JSON files in `examples/` reproduce these cases. `examples/reference-scenarios.csv` contains the default report and comparison.

## Persistence, exports and privacy

The current configuration, language and saved snapshots live in `localStorage`. They are scoped to the browser profile and site origin, may be cleared by the browser, and do not migrate automatically from local files or localhost to HTTPS. Use JSON backups. Storage failures display a warning. Saved snapshots are independent; restoring defaults keeps the library.

JSON export/import preserves one complete version-1 configuration, including expenses, loading and container profiles. Invalid imports leave the current scenario intact. Limits: 250 expenses, 200 characters per text field, 100 saved snapshots.

Share links contain the full configuration as base64url JSON in `#scenario=…`. Anyone with the link can read it. The fragment is decoded locally, then removed from the address bar so subsequent reloads restore the recipient's own edits. URL fragments are not sent in HTTP requests. The application does not upload calculations. Long configurations are better shared as JSON. Localhost/file links are usable only where that address exists.

CSV contains inputs, enabled/disabled expenses, full-precision financial results, loading arithmetic and selected comparisons. It is UTF-8 with BOM, comma-delimited, with quoted fields and protection against spreadsheet formulas in user-controlled text. Import as UTF-8/comma-separated data; select a dot-decimal locale when needed. CSV contains values, not spreadsheet formulas; XLSX export is not included.

Print / PDF uses the browser's print dialog and a dedicated report stylesheet. Bag arithmetic does not certify container payload, physical fit or stowage feasibility. The loading target does not change economic cargo weight.

GitHub serves the public static files and receives ordinary hosting requests. The application adds no tracking, cookies, external fonts or network calls for calculations.

## Tests and deployment

```bash
npm test
npm run package
```

Tests use Node's built-in runner, including all eight profit references, currencies, expense bases, fees, invalid/zero inputs, container profiles, bags, independent copies, persistence, JSON/share round trips and CSV escaping. `package` copies only the seven required website files into `dist/`; source documentation, tests and examples are excluded from the Pages artifact.

GitHub Actions runs tests, packages `dist/` and deploys it to Pages on pushes to `main` or manual workflow dispatch. Configure the repository's Pages source as **GitHub Actions**. All asset references and share links preserve `/pitch-coke-calculator/`.

Publication and browser verification evidence, including any checks the browser tooling cannot execute, is recorded in `VERIFICATION.md`. Direct file persistence and native print/download behavior depend on the browser; they must not be inferred solely from unit tests.

No third-party license has been added.
