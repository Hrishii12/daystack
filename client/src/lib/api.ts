export const TASK_STATUSES = ['Not Started', 'In Progress', 'Blocked', 'Done'] as const
export const PRIORITIES = ['Low', 'Medium', 'High'] as const
export const TICKET_STATUSES = ['To Do', 'In Progress', 'In Review', 'Blocked', 'Done'] as const

export type TaskStatus = (typeof TASK_STATUSES)[number]
export type Priority = (typeof PRIORITIES)[number]
export type TicketStatus = (typeof TICKET_STATUSES)[number]

export interface Task {
  id: number
  title: string
  description: string
  status: TaskStatus
  priority: Priority
  due_date: string
  jira_id: string | null
  completed_at: string | null
  carried_count: number
}
export interface Ticket {
  id: number
  ticket_key: string
  title: string
  url: string
  status: TicketStatus
  priority: Priority
  notes: string
  on_plate: number
  date_added: string
}
export interface Note {
  id: number
  title: string
  content: string
  kind: 'note' | 'quick'
  task_id: number | null
  ticket_id: number | null
  task_title: string | null
  ticket_key: string | null
  completed: number
  completed_at: string | null
  created_at: string
  updated_at: string
}
export interface Reminder {
  id: number
  title: string
  remind_date: string
  remind_time: string
  task_id: number | null
  ticket_id: number | null
  task_title: string | null
  ticket_key: string | null
  completed: number
}
export interface Activity {
  id: number
  day: string
  type: string
  message: string
  created_at: string
}
export interface Summary {
  date: string
  completed: Task[]
  pending: Task[]
  blocked: Task[]
  activity: Activity[]
  total: number
}
export interface HistoryDay {
  day: string
  completed: number
  created: number
  carried: number
  events: number
}

export class ApiError extends Error {
  status: number
  details?: Record<string, string>
  constructor(status: number, message: string, details?: Record<string, string>) {
    super(message)
    this.status = status
    this.details = details
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Is the API running on port 4000?')
  }
  if (res.status === 204) return undefined as T
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(res.status, data.error || 'Request failed', data.details)
  return data as T
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  del: (path: string) => request<void>('DELETE', path),
}
