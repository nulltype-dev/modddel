import { describe, expect, it } from 'vitest'
import { areEventsContinous, EventSorter } from '../src/utils.js'

describe('utils', () => {
  describe('event utils', () => {
    it('sorts events by version ascending', () => {
      const events = [
        {
          version: 5,
        },
        {
          version: 1,
        },
        {
          version: 4,
        },
      ]

      expect(
        events.sort(EventSorter.byVersion).map((e) => e.version),
      ).toStrictEqual([1, 4, 5])
    })

    it('areContinous returns true on empty array', () => {
      expect(areEventsContinous([])).toBe(true)
    })

    it('areContinous returns true with one element', () => {
      expect(
        areEventsContinous([
          {
            version: 7,
          },
        ]),
      ).toBe(true)
    })

    it('areContinous returns false when versions are not sorted', () => {
      expect(
        areEventsContinous([
          {
            version: 5,
          },
          {
            version: 1,
          },
          {
            version: 4,
          },
        ]),
      ).toBe(false)
    })

    it('areContinous returns false when versions are not sorted', () => {
      expect(
        areEventsContinous([
          {
            version: 4,
          },
          {
            version: 5,
          },
          {
            version: 6,
          },
        ]),
      ).toBe(true)
    })
  })
})
