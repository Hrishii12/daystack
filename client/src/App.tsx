import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'
import Layout from '@/components/Layout'
import Dashboard from '@/pages/Dashboard'
import Tasks from '@/pages/Tasks'
import Jira from '@/pages/Jira'
import Notes from '@/pages/Notes'
import Reminders from '@/pages/Reminders'
import Summary from '@/pages/Summary'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="jira" element={<Jira />} />
          <Route path="notes" element={<Notes />} />
          <Route path="reminders" element={<Reminders />} />
          <Route path="summary" element={<Summary />} />
          <Route path="*" element={<Dashboard />} />
        </Route>
      </Routes>
      <Toaster position="bottom-right" richColors closeButton />
    </BrowserRouter>
  )
}
