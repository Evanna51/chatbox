import { useAtomValue } from 'jotai'
import { useMemo } from 'react'
import { Session } from '../../shared/types'
import { getSession } from '../stores/sessionStorageMutations'
import * as atoms from '../stores/atoms'

/**
 * 获取所有完整的会话数据（包含消息）
 */
export function useAllSessions(): Session[] {
  const sessionsList = useAtomValue(atoms.sessionsListAtom)
  
  const allSessions = useMemo(() => {
    const sessions: Session[] = []
    
    for (const sessionMeta of sessionsList) {
      const session = getSession(sessionMeta.id)
      if (session) {
        sessions.push(session)
      }
    }
    
    return sessions
  }, [sessionsList])
  
  return allSessions
}