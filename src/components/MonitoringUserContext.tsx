'use client'

import { useEffect } from 'react'
import { setMonitoringUser } from '@/lib/monitoring-client'

type MonitoringUserContextProps = {
  userId?: string | null
  email?: string | null
}

export function MonitoringUserContext({ userId, email }: MonitoringUserContextProps) {
  useEffect(() => {
    if (!userId) {
      void setMonitoringUser(null)
      return
    }

    void setMonitoringUser({
      id: userId,
      email: email ?? undefined,
    })
  }, [email, userId])

  return null
}
