import { describe, it, expect } from 'vitest'
import FEATURE_FLAGS, { isFeatureEnabled } from './featureFlags'

describe('FEATURE_FLAGS MVP', () => {
  it('disables automatic rates and smart pricing UI', () => {
    expect(FEATURE_FLAGS.AUTO_RATES).toBe(false)
    expect(FEATURE_FLAGS.DYNAMIC_PRICING_UI).toBe(false)
    expect(FEATURE_FLAGS.SMART_PRICING_UI).toBe(false)
    expect(FEATURE_FLAGS.SEASON_BLOCK_AVAILABILITY).toBe(false)
  })

  it('enables manual rates for production MVP', () => {
    expect(FEATURE_FLAGS.MANUAL_RATES).toBe(true)
    expect(isFeatureEnabled('MANUAL_RATES')).toBe(true)
  })
})
