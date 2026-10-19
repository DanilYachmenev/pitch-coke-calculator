# Publication verification

Checked on 2026-10-19. The site has been published and its HTTPS content and core browser behavior verified. The limits of browser automation are listed below.

## Source and package

- The seven website files, including the empty `.nojekyll`, are byte-for-byte identical to the original calculator. Financial formulas, presets, UI and browser persistence code were not edited.
- Documentation and the deployment workflow are separate from the static deployment artifact.
- `npm test`: 34 passed, 0 failed. All eight reference profits match within $0.02.
- `npm run package`: exactly seven website files in `dist/`.
- Local HTTP checks under `/pitch-coke-calculator/`: every packaged file returned 200 and matched the expected file bytes.

## Browser checks on the local project subpath

- Initial load displayed A1 profit $16,598.67.
- EN/RU switching worked.
- Desktop viewport: 1280 px. Mobile viewport: 390 × 844 px. Page width matched viewport width at both sizes; mobile expenses displayed as cards.
- Changing sea freight from $925 to $1,000 recalculated default profit to $7,706.67.
- Opened each reference case through the comparison controls; the displayed profits matched A1–B4 references.
- Created a synthetic custom snapshot, changed the active configuration, restored the snapshot, and reloaded. The restored profit remained $48,446.40.
- JSON and CSV were downloaded through the UI. The downloaded JSON passed schema validation; the downloaded CSV matched the engine-generated report byte-for-byte, including nine compared scenarios.
- Changed the selling price, imported the downloaded JSON through the file chooser, and verified restoration to $48,446.40.
- Created a share link, confirmed its `/pitch-coke-calculator/` path, changed inputs and opened the link. The previous configuration and profit were restored; the fragment was consumed while retaining the subpath.
- No browser warning/error console entries were captured after these checks.
- Inspected the loaded print media rules: they provide the dedicated report view. Native print/PDF rendering was not exercised.

Direct `file://` browsing was not retried because the verification browser's URL policy disallows that protocol. Local-file runtime behavior remains unchanged.

## Public-data review

The explicit source allowlist was inspected. Automated checks found no credential-like values, private key blocks, email contacts or absolute local filesystem paths. No environment files, archives, screenshots, private source directories or business documents were copied. The UI runtime has no fetch/XHR/WebSocket/beacon calls or cookie writes; calculations and URL-fragment decoding remain local. GitHub receives ordinary static hosting requests.

The owner explicitly approved public disclosure of the existing A1–B4 values and names, including the route, purchase and selling prices, freight rates, Currency Conversion and Antin commissions, loading and container count. No assumptions have been changed.

## Published site

- Website: https://danilyachmenev.github.io/pitch-coke-calculator/
- Public repository: https://github.com/DanilYachmenev/pitch-coke-calculator
- [Initial deployment succeeded](https://github.com/DanilYachmenev/pitch-coke-calculator/actions/runs/39276066485): the 34 tests, static package and Pages deployment all passed.
- The HTTPS entry page and all five referenced CSS/JS assets returned HTTP 200 and matched local source bytes and SHA-256 hashes. Requesting `README.md` from the website returned 404, confirming that repository documentation was excluded from the static artifact.
- On the actual HTTPS site, verified initial A1 profit, EN/RU switching, an edited freight rate, and all eight reference scenarios through the comparison controls. Every displayed reference profit matched the required amount.
- Created and restored a synthetic custom snapshot; refreshing preserved its $48,446.40 profit. A share link retained the correct HTTPS origin and project subpath and restored the same state after inputs were changed.
- Downloaded JSON and CSV from the HTTPS site. JSON passed schema validation; CSV matched the engine's full-precision report byte-for-byte, including nine compared scenarios. Importing the JSON through the file chooser restored the expected profit.
- No warning/error console entries were captured during these functional checks.
- The initial workflow reported deprecated Node.js 20 action runtimes. The deployment workflow was updated to current Node.js 24 actions and a fixed Ubuntu 24.04 runner. See the [workflow runs](https://github.com/DanilYachmenev/pitch-coke-calculator/actions/workflows/pages.yml) for the current commit's deployment result.

### Browser automation limits

Mobile layout was visually checked locally at 390 × 844 px against the same byte-identical website files. A second viewport check on the public origin was not completed: the automation connection stopped responding when the cleanup step opened a native confirmation for deletion of the synthetic test snapshot. That native confirmation was not reported as successfully handled. It does not change the published source or other visitors' browser storage.

Native print/PDF rendering and direct `file://` use were not exercised. The print stylesheet was inspected and offline/local-file code was preserved unchanged. No unexecuted native-dialog or public-mobile check is reported as passed.

## Publication preparation

- GitHub CLI authentication completed for the intended owner account.
- The authenticated repository lookup confirmed that the requested repository does not exist.
- A new independent Git repository was initialized outside the original calculator and operations working trees.
- The public repository and Pages site were created only after the owner approved the commercial disclosures and completed GitHub CLI authentication. Commit authors use the owner's public GitHub noreply address.

No third-party license was added. The original calculator directory and the unrelated operations repository were not modified.
