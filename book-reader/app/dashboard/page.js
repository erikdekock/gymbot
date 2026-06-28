import Dashboard from '../../components/dashboard/Dashboard'
import { getChapters } from '../../lib/content'

// Server wrapper: read the chapter list (titles/order) so the dashboard can show
// accurate retention/heat-map axes even for chapters no one has reached yet.
// All reader data is loaded client-side from Supabase inside <Dashboard/>.
export default function DashboardPage() {
  const chapters = getChapters().map((c) => ({ number: c.number, title: c.title }))
  const bookTitle = 'The Book'
  return <Dashboard chapters={chapters} bookTitle={bookTitle} />
}
