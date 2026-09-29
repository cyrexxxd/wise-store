import { describe, expect, it } from 'vitest'
import data from '~/data/cosmetics.json'
import { nameGradient } from './cosmetics'

describe('nameGradient', () => {
  it('turns a single colour into a gradient (background-image rejects a bare colour)', () => {
    expect(nameGradient(['#FF4040'])).toBe('linear-gradient(90deg, #FF4040, #FF4040)')
  })

  it('keeps multi-colour gradients as they are', () => {
    expect(nameGradient(['#39FF14', '#0FA958'])).toBe('linear-gradient(90deg, #39FF14, #0FA958)')
  })

  it('falls back to white when there are no colours', () => {
    expect(nameGradient(undefined)).toBe('linear-gradient(90deg, #FFFFFF, #FFFFFF)')
    expect(nameGradient([])).toBe('linear-gradient(90deg, #FFFFFF, #FFFFFF)')
  })

  it('gives every name colour in the catalogue a gradient', () => {
    const colours = (data.sections as { namecolor: Array<{ colors?: string[] }> }).namecolor
    expect(colours.some((c) => c.colors?.length === 1)).toBe(true)
    for (const c of colours) expect(nameGradient(c.colors)).toMatch(/^linear-gradient\(90deg, #[0-9A-F]{6}, #[0-9A-F]{6}/i)
  })
})
