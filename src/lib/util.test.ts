import { describe, expect, it } from 'vitest'
import { moveItem, slugFilename } from './util'

describe('slugFilename', () => {
  it('slugs a title and adds .pdf', () => {
    expect(slugFilename('My Report 2026!')).toBe('my-report-2026.pdf')
  })
  it('keeps existing .pdf', () => {
    expect(slugFilename('final.pdf')).toBe('final.pdf')
  })
  it('collapses whitespace and dashes', () => {
    expect(slugFilename('  a   b---c  ')).toBe('a-b-c.pdf')
  })
  it('falls back when empty', () => {
    expect(slugFilename('!!!')).toBe('document.pdf')
    expect(slugFilename('', 'merged')).toBe('merged.pdf')
  })
})

describe('moveItem', () => {
  it('moves forward', () => {
    expect(moveItem([1, 2, 3, 4], 0, 2)).toEqual([2, 3, 1, 4])
  })
  it('moves backward', () => {
    expect(moveItem([1, 2, 3, 4], 3, 1)).toEqual([1, 4, 2, 3])
  })
  it('no-op when same', () => {
    expect(moveItem([1, 2, 3], 1, 1)).toEqual([1, 2, 3])
  })
  it('clamps dest', () => {
    expect(moveItem([1, 2, 3], 0, 99)).toEqual([2, 3, 1])
  })
})
