import { describe, expect, it } from 'vitest'
import { parsePageRanges } from './pdf'

describe('parsePageRanges', () => {
  it('single pages', () => {
    expect(parsePageRanges('1,3,5', 10)).toEqual([0, 2, 4])
  })
  it('ranges', () => {
    expect(parsePageRanges('1-3', 10)).toEqual([0, 1, 2])
  })
  it('open-ended range to end', () => {
    expect(parsePageRanges('8-', 10)).toEqual([7, 8, 9])
  })
  it('open-ended range from start', () => {
    expect(parsePageRanges('-3', 10)).toEqual([0, 1, 2])
  })
  it('mixed with dedup + order preserved', () => {
    expect(parsePageRanges('5,1-2,5', 10)).toEqual([4, 0, 1])
  })
  it('clamps out-of-range', () => {
    expect(parsePageRanges('1,99', 3)).toEqual([0])
  })
  it('reversed range normalizes low..high', () => {
    expect(parsePageRanges('3-1', 10)).toEqual([0, 1, 2])
  })
  it('bounds huge and reversed ranges to the document before iterating', () => {
    expect(parsePageRanges('1-9007199254740993', 3)).toEqual([0, 1, 2])
    expect(parsePageRanges('9007199254740993-1', 3)).toEqual([0, 1, 2])
    expect(parsePageRanges('9007199254740992-9007199254740993', 3)).toEqual([])
    expect(parsePageRanges('0-2', 3)).toEqual([0, 1])
    expect(parsePageRanges('99-100', 3)).toEqual([])
  })
  it('rejects invalid document page counts', () => {
    for (const count of [NaN, Infinity, -1, 0, 2.5, Number.MAX_SAFE_INTEGER + 1]) {
      expect(parsePageRanges('1-3', count)).toEqual([])
    }
  })
  it('empty / junk → empty', () => {
    expect(parsePageRanges('', 10)).toEqual([])
    expect(parsePageRanges(' , ,', 10)).toEqual([])
  })
})
