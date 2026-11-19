/**
 * DayStack - end-to-end test suite (single file, all scenarios).
 *
 * LAYERS (each rule is verified once, at the layer where it belongs):
 *   API-xx  Contract/validation/business rules, driven through REST only (fast, exhaustive on input rules).
 *   UI-xx   User journeys and UI-only behaviour (rendering, dialogs, feedback, navigation, responsive).
 *           The UI tests do NOT re-assert server validation rules already covered in API-xx; they only check
 *           that the UI surfaces one representative error.
 *
 * TYPES:  [+] positive   [-] negative   [E] edge/boundary
 *
 * KNOWN DEFECTS: tests tagged with knownDefect('DEF-nnn', ...) assert the CORRECT behaviour and are marked
 * test.fail(), so the suite stays green while the bug exists and turns red ("unexpectedly passed") the
 * moment it is fixed, telling you to remove the marker. See DEFECTS.md.
 *
 * EVIDENCE: every test gets a screenshot + trace (playwright.config.ts); API tests attach the full
 * request/response log; key UI steps attach named screenshots. Open the report with `npm run report`.
 */
import { test as base, expect, type APIRequestContext, type Locator, type Page, type TestInfo } from '@playwright/test'

// ───────────────────────────── helpers ─────────────────────────────

const API = 'http://127.0.0.1:4100/api'

const pad = (n: number) => String(n).padStart(2, '0')
const fmtD = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
/** Local YYYY-MM-DD, offset by n days from today. */
const ymd = (n = 0) => { const d = new Date(); d.setDate(d.getDate() + n); return fmtD(d) }
/** Local date + HH:MM for "now + minutes". */
const at = (minutes: number) => { const d = new Date(Date.now() + minutes * 60_000); return { date: fmtD(d), time: `${pad(d.getHours())}:${pad(d.getMinutes())}` } }

interface Res { status: number; body: any }
interface Api {
  get(p: string): Promise<Res>
  post(p: string, data?: unknown, raw?: string): Promise<Res>
  put(p: string, data: unknown): Promise<Res>
  del(p: string): Promise<Res>
  task(o?: Record<string, unknown>): Promise<any>
  ticket(o?: Record<string, unknown>): Promise<any>
  note(o?: Record<string, unknown>): Promise<any>
  reminder(o?: Record<string, unknown>): Promise<any>
}

function makeApi(request: APIRequestContext, log: unknown[], silent = false): Api {
  const call = async (method: string, p: string, data?: unknown, raw?: string): Promise<Res> => {
    const opts: any = raw !== undefined ? { data: raw, headers: { 'content-type': 'application/json' } } : data !== undefined ? { data } : {}
    const r = await request.fetch(`${API}${p}`, { method, ...opts })
    const text = await r.text()
    let body: any = text
    try { body = text ? JSON.parse(text) : null } catch { /* keep text */ }
    if (!silent) log.push({ request: `${method} ${p}`, data: raw ?? data, status: r.status(), response: body })
    return { status: r.status(), body }
  }
  const ok = async (r: Promise<Res>) => { const x = await r; if (x.status >= 300) throw new Error(`Setup call failed: ${x.status} ${JSON.stringify(x.body)}`); return x.body }
  return {
    get: (p) => call('GET', p),
    post: (p, d, raw) => call('POST', p, d, raw),
    put: (p, d) => call('PUT', p, d),
    del: (p) => call('DELETE', p),
    task: (o = {}) => ok(call('POST', '/tasks', { title: 'Task', due_date: ymd(0), ...o })),
    ticket: (o = {}) => ok(call('POST', '/tickets', { ticket_key: `T-${Math.floor(Math.random() * 1e6)}`, title: 'Ticket', ...o })),
    note: (o = {}) => ok(call('POST', '/notes', { content: 'Note body', kind: 'note', ...o })),
    reminder: (o = {}) => ok(call('POST', '/reminders', { title: 'Reminder', remind_date: ymd(1), remind_time: '10:00', ...o })),
  }
}

/** Fixture: wipes all data before every test (test independence) and attaches the API log as evidence. */
const test = base.extend<{ api: Api }>({
  api: async ({ request }, use, testInfo) => {
    const log: unknown[] = []
    const quiet = makeApi(request, [], true)
    for (const res of ['notes', 'reminders', 'tasks', 'tickets']) {
      const list = (await quiet.get(`/${res}`)).body as { id: number }[]
      for (const r of list) await quiet.del(`/${res}/${r.id}`)
    }
    await use(makeApi(request, log))
    if (log.length) await testInfo.attach('api-evidence.json', { body: JSON.stringify(log, null, 2), contentType: 'application/json' })
  },
})

/** Marks a test as covering a confirmed defect (see DEFECTS.md). Test asserts the correct behaviour. */
function knownDefect(id: string, description: string) {
  test.fail(true, `${id}: ${description}`)
  test.info().annotations.push({ type: 'defect', description: `${id}: ${description}` })
}

const snap = async (page: Page, info: TestInfo, name: string) =>
  info.attach(name, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })

async function pick(page: Page, combo: Locator, option: string) {
  await combo.click()
  await page.getByRole('option', { name: option, exact: true }).click()
}

const toastOf = (page: Page, text: string | RegExp) => page.locator('[data-sonner-toast]').filter({ hasText: text }).first()
const dialog = (page: Page) => page.getByRole('dialog')
const alertDialog = (page: Page) => page.getByRole('alertdialog')
const taskCard = (page: Page, title: string | RegExp) => page.locator('div.border-l-4').filter({ hasText: title })
const stat = (page: Page, label: RegExp) => page.locator('[data-slot="card"]').filter({ hasText: label }).locator('p.text-3xl')
const section = (page: Page, heading: RegExp) => page.locator('section').filter({ has: page.getByRole('heading', { name: heading }) })
const sidebar = (page: Page) => page.locator('aside').first()
const stickyCard = (page: Page, text: string | RegExp) => page.locator('div.rounded-sm.border').filter({ hasText: text })
const hasHorizontalScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)

async function fillTask(page: Page, d: { title?: string; description?: string; status?: string; priority?: string; due?: string; jira?: string }) {
  const dlg = dialog(page)
  if (d.title !== undefined) await dlg.getByPlaceholder('e.g. Reproduce the refund bug').fill(d.title)
  if (d.description !== undefined) await dlg.getByPlaceholder('Optional details').fill(d.description)
  if (d.status) await pick(page, dlg.getByRole('combobox').nth(0), d.status)
  if (d.priority) await pick(page, dlg.getByRole('combobox').nth(1), d.priority)
  if (d.due) await dlg.locator('input[type="date"]').fill(d.due)
  if (d.jira !== undefined) await dlg.getByPlaceholder('PAY-1423', { exact: true }).fill(d.jira)
}

// ═══════════════════════════ API LAYER ═══════════════════════════

test.describe('API · service health and robustness', () => {
  test('API-01 [+] health endpoint responds', async ({ api }) => {
    const r = await api.get('/health')
    expect(r.status).toBe(200)
    expect(r.body).toEqual({ ok: true })
  })

  test('API-02 [-] malformed JSON body returns 400 with a clear message', async ({ api }) => {
    const r = await api.post('/tasks', undefined, '{"title": ')
    expect(r.status).toBe(400)
    expect(r.body.error).toBe('Invalid JSON body')
  })

  test('API-03 [-] unknown route returns JSON 404, not HTML', async ({ api }) => {
    const r = await api.get('/does-not-exist')
    expect(r.status).toBe(404)
    expect(r.body.error).toBe('Route not found')
  })

  test('API-04 [-] get/update/delete of a missing record returns 404 (incl. non-numeric id)', async ({ api }) => {
    expect((await api.get('/tasks/999999')).status).toBe(404)
    expect((await api.put('/tasks/999999', { title: 'x' })).status).toBe(404)
    expect((await api.del('/tasks/999999')).status).toBe(404)
    expect((await api.get('/tasks/abc')).status).toBe(404)
  })

  test('API-05 [E] SQL metacharacters in the search filter are treated as literal text', async ({ api }) => {
    await api.task({ title: 'Normal task' })
    const r = await api.get(`/tasks?q=${encodeURIComponent("' OR 1=1 --")}`)
    expect(r.status).toBe(200)
    expect(r.body).toEqual([])
  })
})

