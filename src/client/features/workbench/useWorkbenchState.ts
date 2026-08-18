import { useCallback, useEffect, useRef, useState } from 'react'
import type { ConfigurationStatus } from '../../../configuration-contract.ts'
import type { SkillSourceStatus } from '../../../skill-source-contract.ts'
import { fetchConfigurationStatus } from '../../configuration-status.ts'
import { fetchSkillSourceStatus, synchronizeSkillSource } from '../../skill-source-status.ts'

export type WorkbenchSection = 'install' | 'checking' | 'config' | 'create' | 'materials'

type Load<T> =
  | { readonly phase: 'loading' }
  | { readonly phase: 'loaded'; readonly status: T }
  | { readonly phase: 'error'; readonly message: string }

export interface WorkbenchState {
  readonly section: WorkbenchSection
  readonly skillSource: Load<SkillSourceStatus>
  readonly configuration: Load<ConfigurationStatus>
  readonly skillMutation: 'installing' | 'updating' | null
  readonly skillMutationError: string
  readonly skillsInstalled: boolean
  readonly skillSourcePresent: boolean
  readonly configured: boolean
  readonly setSection: (section: WorkbenchSection) => void
  readonly refreshSkillSource: () => Promise<void>
  readonly refreshConfiguration: () => Promise<void>
  readonly synchronizeSkills: (operation: 'installing' | 'updating') => Promise<void>
}

export function useWorkbenchState(sessionId: string, inputBusy: boolean): WorkbenchState {
  const [section, setSection] = useState<WorkbenchSection>('install')
  const [skillSource, setSkillSource] = useState<Load<SkillSourceStatus>>({ phase: 'loading' })
  const [skillMutation, setSkillMutation] = useState<'installing' | 'updating' | null>(null)
  const [skillMutationError, setSkillMutationError] = useState('')
  const [configuration, setConfiguration] = useState<Load<ConfigurationStatus>>({ phase: 'loading' })
  const configurationRequest = useRef(0)
  const skillSourceRequest = useRef(0)
  const configurationResolved = useRef(false)
  const skillSourceResolved = useRef(false)
  const previousBusy = useRef(false)

  const skillsInstalled = skillSource.phase === 'loaded' && skillSource.status.ready
  const skillSourcePresent = skillSource.phase === 'loaded'
    && (skillSource.status.state === 'ready' || skillSource.status.state === 'invalid' || skillSource.status.state === 'updating')
  const configured = skillsInstalled && configuration.phase === 'loaded' && configuration.status.ready

  const refreshSkillSource = useCallback(async (): Promise<void> => {
    const request = skillSourceRequest.current + 1
    skillSourceRequest.current = request
    setSkillSource({ phase: 'loading' })
    try {
      const status = await fetchSkillSourceStatus()
      if (skillSourceRequest.current === request) setSkillSource({ phase: 'loaded', status })
    } catch (error) {
      if (skillSourceRequest.current !== request) return
      setSkillSource({ phase: 'error', message: error instanceof Error ? error.message : String(error) })
    }
  }, [])

  const refreshConfiguration = useCallback(async (): Promise<void> => {
    const request = configurationRequest.current + 1
    configurationRequest.current = request
    setConfiguration({ phase: 'loading' })
    try {
      const status = await fetchConfigurationStatus(sessionId)
      if (configurationRequest.current === request) setConfiguration({ phase: 'loaded', status })
    } catch (error) {
      if (configurationRequest.current !== request) return
      setConfiguration({ phase: 'error', message: error instanceof Error ? error.message : String(error) })
    }
  }, [sessionId])

  useEffect(() => {
    void refreshSkillSource()
    return () => { skillSourceRequest.current += 1 }
  }, [refreshSkillSource])

  useEffect(() => {
    if (skillSource.phase === 'loading') return
    if (skillSource.phase === 'error') {
      setSection('install')
      skillSourceResolved.current = false
      configurationResolved.current = false
      return
    }
    if (!skillSource.status.ready) {
      setSection('install')
      skillSourceResolved.current = false
      configurationResolved.current = false
      return
    }
    if (!skillSourceResolved.current) {
      setSection('checking')
      configurationResolved.current = false
    }
    skillSourceResolved.current = true
  }, [skillSource])

  useEffect(() => {
    if (!skillsInstalled) {
      configurationRequest.current += 1
      setConfiguration({ phase: 'loading' })
      return
    }
    void refreshConfiguration()
    return () => { configurationRequest.current += 1 }
  }, [refreshConfiguration, skillsInstalled])

  useEffect(() => {
    if (skillsInstalled && configuration.phase === 'error') {
      setSection('config')
      configurationResolved.current = false
      return
    }
    if (!skillsInstalled || configuration.phase !== 'loaded') return
    if (!configuration.status.ready) {
      setSection('config')
      configurationResolved.current = false
      return
    }
    if (!configurationResolved.current) setSection('create')
    configurationResolved.current = true
  }, [configuration, skillsInstalled])

  useEffect(() => {
    if (previousBusy.current && !inputBusy && section === 'config') void refreshConfiguration()
    previousBusy.current = inputBusy
  }, [inputBusy, refreshConfiguration, section])

  const synchronizeSkills = async (operation: 'installing' | 'updating'): Promise<void> => {
    setSkillMutation(operation)
    setSkillMutationError('')
    try {
      const status = await synchronizeSkillSource()
      if (operation === 'installing') skillSourceResolved.current = false
      setSkillSource({ phase: 'loaded', status })
    } catch (error) {
      setSkillMutationError(error instanceof Error ? error.message : String(error))
    } finally {
      setSkillMutation(null)
    }
  }

  return {
    section,
    skillSource,
    configuration,
    skillMutation,
    skillMutationError,
    skillsInstalled,
    skillSourcePresent,
    configured,
    setSection,
    refreshSkillSource,
    refreshConfiguration,
    synchronizeSkills,
  }
}
