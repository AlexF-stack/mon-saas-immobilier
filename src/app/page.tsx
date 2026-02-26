import { redirect } from 'next/navigation'

// Fallback redirect in case middleware/proxy is bypassed.
export default function Page() {
  redirect('/en')
}
