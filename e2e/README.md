# DayStack: Playwright e2e tests

All scenarios live in **one file**: [`daystack.spec.ts`](daystack.spec.ts).

## Run

```powershell
cd e2e
npm.cmd install
npx.cmd playwright install chromium     # one-time browser download
npm.cmd test                            # runs everything (~2 min)
npm.cmd run report                      # opens the HTML evidence report
npx.cmd playwright test -g "UI-25"      # run one scenario
npm.cmd run test:headed                 # watch it run
```

The suite starts its **own** API (port 4100, throwaway SQLite file `e2e/.tmp/e2e.db`) and its own Vite dev server (port 5174
pointed at that API). Your real `server/daystack.db` and the app on ports 4000/5173 are never touched. The suite can run
while your dev servers are running.

## How the suite avoids repeating itself

| Layer | IDs | What it covers | What it deliberately does *not* re-test |
|---|---|---|---|
| API | `API-xx` | Every input rule and boundary (lengths, formats, enums, nulls), business rules (completion timestamps, carry-forward, referential behaviour, filters, summary and history) and error contracts | UI rendering |
| UI | `UI-xx` | User journeys, dialogs, feedback toasts, colour-coding, buckets, navigation, responsive layout, resilience, accessibility | The input rules above. Each UI form checks one representative error surfaced to the user |

Other rules the suite follows:
- Each behaviour is checked once. For example, the "delete closes its confirm dialog" regression is checked once per kind of item, and each kind has its own dialog wiring.
- Table-driven cases, for example `API-12` and `API-44`, produce one named test per input instead of copy-pasted tests.
- Every test starts from an empty database (the `api` fixture wipes it), so tests are independent and can be run singly.
- Tags in the test names: `[+]` positive · `[-]` negative · `[E]` edge/boundary.

## Evidence
- **Per test:** a screenshot and a Playwright trace, always. The trace has step-by-step DOM snapshots, network calls and console output.
- **On failure:** a video as well.
- **API tests:** `api-evidence.json` attached to the test, with every request and response.
- **Key UI steps:** named screenshots such as `colour-coded-groups` and `task-in-completed-bucket`.
- **Overflow failures:** `overflowing-elements.txt` lists the elements that stick out of the viewport.
- Everything is browsable in `playwright-report/` (`npm run report`). Raw files are in `test-results/`, with a machine-readable `results.json`.

## Defects
Confirmed bugs are listed in [`DEFECTS.md`](DEFECTS.md). Their tests assert the *correct* behaviour and are wrapped with
`knownDefect('DEF-nnn', …)`, which uses `test.fail()`. The suite stays green while the bug exists, and once someone fixes
the bug the test fails with "Expected to fail, but passed". That is the cue to delete the marker.

## Maintenance notes
- Tests run serially (`workers: 1`) because they share one database.
- The `UI · long content` group must stay **last**: it writes a very long string into the append-only activity log, which would otherwise make the Daily Summary page overflow for later tests.
- Locators use roles, `aria-label`s and placeholders. Once DEF-006 is fixed you can switch form fields to `getByLabel`.