test.describe('API · tasks', () => {
  test('API-10 [+] task lifecycle: create with defaults, read, partial update, delete', async ({ api }) => {
    const created = await api.post('/tasks', { title: '  Fix refund bug  ', due_date: ymd(0) })
    expect(created.status).toBe(201)
    expect(created.body).toMatchObject({ title: 'Fix refund bug', status: 'Not Started', priority: 'Medium', description: '', jira_id: null, completed_at: null, carried_count: 0 })
    const id = created.body.id

    const upd = await api.put(`/tasks/${id}`, { priority: 'High' })
    expect(upd.status).toBe(200)
    expect(upd.body).toMatchObject({ priority: 'High', title: 'Fix refund bug' }) // untouched fields preserved

    expect((await api.del(`/tasks/${id}`)).status).toBe(204)
    expect((await api.get(`/tasks/${id}`)).status).toBe(404)
  })

  test('API-11 [+] completing a task stamps completed_at; reopening clears it', async ({ api }) => {
    const t = await api.task()
    const done = await api.put(`/tasks/${t.id}`, { status: 'Done' })
    expect(done.body.completed_at).toBeTruthy()
    const reopened = await api.put(`/tasks/${t.id}`, { status: 'In Progress' })
    expect(reopened.body.completed_at).toBeNull()
  })

  const invalid: [string, Record<string, unknown>, string][] = [
    ['missing title', { due_date: ymd(0) }, 'title'],
    ['whitespace-only title', { title: '   ', due_date: ymd(0) }, 'title'],
    ['title of 201 chars', { title: 'a'.repeat(201), due_date: ymd(0) }, 'title'],
    ['non-text title', { title: 123, due_date: ymd(0) }, 'title'],
    ['unknown status', { title: 'x', due_date: ymd(0), status: 'Nope' }, 'status'],
    ['status is case-sensitive', { title: 'x', due_date: ymd(0), status: 'done' }, 'status'],
    ['unknown priority', { title: 'x', due_date: ymd(0), priority: 'Urgent' }, 'priority'],
    ['missing due date', { title: 'x' }, 'due_date'],
    ['due date in wrong format', { title: 'x', due_date: '19-11-2026' }, 'due_date'],
    ['description of 2001 chars', { title: 'x', due_date: ymd(0), description: 'd'.repeat(2001) }, 'description'],
    ['jira id of 41 chars', { title: 'x', due_date: ymd(0), jira_id: 'J'.repeat(41) }, 'jira_id'],
  ]
  for (const [name, body, field] of invalid) {
    test(`API-12 [-] rejects ${name}`, async ({ api }) => {
      const r = await api.post('/tasks', body)
      expect(r.status).toBe(400)
      expect(r.body.details).toHaveProperty(field)
    })
  }

  test('API-13 [E] boundary lengths are accepted: title 200, description 2000, jira id 40', async ({ api }) => {
    // Exactly 200 chars, with spaces so it wraps (keeps the shared activity log layout-safe for later tests).
    const r = await api.post('/tasks', { title: 'ab '.repeat(66) + 'ab', description: 'd'.repeat(2000), jira_id: 'J'.repeat(40), due_date: ymd(0) })
    expect(r.status).toBe(201)
  })

  test('API-14 [-] update cannot blank a required field', async ({ api }) => {
    const t = await api.task()
    const r = await api.put(`/tasks/${t.id}`, { due_date: null })
    expect(r.status).toBe(400)
    expect(r.body.details).toHaveProperty('due_date')
  })

  test('API-15 [E] clearing the Jira id with an empty string stores null; empty body update is a no-op', async ({ api }) => {
    const t = await api.task({ jira_id: 'PAY-1' })
    expect((await api.put(`/tasks/${t.id}`, { jira_id: '' })).body.jira_id).toBeNull()
    const noop = await api.put(`/tasks/${t.id}`, {})
    expect(noop.status).toBe(200)
    expect(noop.body.title).toBe(t.title)
  })

  test('API-16 [+] filters: status, priority and title search combine', async ({ api }) => {
    await api.task({ title: 'Alpha refund', status: 'Blocked', priority: 'High' })
    await api.task({ title: 'Beta refund', status: 'Blocked', priority: 'Low' })
    await api.task({ title: 'Gamma', status: 'Done', priority: 'High' })
    const titles = async (qs: string) => (await api.get(`/tasks?${qs}`)).body.map((t: any) => t.title).sort()
    expect(await titles('status=Blocked')).toEqual(['Alpha refund', 'Beta refund'])
    expect(await titles('status=Blocked&priority=High')).toEqual(['Alpha refund'])
    expect(await titles('q=refund')).toEqual(['Alpha refund', 'Beta refund'])
    expect(await titles('status=all')).toHaveLength(3) // "all" means no filter
  })

  test('API-17 [-] impossible calendar dates are rejected', async ({ api }) => {
    knownDefect('DEF-001', 'due_date accepts impossible dates such as 2026-02-31 (regex-only validation)')
    const r = await api.post('/tasks', { title: 'Bad date', due_date: '2026-02-31' })
    expect(r.status).toBe(400)
  })
})

test.describe('API · carry-forward', () => {
  test('API-20 [+] moves only the given unfinished tasks and counts the carry', async ({ api }) => {
    const a = await api.task({ title: 'A' })
    const b = await api.task({ title: 'B' })
    const done = await api.task({ title: 'Done one', status: 'Done' })
    const r = await api.post('/tasks/carry-forward', { from: ymd(0), to: ymd(1), ids: [a.id, done.id] })
    expect(r.body).toEqual({ moved: 1, ids: [a.id] }) // Done tasks never move
    const after = async (id: number) => (await api.get(`/tasks/${id}`)).body
    expect(await after(a.id)).toMatchObject({ due_date: ymd(1), carried_count: 1 })
    expect(await after(b.id)).toMatchObject({ due_date: ymd(0), carried_count: 0 })
    expect(await after(done.id)).toMatchObject({ due_date: ymd(0), carried_count: 0 })
  })

  test('API-21 [+] without ids, carries every unfinished task due on or before "from"', async ({ api }) => {
    const old = await api.task({ title: 'Old', due_date: ymd(-3) })
    const today = await api.task({ title: 'Today' })
    const future = await api.task({ title: 'Future', due_date: ymd(5) })
    const r = await api.post('/tasks/carry-forward', { from: ymd(0), to: ymd(1) })
    expect(r.body.moved).toBe(2)
    expect((await api.get(`/tasks/${old.id}`)).body.due_date).toBe(ymd(1))
    expect((await api.get(`/tasks/${today.id}`)).body.due_date).toBe(ymd(1))
    expect((await api.get(`/tasks/${future.id}`)).body.due_date).toBe(ymd(5))
  })

  test('API-22 [-] rejects missing/invalid dates and non-array ids', async ({ api }) => {
    expect((await api.post('/tasks/carry-forward', { to: ymd(1) })).status).toBe(400)
    expect((await api.post('/tasks/carry-forward', { from: 'x', to: ymd(1) })).status).toBe(400)
    expect((await api.post('/tasks/carry-forward', { from: ymd(0), to: ymd(1), ids: 'all' })).status).toBe(400)
  })

  test('API-23 [E] unknown ids move nothing', async ({ api }) => {
    await api.task()
    const r = await api.post('/tasks/carry-forward', { from: ymd(0), to: ymd(1), ids: [999999] })
    expect(r.body.moved).toBe(0)
  })

  test('API-24 [E] an empty ids array must move nothing', async ({ api }) => {
    knownDefect('DEF-002', 'carry-forward with ids:[] is treated as "no ids" and silently moves ALL unfinished tasks')
    const t = await api.task()
    const r = await api.post('/tasks/carry-forward', { from: ymd(0), to: ymd(1), ids: [] })
    expect(r.body.moved).toBe(0)
    expect((await api.get(`/tasks/${t.id}`)).body.due_date).toBe(ymd(0))
  })
})

