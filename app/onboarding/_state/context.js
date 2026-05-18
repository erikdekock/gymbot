'use client'

import { createContext, useContext, useReducer } from 'react'
import { initialOnboardingState } from './initial-state'
import { deriveArchetype } from './archetype'

const OnboardingContext = createContext(null)

/**
 * Immutable set-by-dot-path helper. Supports one level of nesting
 * (sufficient for archetype_flags.* and reported_lifts.*).
 *
 * @param {object} state
 * @param {string} path  e.g. "days_per_week" or "archetype_flags.age"
 * @param {*} value
 */
function setByPath(state, path, value) {
  const parts = path.split('.')
  if (parts.length === 1) {
    return { ...state, [parts[0]]: value }
  }
  const [head, ...rest] = parts
  return {
    ...state,
    [head]: setByPath(state[head] ?? {}, rest.join('.'), value),
  }
}

function reducer(state, action) {
  switch (action.type) {
    case 'SET_FIELD': {
      const next = setByPath(state, action.path, action.value)
      // Re-derive archetype on every field change; cheap, keeps state coherent.
      return { ...next, detected_archetype: deriveArchetype(next) }
    }
    case 'SET_FIELDS': {
      let next = state
      for (const [path, value] of Object.entries(action.fields)) {
        next = setByPath(next, path, value)
      }
      return { ...next, detected_archetype: deriveArchetype(next) }
    }
    case 'RESET':
      return initialOnboardingState
    default:
      return state
  }
}

export function OnboardingProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialOnboardingState)
  // Expose state on window in dev for AC2 verification ("visible in dev tools
  // across navigation"). Tree-shaken in production; harmless if not.
  if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
    window.__onboarding = state
  }
  return (
    <OnboardingContext.Provider value={{ state, dispatch }}>
      {children}
    </OnboardingContext.Provider>
  )
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext)
  if (!ctx) {
    throw new Error('useOnboarding must be used within OnboardingProvider')
  }
  return ctx
}

/** Convenience setter: dispatch({ type: 'SET_FIELD', path, value }). */
export function setField(dispatch, path, value) {
  dispatch({ type: 'SET_FIELD', path, value })
}
