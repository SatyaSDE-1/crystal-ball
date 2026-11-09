'use client'

import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react'
import { useStore, type StoreApi } from 'zustand'
import { assistantService, type AssistantService } from '@/services/assistant-service'
import { createAssistantStore, type AssistantStore } from '@/stores/assistant-store'
import type { Approval } from '@/types/approvals'

const AssistantStoreContext = createContext<StoreApi<AssistantStore> | null>(null)

/**
 * Creates the assistant's store once and shares it with everything below, so
 * nothing needs props passed down. `service` defaults to the real API client;
 * tests pass a fake.
 */
export function AssistantProvider({
  service = assistantService,
  approvals,
  children,
}: {
  service?: AssistantService
  approvals: Approval[]
  children: ReactNode
}) {
  const storeRef = useRef<StoreApi<AssistantStore> | null>(null)
  if (storeRef.current === null) {
    storeRef.current = createAssistantStore(service)
    storeRef.current.getState().setApprovals(approvals)
  }
  const store = storeRef.current

  // the server hands over fresh approvals after a refresh
  useEffect(() => {
    store.getState().setApprovals(approvals)
  }, [store, approvals])

  return <AssistantStoreContext.Provider value={store}>{children}</AssistantStoreContext.Provider>
}

export function useAssistant<T>(selector: (state: AssistantStore) => T): T {
  const store = useContext(AssistantStoreContext)
  if (store === null) throw new Error('useAssistant must be used inside <AssistantProvider>')
  return useStore(store, selector)
}