test.describe('API · tickets', () => {
  test('API-30 [+] ticket is created with defaults and the key is upper-cased', async ({ api }) => {
    const r = await api.post('/tickets', { ticket_key: 'pay-1423', title: 'Refund bug', url: 'https://example.atlassian.net/browse/PAY-1423' })
    expect(r.status).toBe(201)
    expect(r.body).toMatchObject({ ticket_key: 'PAY-1423', status: 'To Do', priority: 'Medium', on_plate: 1, date_added: ymd(0) })
  })

  test('API-31 [-] duplicate ticket key returns 409 (case-insensitive via upper-casing)', async ({ api }) => {
    await api.ticket({ ticket_key: 'PAY-1' })
    const r = await api.post('/tickets', { ticket_key: 'pay-1', title: 'dup' })
    expect(r.status).toBe(409)
    expect(r.body.details.ticket_key).toMatch(/already tracked/)
  })

  const badTickets: [string, Record<string, unknown>, string][] = [
    ['javascript: URL (XSS vector)', { ticket_key: 'X-1', title: 't', url: 'javascript:alert(1)' }, 'url'],
    ['non-URL text', { ticket_key: 'X-1', title: 't', url: 'not a url' }, 'url'],
    ['ftp URL', { ticket_key: 'X-1', title: 't', url: 'ftp://host/file' }, 'url'],
    ['missing key', { title: 't' }, 'ticket_key'],
    ['missing title', { ticket_key: 'X-1' }, 'title'],
    ['unknown status', { ticket_key: 'X-1', title: 't', status: 'Closed' }, 'status'],
    ['bad date_added', { ticket_key: 'X-1', title: 't', date_added: 'yesterday' }, 'date_added'],
  ]
  for (const [name, body, field] of badTickets) {
    test(`API-32 [-] rejects ${name}`, async ({ api }) => {
      const r = await api.post('/tickets', body)
      expect(r.status).toBe(400)
      expect(r.body.details).toHaveProperty(field)
    })
  }

  test('API-33 [E] URL is optional (empty string accepted)', async ({ api }) => {
    expect((await api.post('/tickets', { ticket_key: 'X-2', title: 't', url: '' })).status).toBe(201)
  })

  test('API-34 [E] on_plate must be a real boolean, not the string "false"', async ({ api }) => {
    knownDefect('DEF-003', 'on_plate:"false" is coerced to true (truthy string) instead of being rejected or read as false')
    const r = await api.post('/tickets', { ticket_key: 'X-3', title: 't', on_plate: 'false' })
    expect(r.body.on_plate).toBe(0)
  })
})

test.describe('API · notes and reminders', () => {
  test('API-40 [+] note links to a task and ticket and returns their labels', async ({ api }) => {
    const t = await api.task({ title: 'Linked task' })
    const k = await api.ticket({ ticket_key: 'LNK-1' })
    const n = await api.post('/notes', { content: 'Body', task_id: t.id, ticket_id: k.id })
    expect(n.body).toMatchObject({ task_title: 'Linked task', ticket_key: 'LNK-1', kind: 'note', completed: 0 })
  })

  const badNotes: [string, Record<string, unknown>, string | null][] = [
    ['missing content', {}, 'content'],
    ['whitespace content', { content: '   ' }, 'content'],
    ['content of 10001 chars', { content: 'x'.repeat(10001) }, 'content'],
    ['unknown kind', { content: 'x', kind: 'memo' }, 'kind'],
    ['non-integer task id', { content: 'x', task_id: 'abc' }, 'task_id'],
    ['link to a task that does not exist', { content: 'x', task_id: 999999 }, null],
  ]
  for (const [name, body, field] of badNotes) {
    test(`API-41 [-] rejects ${name}`, async ({ api }) => {
      const r = await api.post('/notes', body)
      expect(r.status).toBe(400)
      if (field) expect(r.body.details).toHaveProperty(field)
    })
  }

  test('API-42 [+] completing a note stamps completed_at; un-completing clears it', async ({ api }) => {
    const n = await api.note()
    expect((await api.put(`/notes/${n.id}`, { completed: true })).body).toMatchObject({ completed: 1 })
    expect((await api.get(`/notes/${n.id}`)).body.completed_at).toBeTruthy()
    const back = await api.put(`/notes/${n.id}`, { completed: false })
    expect(back.body).toMatchObject({ completed: 0, completed_at: null })
  })

  test('API-43 [E] deleting a task or ticket keeps notes/tasks and just unlinks them', async ({ api }) => {
    const t = await api.task({ title: 'To delete', jira_id: 'KEEP-1' })
    const n = await api.note({ task_id: t.id })
    await api.del(`/tasks/${t.id}`)
    const note = (await api.get(`/notes/${n.id}`)).body
    expect(note.task_id).toBeNull()
    expect(note.task_title).toBeNull()

    const k = await api.ticket({ ticket_key: 'DEL-1' })
    const t2 = await api.task({ jira_id: 'DEL-1' })
    await api.del(`/tickets/${k.id}`)
    expect((await api.get(`/tasks/${t2.id}`)).body.jira_id).toBe('DEL-1') // free-text reference survives
  })

  for (const bad of ['24:00', '9:00', '12:60', '12:00:00', 'noon']) {
    test(`API-44 [-] reminder rejects time "${bad}"`, async ({ api }) => {
      const r = await api.post('/reminders', { title: 'x', remind_date: ymd(1), remind_time: bad })
      expect(r.status).toBe(400)
      expect(r.body.details).toHaveProperty('remind_time')
    })
  }

  test('API-45 [E] reminder accepts the first and last minute of the day; rejects bad date', async ({ api }) => {
    expect((await api.post('/reminders', { title: 'a', remind_date: ymd(1), remind_time: '00:00' })).status).toBe(201)
    expect((await api.post('/reminders', { title: 'b', remind_date: ymd(1), remind_time: '23:59' })).status).toBe(201)
    expect((await api.post('/reminders', { title: 'c', remind_date: '2026-1-1', remind_time: '10:00' })).status).toBe(400)
  })

  test('API-46 [+] reminder can be completed and filtered by completion', async ({ api }) => {
    const r = await api.reminder({ title: 'Done soon' })
    await api.reminder({ title: 'Still open' })
    await api.put(`/reminders/${r.id}`, { completed: true })
    expect((await api.get('/reminders?completed=true')).body.map((x: any) => x.title)).toEqual(['Done soon'])
    expect((await api.get('/reminders?completed=false')).body.map((x: any) => x.title)).toEqual(['Still open'])
  })
})

test.describe('API · summary and history', () => {
  test('API-50 [+] daily summary buckets tasks into completed / pending / blocked', async ({ api }) => {
    await api.task({ title: 'D', status: 'Done' })
    await api.task({ title: 'P1', status: 'In Progress' })
    await api.task({ title: 'P2' })
    await api.task({ title: 'B', status: 'Blocked' })
    await api.task({ title: 'Tomorrow', due_date: ymd(1) })
    const s = (await api.get(`/summary?date=${ymd(0)}`)).body
    expect(s.completed.map((t: any) => t.title)).toEqual(['D'])
    expect(s.pending.map((t: any) => t.title).sort()).toEqual(['P1', 'P2'])
    expect(s.blocked.map((t: any) => t.title)).toEqual(['B'])
    expect(s.total).toBe(4)
  })

  test('API-51 [-] invalid summary date is rejected; [E] a future date is simply empty', async ({ api }) => {
    expect((await api.get('/summary?date=nope')).status).toBe(400)
    const s = (await api.get(`/summary?date=${ymd(30)}`)).body
    expect(s).toMatchObject({ completed: [], pending: [], blocked: [], total: 0 })
  })

  test('API-52 [+] activity history counts created and completed tasks for today', async ({ api }) => {
    const today = async () => ((await api.get('/history?days=30')).body as any[]).find((d) => d.day === ymd(0)) ?? { created: 0, completed: 0 }
    const before = await today()
    const t = await api.task({ title: 'History task' })
    await api.put(`/tasks/${t.id}`, { status: 'Done' })
    const after = await today()
    expect(after.created).toBe(before.created + 1)
    expect(after.completed).toBe(before.completed + 1)
  })
})

