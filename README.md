# DayStack

A personal daily work tracker for people who live in Jira: tasks, tickets on your plate, notes, reminders, and a daily summary with carry-forward.

**Stack:** React + Vite + TypeScript · Tailwind CSS v4 · shadcn/ui · Lucide · Node.js + Express · SQLite (built-in `node:sqlite`)

## Requirements

- Node.js **22.13+** (developed on Node 24). SQLite comes from Node itself, so there is no native module to compile.

## Run it

Use two terminals.

```bash
# Terminal 1 - API on http://localhost:4000
cd server
npm install
npm start            # or: npm run dev  (auto-restart on change)

# Terminal 2 - UI on http://localhost:5173
cd client
npm install
npm run dev
```

Open http://localhost:5173. The Vite dev server proxies `/api` to the backend.

On first start the API seeds a fresh database with sample tickets, tasks, notes and reminders. Data lives in `server/daystack.db` and survives restarts. To reset it to the demo data: `cd server && npm run seed`. To start empty, delete `server/daystack.db*` and remove the seed call in `server/src/index.js`.

Production build of the UI: `cd client && npm run build` (output in `client/dist`).

## Features

| Area | What you can do |
|---|---|
| **My Day** | Greeting, summary cards (Total / In Progress / Completed / Blocked), today's and overdue tasks, upcoming reminders, tickets on your plate, quick add (press **Q**) |
| **Tasks** | Create / edit / delete / complete; status, priority, due date, optional Jira ID; filter by status, priority, range and search; carry forward one task (arrow icon) or all overdue |
| **Jira Tracker** | Add tickets manually (no Jira API), status and priority, notes, link out to Jira, pin or unpin from "on my plate" |
| **Notes** | Full notes linkable to a task and/or ticket, plus a quick-notes strip for testing observations and follow-ups |
| **Reminders** | Date and time, optional task/ticket link, upcoming / overdue / completed sections, in-app toast alerts and browser notifications (enable from the sidebar) |
| **Daily Summary** | Completed, pending and blocked for any day, one-click carry-forward to the next day, activity timeline and 14-day history |

Reminders alert while the app is open in a tab (checked every 15 s). There is no background push.

## REST API

Base URL `http://localhost:4000/api`. Errors return `{ "error": string, "details"?: { field: message } }` with 400 (validation), 404, 409 (duplicate ticket) or 500.

| Resource | Endpoints |
|---|---|
| Tasks | `GET /tasks?status=&priority=&due_date=&q=` · `GET/PUT/DELETE /tasks/:id` · `POST /tasks` |
| Carry forward | `POST /tasks/carry-forward` `{ from, to, ids? }` (no `ids` = all unfinished due on/before `from`) |
| Tickets | `GET /tickets?status=&priority=&on_plate=` · `POST /tickets` · `GET/PUT/DELETE /tickets/:id` |
| Notes | `GET /notes?kind=note\|quick&task_id=&ticket_id=` · `POST /notes` · `GET/PUT/DELETE /notes/:id` |
| Reminders | `GET /reminders?completed=` · `POST /reminders` · `GET/PUT/DELETE /reminders/:id` |
| Summary | `GET /summary?date=YYYY-MM-DD` · `GET /history?days=14` |
| Health | `GET /health` |

## Structure

```
daystack/
├── server/
│   └── src/
│       ├── index.js          # Express app, error handling, first-run seed
│       ├── api/              # REST APIs, one file per resource
│       │   ├── index.js      #   mounts everything under /api
│       │   ├── tasks.js      #   incl. POST /tasks/carry-forward
│       │   ├── tickets.js
│       │   ├── notes.js
│       │   ├── reminders.js
│       │   └── summary.js    #   /summary and /history
│       ├── db/               # Database layer
│       │   ├── index.js      #   SQLite connection + schema
│       │   └── seed.js       #   Demo data
│       └── lib/              # Shared helpers
│           ├── crud.js       #   Generic CRUD router
│           └── validate.js   #   Input validation + HttpError
└── client/
    └── src/
        ├── pages/        # Dashboard, Tasks, Jira, Notes, Reminders, Summary
        ├── components/   # Layout, forms, TaskRow, shared UI, ui/ (shadcn)
        └── lib/          # api client, date helpers, data hook
```

## Notes

- Dates are plain `YYYY-MM-DD` strings in your local time zone; "today" is decided by the browser.
- Deleting a task or ticket keeps linked notes and reminders and just unlinks them.
