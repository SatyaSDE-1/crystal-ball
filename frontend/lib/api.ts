/**
 * Server-side data loading. Only import this from server components: the API
 * address comes from a server-only env var (no NEXT_PUBLIC_ prefix), so it is
 * never sent to the browser.
 */
import { approvalFixtures } from '@/fixtures/approvals'
import { parseApiApprovals, toApprovals } from '@/lib/approvals'
import type { ApprovalsResult } from '@/types/approvals'

const API_URL = process.env.API_URL ?? 'http://localhost:4000/api'
const REQUEST_TIMEOUT_MS = 5000

type LoadOptions = {
  /**
   * Omit for server-side rendering on every request (getServerSideProps).
   * Pass seconds to serve a cached copy and refresh it in the background
   * (getStaticProps with revalidate, i.e. ISR).
   */
  revalidate?: number
}

/**
 * Loads the approvals from the API. Never throws: if the API is down, slow or
 * answers something unexpected, the page still renders, with sample data and
 * `unavailable: true` so it can say so.
 */
export async function getApprovals({ revalidate }: LoadOptions = {}): Promise<ApprovalsResult> {
  try {
    const response = await fetch(`${API_URL}/approvals`, {
      ...(revalidate === undefined ? { cache: 'no-store' as const } : { next: { revalidate } }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    if (!response.ok) throw new Error(`The API answered ${response.status}`)

    const approvals = toApprovals(parseApiApprovals(await response.json()))
    return { approvals, unavailable: false }
  } catch (error) {
    console.warn('[approvals] using sample data:', error instanceof Error ? error.message : error)
    return { approvals: approvalFixtures, unavailable: true }
  }
}