// ═══════════════════════════ UI LAYER ═══════════════════════════

test.describe('UI · dashboard (My Day)', () => {
  test('UI-01 [+] empty account shows greeting, zeroed stats and friendly empty states', async ({ page, api: _ }, info) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Good (morning|afternoon|evening)/)
    for (const l of [/^Total tasks/, /^In progress/, /^Completed/, /^Blocked/]) await expect(stat(page, l)).toHaveText('0')
    await expect(page.getByText('A clear day ahead')).toBeVisible()
    await expect(page.getByText('No notes yet')).toBeVisible()
    await expect(page.getByText('Tick the checkbox on a task or note to move it here.')).toBeVisible()
    await expect(page.getByText('No upcoming reminders')).toBeVisible()
    await expect(page.getByText('No open tickets')).toBeVisible()
    await snap(page, info, 'empty-dashboard')
  })

  test('UI-02 [+] summary cards and status groups reflect today\'s tasks, each colour-coded by status', async ({ page, api }, info) => {
    await api.task({ title: 'Task NotStarted' })
    await api.task({ title: 'Task Progress', status: 'In Progress' })
    await api.task({ title: 'Task Blocked', status: 'Blocked' })
    await api.task({ title: 'Task Finished', status: 'Done' })
    await page.goto('/')
    await expect(stat(page, /^Total tasks/)).toHaveText('4')
    await expect(stat(page, /^In progress/)).toHaveText('1')
    await expect(stat(page, /^Completed/)).toHaveText('1')
    await expect(stat(page, /^Blocked/)).toHaveText('1')

    await expect(taskCard(page, 'Task Progress')).toHaveClass(/border-l-blue-500/)
    await expect(taskCard(page, 'Task Blocked')).toHaveClass(/border-l-rose-500/)
    await expect(taskCard(page, 'Task NotStarted')).toHaveClass(/border-l-slate-400/)
    await expect(taskCard(page, 'Task Finished')).toHaveClass(/border-l-emerald-500/)

    // Group order on the page: In Progress → Blocked → Not Started
    const y = async (t: string) => (await taskCard(page, t).boundingBox())!.y
    expect(await y('Task Progress')).toBeLessThan(await y('Task Blocked'))
    expect(await y('Task Blocked')).toBeLessThan(await y('Task NotStarted'))
    await snap(page, info, 'colour-coded-groups')
  })

  test('UI-03 [E] only relevant tasks show: overdue unfinished yes, future no', async ({ page, api }) => {
    await api.task({ title: 'Slipped task', due_date: ymd(-2) })
    await api.task({ title: 'Future task', due_date: ymd(3) })
    await page.goto('/')
    await expect(taskCard(page, 'Slipped task')).toContainText('Overdue')
    await expect(page.getByText('Future task')).toHaveCount(0)
  })

  test('UI-04 [+] ticking a task moves it to "Completed today"; unticking returns it', async ({ page, api }, info) => {
    await api.task({ title: 'Ship the fix', status: 'In Progress' })
    await page.goto('/')
    const completed = section(page, /Completed today/)
    await expect(completed.getByText('Ship the fix')).toHaveCount(0)

    await taskCard(page, 'Ship the fix').getByRole('checkbox', { name: 'Mark complete' }).click()
    await expect(toastOf(page, 'Nice, task completed')).toBeVisible()
    await expect(completed.getByText('Ship the fix')).toBeVisible()
    await expect(stat(page, /^Completed/)).toHaveText('1')
    await expect(stat(page, /^In progress/)).toHaveText('0')
    await snap(page, info, 'task-in-completed-bucket')

    await completed.getByRole('checkbox', { name: 'Mark complete' }).click() // untick
    await expect(completed.getByText('Ship the fix')).toHaveCount(0)
    await expect(stat(page, /^Completed/)).toHaveText('0')
  })

  test('UI-05 [+] ticking a sticky note moves it to "Completed today"; unticking restores it', async ({ page, api }, info) => {
    await api.note({ title: 'Retest', content: 'Cart badge after coupon' })
    await page.goto('/')
    const completed = section(page, /Completed today/)
    await page.getByRole('checkbox', { name: 'Mark note as done' }).click()
    await expect(toastOf(page, 'Note moved to Completed')).toBeVisible()
    await expect(completed.getByText(/Cart badge after coupon/)).toBeVisible()
    await expect(page.getByText('No notes yet')).toBeVisible() // board is now empty
    await snap(page, info, 'note-in-completed-bucket')

    await completed.getByRole('checkbox', { name: 'Mark note as not done' }).click()
    await expect(page.getByRole('checkbox', { name: 'Mark note as done' })).toBeVisible()
    await expect(completed.getByText(/Cart badge/)).toHaveCount(0)
  })

  test('UI-06 [+] upcoming reminders widget lists open reminders and flags overdue ones', async ({ page, api }) => {
    const past = at(-30)
    await api.reminder({ title: 'Late reminder', remind_date: past.date, remind_time: past.time })
    await api.reminder({ title: 'Future reminder', remind_date: ymd(2), remind_time: '09:30' })
    await api.reminder({ title: 'Finished reminder', completed: true })
    await page.goto('/')
    const card = page.locator('[data-slot="card"]').filter({ hasText: 'Upcoming reminders' })
    await expect(card.getByText('Future reminder')).toBeVisible()
    await expect(card.getByText('Late reminder')).toBeVisible()
    await expect(card.getByText('Overdue')).toBeVisible()
    await expect(card.getByText('Finished reminder')).toHaveCount(0)
  })

  test('UI-07 [+] "On my plate" shows open on-plate tickets only', async ({ page, api }) => {
    await api.ticket({ ticket_key: 'OPEN-1', title: 'Open one', status: 'In Progress' })
    await api.ticket({ ticket_key: 'DONE-1', title: 'Finished one', status: 'Done' })
    await api.ticket({ ticket_key: 'OFF-1', title: 'Parked one', on_plate: false })
    await page.goto('/')
    const card = page.locator('[data-slot="card"]').filter({ hasText: 'On my plate' })
    await expect(card.getByText('OPEN-1')).toBeVisible()
    await expect(card.getByText('DONE-1')).toHaveCount(0)
    await expect(card.getByText('OFF-1')).toHaveCount(0)
  })

  test('UI-08 [+] dashboard sticky-note quick add saves on Enter and clears the input', async ({ page }) => {
    await page.goto('/')
    const input = page.getByPlaceholder(/Stick a quick note/)
    await input.fill('Ask Priya about flag naming')
    await input.press('Enter')
    await expect(toastOf(page, 'Quick note saved')).toBeVisible()
    await expect(input).toHaveValue('')
    await expect(stickyCard(page, 'Ask Priya about flag naming')).toBeVisible()
  })

  test('UI-09 [E] the board shows at most the six newest open notes', async ({ page, api }) => {
    for (let i = 1; i <= 8; i++) await api.note({ content: `Sticky number ${i}` })
    await page.goto('/')
    await expect(page.getByRole('checkbox', { name: 'Mark note as done' })).toHaveCount(6)
  })
})

