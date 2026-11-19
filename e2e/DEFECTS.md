# DayStack: defect log

Found by the Playwright suite in `daystack.spec.ts`. Each defect has a test that asserts the **correct** behaviour and is
marked `test.fail()`. The suite stays green while the bug exists. Once a bug is fixed, its test reports
"Expected to fail, but passed". Remove the `knownDefect(...)` line to turn it into a normal regression test.

Run date: 2026-11-19 · Browser: Chromium (Playwright) · Result: 112 passed (105 behaving tests + 7 confirmed defects)

| ID | Severity | Area | Summary | Test |
|---|---|---|---|---|
| DEF-001 | Medium | API / validation | Impossible dates accepted | API-17 |
| DEF-002 | Medium | API / carry-forward | `ids: []` moves **all** unfinished tasks | API-24 |
| DEF-003 | Low | API / validation | `on_plate: "false"` is stored as true | API-34 |
| DEF-004 | Medium | UI / layout | Long unbroken title breaks the Tasks page | UI-28 |
| DEF-005 | Medium | UI / layout (mobile) | Long unbroken title breaks the Daily Summary page | UI-29 |
| DEF-006 | Medium | Accessibility | Form labels not linked to inputs | UI-75 |
| DEF-007 | Low | UI / reminders | Alert toast outlives its deleted reminder | UI-55 |

Evidence for every defect is in the HTML report (`npm run report`). Open the test and look at the attached screenshot,
trace (step-by-step DOM snapshots), video on failure, and for API tests `api-evidence.json` (full request and response).

---

### DEF-001 · Impossible calendar dates are accepted (Medium)
- **Steps:** `POST /api/tasks` with `{ "title": "x", "due_date": "2026-02-31" }`
- **Expected:** `400` with a validation error on `due_date`.
- **Actual:** `201`. The value is stored and later renders as an invalid date.
- **Cause:** [`server/src/lib/validate.js`](../server/src/lib/validate.js) checks only the `YYYY-MM-DD` pattern with a regex.
- **Fix:** after the regex, round-trip it: `new Date(v + 'T00:00:00')`, compare back to `v`. Reject on mismatch. This also covers `date_added`, `remind_date` and the carry-forward `from` and `to`.

### DEF-002 · Empty `ids` array carries forward every task (Medium)
- **Steps:** `POST /api/tasks/carry-forward` with `{ "from": "<today>", "to": "<tomorrow>", "ids": [] }`
- **Expected:** `{ moved: 0 }`, and nothing changes. An explicit empty selection means "nothing".
- **Actual:** every unfinished task due on or before `from` is moved. I hit this by accident during development.
- **Cause:** [`server/src/api/tasks.js`](../server/src/api/tasks.js) uses `ids?.length ? … : <all>`, so `[]` is treated like "no ids".
- **Fix:** branch on `ids === undefined` for "all". Treat an array, even an empty one, as an explicit selection.
- **Risk:** a UI bug that sends an empty selection silently reshuffles the user's whole task list.

### DEF-003 · `on_plate: "false"` is stored as true (Low)
- **Steps:** `POST /api/tickets` with `{ ..., "on_plate": "false" }`
- **Expected:** rejected, or read as `0`.
- **Actual:** stored as `1`, because the `bool` rule uses plain JS truthiness (`"false"` is truthy).
- **Fix:** accept only `true/false/1/0` (and optionally `"true"/"false"`); reject everything else with a `400`.

### DEF-004 · Long unbroken title overflows the Tasks page (Medium)
- **Steps:** create a task titled with 200 characters and no spaces, then open **Tasks**.
- **Expected:** the title wraps or truncates inside its card, and the page does not scroll sideways.
- **Actual:** the card grows beyond the viewport and the page scrolls horizontally.
- **Cause:** the title `<p>` in [`TaskRow.tsx`](../client/src/components/TaskRow.tsx) has no `break-words` / `min-w-0`.
- **Fix:** add `break-words` (or `[overflow-wrap:anywhere]`) to titles and notes, and make sure flex children have `min-w-0`. The same fix applies to ticket titles and sticky-note text.

### DEF-005 · Long title breaks the Daily Summary page on phones (Medium)
- **Steps:** create a task with a 200-character unbroken title, set the viewport to 375px wide, open **Daily Summary**.
- **Expected:** no horizontal scroll.
- **Actual:** the left column grows to about 2700px wide, because the activity entry (`Added task "…"`) and the group row cannot wrap. The text is cut off or the page scrolls sideways.
- **Note:** the activity log is permanent, so one long title keeps breaking this page until the database is cleaned.
- **Fix:** same `break-words` / `min-w-0` treatment in [`Summary.tsx`](../client/src/pages/Summary.tsx), plus truncating long titles when writing activity messages on the server.

### DEF-006 · Form labels are not associated with inputs (Medium, accessibility)
- **Steps:** open any dialog (New task) and look for the "Title" field by its label (`getByLabel('Title')`).
- **Expected:** the input is reachable by its label. Screen readers announce "Title", and clicking the label focuses the field.
- **Actual:** none of the inputs have an accessible name. `Field` renders `<Label>` and the control side by side with no `htmlFor` / `id` link.
- **Fix:** in [`common.tsx`](../client/src/components/common.tsx), give `Field` a `useId()` and pass it to both the label (`htmlFor`) and the child control (`id`), or wrap the control in the `<label>`. Select controls need `aria-labelledby`.

### DEF-007 · Reminder alert toast outlives the reminder (Low)
- **Steps:** have an overdue reminder, so the "Reminder · time" toast appears. Delete that reminder from the Reminders page.
- **Expected:** the stale toast is dismissed.
- **Actual:** the toast stays for about 12 seconds with a **Done** button. Clicking it calls `PUT /reminders/:id` on a missing record and shows an error.
- **Fix:** give each alert toast a stable `id` (the reminder key) and call `toast.dismiss(id)` when the reminder disappears from the list or is completed or edited.

---

## Observations not covered by an automated test
- **Stale default date on tickets:** `date_added: { default: today() }` in [`server/src/api/tickets.js`](../server/src/api/tickets.js) is evaluated **once at server start**. A server left running past midnight stamps new tickets with the previous day. Fix: make the default a function evaluated per request. It cannot be tested without controlling the server clock.
- **Activity log is append-only and has no cleanup endpoint.** This is a test-isolation limit, not a bug. The suite wipes tasks, tickets, notes and reminders before each test, but activity rows accumulate within a run. The long-content tests run last for that reason.

## Findings ruled out
- Narrow-viewport screenshots that looked cut off during development turned out to be a headless-browser window minimum. Phone layouts of all six pages were verified without horizontal scroll (UI-74) when data is normal.