test.describe('UI · quick add', () => {
  const kinds: [string, string, string, string][] = [
    ['Task', 'Write regression tests', 'Task added for today', '/tasks'],
    ['Quick note', 'Observed flicker on login', 'Quick note saved', '/notes'],
    ['Reminder', 'Ping the infra team', 'Reminder set for 1 hour from now', '/reminders'],
  ]
  for (const [kind, text, toastText, where] of kinds) {
    test(`UI-10 [+] quick add creates a ${kind.toLowerCase()} that appears on its page`, async ({ page }) => {
      await page.goto('/')
      await sidebar(page).getByRole('button', { name: /Quick add/ }).click()
      await dialog(page).getByRole('button', { name: kind, exact: true }).click()
      await dialog(page).getByRole('textbox').fill(text)
      await dialog(page).getByRole('button', { name: 'Add', exact: true }).click()
      await expect(toastOf(page, toastText)).toBeVisible()
      await expect(dialog(page)).toBeHidden()
      await page.goto(where)
      await expect(page.getByText(text)).toBeVisible()
    })
  }

  test('UI-11 [-] submitting empty quick add is blocked with a hint and the dialog stays open', async ({ page, api }) => {
    await page.goto('/')
    await sidebar(page).getByRole('button', { name: /Quick add/ }).click()
    await dialog(page).getByRole('button', { name: 'Add', exact: true }).click()
    await expect(toastOf(page, 'Type something first')).toBeVisible()
    await expect(dialog(page)).toBeVisible()
    expect((await api.get('/tasks')).body).toHaveLength(0)
  })

  test('UI-12 [+] pressing "q" opens quick add; [-] typing "q" inside a field does not', async ({ page }) => {
    await page.goto('/')
    await page.getByPlaceholder(/Stick a quick note/).click()
    await page.keyboard.type('quick')
    await expect(dialog(page)).toBeHidden()
    await expect(page.getByPlaceholder(/Stick a quick note/)).toHaveValue('quick')

    await page.locator('h1').click()
    await page.keyboard.press('q')
    await expect(dialog(page)).toBeVisible()
    await expect(dialog(page).getByText('Quick add').first()).toBeVisible()
  })
})

test.describe('UI · tasks page', () => {
  test('UI-20 [+] create a task with every field; it persists after reload and appears on dashboard + summary', async ({ page, api }, info) => {
    await api.ticket({ ticket_key: 'PAY-77', title: 'Linked ticket' })
    await page.goto('/tasks')
    await expect(page.getByText('No tasks yet')).toBeVisible()
    await page.getByRole('button', { name: 'New task' }).first().click()
    await fillTask(page, { title: 'Reproduce refund failure', description: 'Use order 88213', status: 'In Progress', priority: 'High', due: ymd(0), jira: 'PAY-77' })
    await snap(page, info, 'task-form-filled')
    await dialog(page).getByRole('button', { name: 'Add task' }).click()
    await expect(toastOf(page, 'Task added')).toBeVisible()
    await expect(dialog(page)).toBeHidden()

    await page.reload()
    const card = taskCard(page, 'Reproduce refund failure')
    await expect(card).toBeVisible()
    await expect(card).toContainText('PAY-77')
    await expect(card).toContainText('High')
    await expect(card).toContainText('Use order 88213')

    await page.goto('/')
    await expect(taskCard(page, 'Reproduce refund failure')).toBeVisible()
    await page.goto('/summary')
    await expect(page.getByText('Reproduce refund failure', { exact: true })).toBeVisible()
  })

  test('UI-21 [-] empty title shows a field error and keeps the dialog open; Cancel saves nothing', async ({ page, api }) => {
    await page.goto('/tasks')
    await page.getByRole('button', { name: 'New task' }).first().click()
    await dialog(page).getByRole('button', { name: 'Add task' }).click()
    await expect(dialog(page).getByText('Required')).toBeVisible()
    await expect(dialog(page)).toBeVisible()

    await dialog(page).getByPlaceholder('e.g. Reproduce the refund bug').fill('Discarded draft')
    await dialog(page).getByRole('button', { name: 'Cancel' }).click()
    await expect(dialog(page)).toBeHidden()
    expect((await api.get('/tasks')).body).toHaveLength(0)
  })

  test('UI-22 [+] edit a task: change title, priority and status; Escape closes without saving', async ({ page, api }) => {
    await api.task({ title: 'Original title' })
    await page.goto('/tasks')
    await taskCard(page, 'Original title').getByRole('button', { name: 'Edit task' }).click()
    await expect(dialog(page).getByText('Edit task').first()).toBeVisible()
    await fillTask(page, { title: 'Changed title', priority: 'High', status: 'Blocked' })
    await dialog(page).getByRole('button', { name: 'Save changes' }).click()
    await expect(toastOf(page, 'Task updated')).toBeVisible()
    const card = taskCard(page, 'Changed title')
    await expect(card).toContainText('High')
    await expect(card).toHaveClass(/border-l-rose-500/)

    await card.getByRole('button', { name: 'Edit task' }).click()
    await dialog(page).getByPlaceholder('e.g. Reproduce the refund bug').fill('Should not save')
    await page.keyboard.press('Escape')
    await expect(dialog(page)).toBeHidden()
    await expect(taskCard(page, 'Changed title')).toBeVisible()
  })

  test('UI-23 [+] inline status dropdown updates the task and its colour', async ({ page, api }) => {
    const t = await api.task({ title: 'Inline change' })
    await page.goto('/tasks')
    const card = taskCard(page, 'Inline change')
    await pick(page, card.getByRole('combobox'), 'In Progress')
    await expect(toastOf(page, 'Status updated')).toBeVisible()
    await expect(card).toHaveClass(/border-l-blue-500/)
    expect((await api.get(`/tasks/${t.id}`)).body.status).toBe('In Progress')
  })

  test('UI-24 [+] filters (range, status, priority, search) narrow the list; empty result offers Clear', async ({ page, api }, info) => {
    await api.task({ title: 'Alpha high blocked', status: 'Blocked', priority: 'High' })
    await api.task({ title: 'Beta low todo', priority: 'Low' })
    await api.task({ title: 'Gamma tomorrow', due_date: ymd(1), priority: 'High' })
    await api.task({ title: 'Delta overdue', due_date: ymd(-1) })
    await page.goto('/tasks')
    const filterStatus = page.getByRole('combobox').nth(0)
    const filterPriority = page.getByRole('combobox').nth(1)

    await page.getByRole('button', { name: 'Today', exact: true }).click()
    await expect(page.getByText('Gamma tomorrow')).toHaveCount(0)
    await page.getByRole('button', { name: 'Upcoming', exact: true }).click()
    await expect(taskCard(page, 'Gamma tomorrow')).toBeVisible()
    await expect(page.getByText('Alpha high blocked')).toHaveCount(0)
    await page.getByRole('button', { name: 'Overdue', exact: true }).click()
    await expect(taskCard(page, 'Delta overdue')).toBeVisible()
    await expect(page.getByText('Beta low todo')).toHaveCount(0)
    await page.getByRole('button', { name: 'All', exact: true }).click()

    await pick(page, filterStatus, 'Blocked')
    await expect(taskCard(page, /./)).toHaveCount(1)
    await pick(page, filterPriority, 'Low') // Blocked + Low = nothing
    await expect(page.getByText('No tasks match these filters')).toBeVisible()
    await snap(page, info, 'filters-empty-result')
    await page.getByRole('button', { name: 'Clear' }).click()
    await expect(taskCard(page, /./)).toHaveCount(4)

    await page.getByPlaceholder('Search title or ticket…').fill('beta')
    await expect(taskCard(page, /./)).toHaveCount(1)
  })

  test('UI-25 [+] delete asks for confirmation; Cancel keeps the task; Confirm deletes AND closes the dialog', async ({ page, api }) => {
    await api.task({ title: 'Delete me' })
    await page.goto('/tasks')
    const card = taskCard(page, 'Delete me')
    await card.getByRole('button', { name: 'Delete task' }).click()
    await expect(alertDialog(page)).toContainText('Delete this task?')
    await alertDialog(page).getByRole('button', { name: 'Cancel' }).click()
    await expect(alertDialog(page)).toBeHidden()
    await expect(card).toBeVisible()

    await card.getByRole('button', { name: 'Delete task' }).click()
    await alertDialog(page).getByRole('button', { name: 'Delete', exact: true }).click()
    await expect(alertDialog(page)).toBeHidden() // regression: dialog used to stay open
    await expect(toastOf(page, 'Task deleted')).toBeVisible()
    await expect(page.getByText('Delete me')).toHaveCount(0)
  })

  test('UI-26 [+] carry forward one task to tomorrow; [+] "Carry all to today" rescues overdue tasks', async ({ page, api }) => {
    await api.task({ title: 'Push to tomorrow' })
    await api.task({ title: 'Stale task', due_date: ymd(-4) })
    await page.goto('/tasks')

    await taskCard(page, 'Push to tomorrow').getByRole('button', { name: 'Carry forward to tomorrow' }).click()
    await expect(toastOf(page, 'Moved to tomorrow')).toBeVisible()
    await expect(taskCard(page, 'Push to tomorrow')).toContainText('Tomorrow')
    await expect(taskCard(page, 'Push to tomorrow')).toContainText('carried 1')

    await expect(page.getByText('1 unfinished task from earlier days.')).toBeVisible()
    await page.getByRole('button', { name: 'Carry all to today' }).click()
    await expect(toastOf(page, 'Moved to today')).toBeVisible()
    await expect(page.getByText(/unfinished task.* from earlier days/)).toHaveCount(0)
    await expect(taskCard(page, 'Stale task')).toContainText('Today')
  })

  test('UI-27 [E] HTML/script in a title is rendered as inert text (no XSS)', async ({ page, api }) => {
    const evil = '<img src=x onerror="window.__xss=1"><script>window.__xss=2</script>'
    await api.task({ title: evil })
    await page.goto('/tasks')
    await expect(page.getByText(evil, { exact: false }).first()).toBeVisible()
    expect(await page.evaluate(() => (window as any).__xss)).toBeUndefined()
    await expect(page.locator('div.border-l-4 img')).toHaveCount(0)
  })

})

test.describe('UI · Jira tracker', () => {
  test('UI-30 [+] add a ticket: key upper-cased, link opens Jira in a new tab, appears on the plate list', async ({ page, api }, info) => {
    await page.goto('/jira')
    await expect(page.getByText('No tickets here')).toBeVisible()
    await page.getByRole('button', { name: 'Add ticket' }).first().click()
    const dlg = dialog(page)
    await dlg.getByPlaceholder('PAY-1423', { exact: true }).fill('pay-9001')
    await dlg.getByPlaceholder('Ticket summary').fill('Receipt page breaks on mobile')
    await dlg.getByPlaceholder(/atlassian\.net/).fill('https://example.atlassian.net/browse/PAY-9001')
    await dlg.getByPlaceholder(/Context, blockers/).fill('Seen on iPhone SE')
    await dlg.getByRole('button', { name: 'Add ticket' }).click()
    await expect(toastOf(page, 'Ticket added')).toBeVisible()

    const card = page.locator('[data-slot="card"]').filter({ hasText: 'PAY-9001' })
    await expect(card).toContainText('Receipt page breaks on mobile')
    await expect(card).toContainText('Seen on iPhone SE')
    const link = card.getByRole('link', { name: 'PAY-9001' })
    await expect(link).toHaveAttribute('href', 'https://example.atlassian.net/browse/PAY-9001')
    await expect(link).toHaveAttribute('target', '_blank')
    await snap(page, info, 'ticket-card')
  })

  test('UI-31 [-] duplicate key and invalid URL surface as readable field errors; dialog stays open', async ({ page, api }) => {
    await api.ticket({ ticket_key: 'DUP-1' })
    await page.goto('/jira')
    await page.getByRole('button', { name: 'Add ticket' }).first().click()
    const dlg = dialog(page)
    await dlg.getByPlaceholder('PAY-1423', { exact: true }).fill('dup-1')
    await dlg.getByPlaceholder('Ticket summary').fill('Second copy')
    await dlg.getByRole('button', { name: 'Add ticket' }).click()
    await expect(dlg.getByText('This ticket ID is already tracked')).toBeVisible()

    await dlg.getByPlaceholder('PAY-1423', { exact: true }).fill('NEW-1')
    await dlg.getByPlaceholder(/atlassian\.net/).fill('javascript:alert(1)')
    await dlg.getByRole('button', { name: 'Add ticket' }).click()
    await expect(dlg.getByText('Must be a valid http(s) URL')).toBeVisible()
    await expect(dlg).toBeVisible()
  })

  test('UI-32 [+] change ticket status inline and persist it', async ({ page, api }) => {
    const t = await api.ticket({ ticket_key: 'ST-1' })
    await page.goto('/jira')
    const card = page.locator('[data-slot="card"]').filter({ hasText: 'ST-1' })
    await pick(page, card.getByRole('combobox'), 'In Review')
    await expect(toastOf(page, 'ST-1 → In Review')).toBeVisible()
    expect((await api.get(`/tickets/${t.id}`)).body.status).toBe('In Review')
  })

  test('UI-33 [+] taking a ticket off the plate hides it from "On my plate" but keeps it under "All tickets"', async ({ page, api }) => {
    await api.ticket({ ticket_key: 'PLT-1' })
    await page.goto('/jira')
    await expect(page.getByText('1 ticket currently on your plate')).toBeVisible()
    await page.getByRole('button', { name: 'Toggle on plate' }).click()
    await expect(page.getByText('0 tickets currently on your plate')).toBeVisible()
    await expect(page.getByText('No tickets here')).toBeVisible()
    await page.getByRole('button', { name: 'All tickets' }).click()
    await expect(page.getByText('PLT-1')).toBeVisible()
  })

  test('UI-34 [+] filters by status and priority; delete closes the dialog and leaves linked tasks intact', async ({ page, api }) => {
    await api.ticket({ ticket_key: 'F-1', status: 'Blocked', priority: 'High' })
    await api.ticket({ ticket_key: 'F-2', status: 'To Do', priority: 'Low' })
    await api.task({ title: 'Task tied to F-2', jira_id: 'F-2' })
    await page.goto('/jira')
    await pick(page, page.getByRole('combobox').nth(0), 'Blocked')
    await expect(page.getByText('F-2')).toHaveCount(0)
    await expect(page.getByText('F-1')).toBeVisible()
    await pick(page, page.getByRole('combobox').nth(0), 'All statuses')

    const card = page.locator('[data-slot="card"]').filter({ hasText: 'F-2' })
    await card.getByRole('button', { name: 'Delete ticket' }).click()
    await expect(alertDialog(page)).toContainText('Remove this ticket?')
    await alertDialog(page).getByRole('button', { name: 'Delete', exact: true }).click()
    await expect(alertDialog(page)).toBeHidden()
    await expect(page.getByText('F-2')).toHaveCount(0)
    await page.goto('/tasks')
    await expect(taskCard(page, 'Task tied to F-2')).toContainText('F-2')
  })
})

test.describe('UI · notes page', () => {
  test('UI-40 [+] create a note linked to a task and a ticket; edit it; delete it (dialog closes)', async ({ page, api }, info) => {
    await api.task({ title: 'Refund task' })
    await api.ticket({ ticket_key: 'NT-1', title: 'Notes ticket' })
    await page.goto('/notes')
    await expect(page.getByText('No notes yet')).toBeVisible()
    await page.getByRole('button', { name: 'New note' }).first().click()
    const dlg = dialog(page)
    await dlg.getByPlaceholder('Optional title').fill('Findings')
    await dlg.getByPlaceholder('Write something…').fill('Rounding differs between services')
    await pick(page, dlg.getByRole('combobox').nth(0), 'Refund task')
    await pick(page, dlg.getByRole('combobox').nth(1), 'NT-1 · Notes ticket')
    await dlg.getByRole('button', { name: 'Add note' }).click()
    await expect(toastOf(page, 'Note added')).toBeVisible()

    const sticky = stickyCard(page, 'Findings')
    await expect(sticky).toContainText('Rounding differs between services')
    await expect(sticky).toContainText('NT-1')
    await expect(sticky).toContainText('Refund task')
    await snap(page, info, 'sticky-note-linked')

    await sticky.getByRole('button', { name: 'Edit note' }).click()
    await dialog(page).getByPlaceholder('Optional title').fill('Findings v2')
    await dialog(page).getByRole('button', { name: 'Save changes' }).click()
    await expect(stickyCard(page, 'Findings v2')).toBeVisible()

    await stickyCard(page, 'Findings v2').getByRole('button', { name: 'Delete note' }).click()
    await alertDialog(page).getByRole('button', { name: 'Delete', exact: true }).click()
    await expect(alertDialog(page)).toBeHidden()
    await expect(page.getByText('Findings v2')).toHaveCount(0)
  })

  test('UI-41 [-] empty note is rejected with a field error; empty quick note is ignored', async ({ page, api }) => {
    await page.goto('/notes')
    await page.getByRole('button', { name: 'New note' }).first().click()
    await dialog(page).getByRole('button', { name: 'Add note' }).click()
    await expect(dialog(page).getByText('Required')).toBeVisible()
    await dialog(page).getByRole('button', { name: 'Cancel' }).click()

    await page.getByRole('button', { name: 'Stick it' }).click()
    await page.getByPlaceholder(/Quick note: jot down/).fill('   ')
    await page.getByPlaceholder(/Quick note: jot down/).press('Enter')
    expect((await api.get('/notes')).body).toHaveLength(0)
  })

  test('UI-42 [+] quick note is added with Enter; [E] quick notes have no Edit action', async ({ page }) => {
    await page.goto('/notes')
    const input = page.getByPlaceholder(/Quick note: jot down/)
    await input.fill('Safari cart badge not updating')
    await input.press('Enter')
    await expect(toastOf(page, 'Quick note saved')).toBeVisible()
    const sticky = stickyCard(page, 'Safari cart badge not updating')
    await expect(sticky).toBeVisible()
    await expect(sticky.getByRole('button', { name: 'Edit note' })).toHaveCount(0)
    await expect(sticky.getByRole('button', { name: 'Delete note' })).toHaveCount(1)
  })

  test('UI-43 [+] completed notes sink below open notes and render struck-through', async ({ page, api }) => {
    await api.note({ title: 'Older', content: 'older body' })
    await api.note({ title: 'Newer', content: 'newer body' }) // newest sorts first
    await page.goto('/notes')
    // Compare DOM order (notes are slightly rotated, so pixel positions are unreliable).
    const order = async () => (await page.locator('div.rounded-sm.border').allInnerTexts()).map((t) => (t.includes('Newer') ? 'Newer' : 'Older'))
    expect(await order()).toEqual(['Newer', 'Older'])

    await stickyCard(page, 'Newer').getByRole('checkbox').click()
    await expect(toastOf(page, 'Note moved to Completed')).toBeVisible()
    await expect.poll(order).toEqual(['Older', 'Newer'])
  })
})

test.describe('UI · reminders page', () => {
  test('UI-50 [+] future reminder lands in Upcoming, past one in Overdue; both can be completed and reopened', async ({ page }, info) => {
    await page.goto('/reminders')
    await expect(page.getByText('No reminders set')).toBeVisible()
    const add = async (title: string, date: string, time: string) => {
      await page.getByRole('button', { name: 'New reminder' }).first().click()
      const dlg = dialog(page)
      await dlg.getByPlaceholder('e.g. Check PR approval').fill(title)
      await dlg.locator('input[type="date"]').fill(date)
      await dlg.locator('input[type="time"]').fill(time)
      await dlg.getByRole('button', { name: 'Add reminder' }).click()
      await expect(toastOf(page, 'Reminder set')).toBeVisible()
    }
    await add('Future thing', ymd(2), '10:30')
    await add('Missed thing', ymd(-1), '08:15')

    await expect(section(page, /^Upcoming/).getByText('Future thing')).toBeVisible()
    await expect(section(page, /^Overdue/).getByText('Missed thing')).toBeVisible()
    await snap(page, info, 'reminder-sections')

    await section(page, /^Overdue/).getByRole('button', { name: 'Mark done' }).click()
    await expect(toastOf(page, 'Reminder completed')).toBeVisible()
    await expect(section(page, /^Completed/).getByText('Missed thing')).toBeVisible()
    await section(page, /^Completed/).getByRole('button', { name: 'Mark as not done' }).click()
    await expect(section(page, /^Overdue/).getByText('Missed thing')).toBeVisible()
  })

  test('UI-51 [E] midnight/noon/last-minute times are formatted correctly in 12-hour clock', async ({ page, api }) => {
    await api.reminder({ title: 'R-midnight', remind_date: ymd(5), remind_time: '00:00' })
    await api.reminder({ title: 'R-noon', remind_date: ymd(5), remind_time: '12:00' })
    await api.reminder({ title: 'R-last', remind_date: ymd(5), remind_time: '23:59' })
    await page.goto('/reminders')
    await expect(page.locator('div.rounded-2xl').filter({ hasText: 'R-midnight' })).toContainText('12:00 AM')
    await expect(page.locator('div.rounded-2xl').filter({ hasText: 'R-noon' })).toContainText('12:00 PM')
    await expect(page.locator('div.rounded-2xl').filter({ hasText: 'R-last' })).toContainText('11:59 PM')
  })

  test('UI-52 [+] edit reschedules an overdue reminder back to Upcoming; delete closes the dialog', async ({ page, api }) => {
    const p = at(-60)
    await api.reminder({ title: 'Reschedule me', remind_date: p.date, remind_time: p.time })
    await page.goto('/reminders')
    const row = page.locator('div.rounded-2xl').filter({ hasText: 'Reschedule me' })
    await row.getByRole('button', { name: 'Edit reminder' }).click()
    await dialog(page).locator('input[type="date"]').fill(ymd(3))
    await dialog(page).getByRole('button', { name: 'Save changes' }).click()
    await expect(section(page, /^Upcoming/).getByText('Reschedule me')).toBeVisible()

    await row.getByRole('button', { name: 'Delete reminder' }).click()
    await alertDialog(page).getByRole('button', { name: 'Delete', exact: true }).click()
    await expect(alertDialog(page)).toBeHidden()
    await expect(page.locator('main').getByText('Reschedule me')).toHaveCount(0)
  })

  test('UI-55 [-] an alert toast must disappear when its reminder is deleted', async ({ page, api }) => {
    knownDefect('DEF-007', 'The in-app alert toast stays on screen (with a "Done" button) after its reminder was deleted; clicking Done then fails with 404')
    const p = at(-5)
    await api.reminder({ title: 'Deleted while alerting', remind_date: p.date, remind_time: p.time })
    await page.goto('/reminders')
    await expect(toastOf(page, 'Deleted while alerting')).toBeVisible()
    const row = page.locator('div.rounded-2xl').filter({ hasText: 'Deleted while alerting' })
    await row.getByRole('button', { name: 'Delete reminder' }).click()
    await alertDialog(page).getByRole('button', { name: 'Delete', exact: true }).click()
    await expect(toastOf(page, 'Reminder deleted')).toBeVisible()
    await expect(toastOf(page, /Reminder · /)).toHaveCount(0)
  })

  test('UI-53 [+] a due reminder raises an in-app toast once; completed ones stay silent', async ({ page, api }, info) => {
    const p = at(-5)
    await api.reminder({ title: 'Alert me now', remind_date: p.date, remind_time: p.time })
    await api.reminder({ title: 'Silent one', remind_date: p.date, remind_time: p.time, completed: true })
    await page.goto('/')
    await expect(toastOf(page, 'Alert me now')).toBeVisible()
    await snap(page, info, 'reminder-toast')
    await expect(toastOf(page, 'Silent one')).toHaveCount(0)

    await toastOf(page, 'Alert me now').getByRole('button', { name: 'Done' }).click() // action button completes it
    await expect(toastOf(page, 'Reminder completed')).toBeVisible()
    await page.reload()
    await page.waitForTimeout(1500)
    await expect(toastOf(page, 'Alert me now')).toHaveCount(0) // not re-alerted after reload
  })

  test('UI-54 [E] a reminder missed by more than 24h is listed Overdue but does not pop a toast', async ({ page, api }) => {
    await api.reminder({ title: 'Ancient reminder', remind_date: ymd(-3), remind_time: '09:00' })
    await page.goto('/')
    await page.waitForTimeout(1500)
    await expect(toastOf(page, 'Ancient reminder')).toHaveCount(0)
    await page.goto('/reminders')
    await expect(section(page, /^Overdue/).getByText('Ancient reminder')).toBeVisible()
  })
})

test.describe('UI · daily summary', () => {
  test('UI-60 [+] shows completed/pending/blocked counts and carries unfinished work to tomorrow', async ({ page, api }, info) => {
    await api.task({ title: 'Finished', status: 'Done' })
    await api.task({ title: 'Working', status: 'In Progress' })
    await api.task({ title: 'Stuck', status: 'Blocked' })
    await page.goto('/summary')
    const counts = async (label: string) => page.locator('[data-slot="card"]').filter({ hasText: new RegExp(`^${label}\\d`) }).locator('p').nth(1).innerText()
    expect(await counts('Completed')).toBe('1')
    expect(await counts('Pending')).toBe('1')
    expect(await counts('Blocked')).toBe('1')
    await snap(page, info, 'summary-before-carry')

    await page.getByRole('button', { name: /Carry forward to/ }).click()
    await expect(toastOf(page, /Carried 2 to tomorrow/)).toBeVisible()
    await expect(page.getByText(/unfinished task/)).toHaveCount(0)
    expect((await api.get('/tasks?due_date=' + ymd(1))).body.map((t: any) => t.title).sort()).toEqual(['Stuck', 'Working'])
  })

  test('UI-61 [+] day navigation: previous day is empty, "next" is disabled on today, history lists today', async ({ page, api }) => {
    await api.task({ title: 'Today only' })
    await page.goto('/summary')
    await expect(page.getByRole('button', { name: 'Next day' })).toBeDisabled()
    await page.getByRole('button', { name: 'Previous day' }).click()
    await expect(page.getByText('Nothing completed on this day.')).toBeVisible()
    await expect(page.getByText('Today only')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Next day' })).toBeEnabled()
    await expect(page.getByRole('heading', { name: 'History' })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Today/ })).toBeVisible()
  })

  test('UI-62 [E] the date picker cannot move into the future', async ({ page }) => {
    await page.goto('/summary')
    await expect(page.locator('input[type="date"]')).toHaveAttribute('max', ymd(0))
  })
})

test.describe('UI · navigation, resilience, responsive, accessibility', () => {
  test('UI-70 [+] every sidebar link opens its page; [E] unknown URL falls back to the dashboard', async ({ page }) => {
    await page.goto('/')
    const pages: [string, string, RegExp][] = [
      ['Tasks', '/tasks', /^Tasks$/], ['Jira Tracker', '/jira', /^Jira Tracker$/], ['Notes', '/notes', /^Notes$/],
      ['Reminders', '/reminders', /^Reminders$/], ['Daily Summary', '/summary', /^Daily Summary$/],
    ]
    for (const [name, url, h1] of pages) {
      await sidebar(page).getByRole('link', { name }).click()
      await expect(page).toHaveURL(new RegExp(`${url}$`))
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(h1)
    }
    await sidebar(page).getByRole('link', { name: 'My Day' }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Good/)
    await page.goto('/definitely/not/a/page')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Good/)
  })

  test('UI-71 [-] when the API is unreachable the page shows an error with Retry, and recovers', async ({ page, api }) => {
    await api.task({ title: 'Survivor' })
    await page.route('**/api/tasks', (r) => r.abort())
    await page.goto('/tasks')
    await expect(page.getByText("Couldn't load data")).toBeVisible()
    await expect(page.getByText(/Cannot reach the server/)).toBeVisible()
    await page.unroute('**/api/tasks')
    await page.getByRole('button', { name: 'Retry' }).click()
    await expect(taskCard(page, 'Survivor')).toBeVisible()
  })

  test('UI-72 [-] a failed save shows an error toast and keeps the user\'s input', async ({ page }) => {
    await page.goto('/tasks')
    await page.getByRole('button', { name: 'New task' }).first().click()
    await fillTask(page, { title: 'Will fail to save' })
    await page.route('**/api/tasks', (r) => (r.request().method() === 'POST' ? r.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"Internal server error"}' }) : r.continue()))
    await dialog(page).getByRole('button', { name: 'Add task' }).click()
    await expect(toastOf(page, 'Internal server error')).toBeVisible()
    await expect(dialog(page)).toBeVisible()
    await expect(dialog(page).getByPlaceholder('e.g. Reproduce the refund bug')).toHaveValue('Will fail to save')
  })

  test('UI-73 [+] mobile layout: sidebar hidden, bottom navigation works', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/')
    await expect(sidebar(page)).toBeHidden()
    const bottom = page.locator('nav.fixed')
    await expect(bottom).toBeVisible()
    await bottom.getByRole('link', { name: 'Tasks' }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tasks')
  })

  for (const route of ['/', '/tasks', '/jira', '/notes', '/reminders', '/summary']) {
    test(`UI-74 [E] ${route} has no horizontal scroll on a 375px phone with data present`, async ({ page, api }, info) => {
      await api.task({ title: 'Mobile task', description: 'A description long enough to wrap onto more than one line on a small screen' })
      await api.ticket({ ticket_key: 'MOB-1', title: 'Mobile ticket title that is fairly long' })
      await api.note({ title: 'Mobile note', content: 'Some content for the note' })
      await api.reminder({ title: 'Mobile reminder' })
      await page.setViewportSize({ width: 375, height: 812 })
      await page.goto(route)
      await page.waitForLoadState('networkidle')
      const overflow = await hasHorizontalScroll(page)
      if (overflow) {
        // Evidence: which elements stick out past the viewport edge.
        const culprits = await page.evaluate(() => [...document.querySelectorAll('body *')]
          .filter((e) => e.getBoundingClientRect().right > window.innerWidth + 1)
          .slice(0, 8).map((e) => `${e.tagName.toLowerCase()}.${(e.className || '').toString().slice(0, 60)} right=${Math.round(e.getBoundingClientRect().right)}`))
        await info.attach('overflowing-elements.txt', { body: culprits.join('\n'), contentType: 'text/plain' })
      }
      expect(overflow).toBe(false)
    })
  }

  test('UI-75 [+] form labels are programmatically associated with their inputs (accessibility)', async ({ page }) => {
    knownDefect('DEF-006', 'Form <label>s are not linked to their inputs (no htmlFor/id), so getByLabel and screen readers find no accessible name')
    await page.goto('/tasks')
    await page.getByRole('button', { name: 'New task' }).first().click()
    await expect(dialog(page).getByLabel('Title')).toBeVisible()
  })

  test('UI-76 [+] dialogs are keyboard friendly: focus lands in the first field and Escape closes', async ({ page }) => {
    await page.goto('/tasks')
    await page.getByRole('button', { name: 'New task' }).first().click()
    await expect(dialog(page).getByPlaceholder('e.g. Reproduce the refund bug')).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(dialog(page)).toBeHidden()
  })
})

// These tests deliberately write a very long unbroken string into the (non-deletable) activity log, which
// would make the Daily Summary page overflow for every later test. Keep this group LAST in the file.
test.describe('UI · long content (keep last: pollutes the activity log)', () => {
  test('UI-28 [E] a 200-character unbroken task title must not break the Tasks page layout', async ({ page, api }) => {
    knownDefect('DEF-004', 'A long unbroken title/note overflows its card and causes horizontal page scroll on the Tasks page')
    await api.task({ title: 'W'.repeat(200) })
    await page.goto('/tasks')
    await expect(taskCard(page, /W{50}/)).toBeVisible()
    expect(await hasHorizontalScroll(page)).toBe(false)
  })

  test('UI-29 [E] the same long title must not break the Daily Summary page (activity timeline)', async ({ page, api }) => {
    knownDefect('DEF-005', 'Daily Summary grows to ~2700px wide when the activity log contains a long unbroken task title')
    await api.task({ title: 'V'.repeat(200) })
    await page.setViewportSize({ width: 375, height: 812 }) // single-column layout is where it breaks
    await page.goto('/summary')
    await expect(page.getByText(/Added task "V{20}/)).toBeVisible() // wait for the activity timeline to render
    expect(await hasHorizontalScroll(page)).toBe(false)
  })
})
