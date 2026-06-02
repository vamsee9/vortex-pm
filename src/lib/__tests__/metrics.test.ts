import { describe, it, expect } from 'vitest'
import {
  computeWeekNumbers,
  computeBusinessDays,
  isPlannedInSprint,
  isAddedMidSprint,
  isCarryForward,
  detectReopened
} from '../metrics'

describe('metrics utility functions', () => {

  describe('computeWeekNumbers', () => {
    it('returns empty array if any input is missing', () => {
      expect(computeWeekNumbers(null, '2024-01-14', '2024-01-05')).toEqual([])
      expect(computeWeekNumbers('2024-01-01', null, '2024-01-05')).toEqual([])
      expect(computeWeekNumbers('2024-01-01', '2024-01-14', null)).toEqual([])
    })

    it('returns empty array if date is outside sprint window', () => {
      expect(computeWeekNumbers('2024-01-01', '2024-01-14', '2023-12-31')).toEqual([])
      expect(computeWeekNumbers('2024-01-01', '2024-01-14', '2024-01-15')).toEqual([])
    })

    it('calculates correct week number', () => {
      expect(computeWeekNumbers('2024-01-01', '2024-01-14', '2024-01-01')).toEqual([1])
      expect(computeWeekNumbers('2024-01-01', '2024-01-14', '2024-01-07')).toEqual([1]) // 6 days since start (1-7)
      expect(computeWeekNumbers('2024-01-01', '2024-01-14', '2024-01-08')).toEqual([2]) // 7 days since start (8-14)
    })
  })

  describe('computeBusinessDays', () => {
    it('returns null if dates are missing', () => {
      expect(computeBusinessDays(null, '2024-01-10')).toBeNull()
      expect(computeBusinessDays('2024-01-01', null)).toBeNull()
    })

    it('returns 0 if end is before start', () => {
      expect(computeBusinessDays('2024-01-10', '2024-01-01')).toBe(0)
    })

    it('counts business days correctly (skipping weekends)', () => {
      // Jan 1, 2024 is Monday. Jan 5 is Friday (5 days)
      expect(computeBusinessDays('2024-01-01', '2024-01-05')).toBe(5)
      // Jan 1 to Jan 8 (Mon to Mon) = 6 business days
      expect(computeBusinessDays('2024-01-01', '2024-01-08')).toBe(6)
      // Weekend only (Sat Jan 6 to Sun Jan 7) = 0
      expect(computeBusinessDays('2024-01-06', '2024-01-07')).toBe(0)
    })
  })

  describe('isPlannedInSprint', () => {
    it('returns true if bound before or on start date', () => {
      expect(isPlannedInSprint('2024-01-01T10:00:00Z', '2024-01-01T12:00:00Z')).toBe(true)
      expect(isPlannedInSprint('2023-12-31T10:00:00Z', '2024-01-01T12:00:00Z')).toBe(true)
    })

    it('returns false if bound after start date', () => {
      expect(isPlannedInSprint('2024-01-02T10:00:00Z', '2024-01-01T12:00:00Z')).toBe(false)
    })

    it('returns false if missing data', () => {
      expect(isPlannedInSprint(null, '2024-01-01T12:00:00Z')).toBe(false)
    })
  })

  describe('isAddedMidSprint', () => {
    it('returns true if bound after start date', () => {
      expect(isAddedMidSprint('2024-01-02T10:00:00Z', '2024-01-01T12:00:00Z')).toBe(true)
    })

    it('returns false if bound before or on start date', () => {
      expect(isAddedMidSprint('2024-01-01T10:00:00Z', '2024-01-01T12:00:00Z')).toBe(false)
    })
  })

  describe('isCarryForward', () => {
    it('returns false if sprint is not closed', () => {
      expect(isCarryForward('active', 'To Do')).toBe(false)
    })

    it('returns true if sprint closed and not finalized', () => {
      expect(isCarryForward('closed', 'To Do')).toBe(true)
      expect(isCarryForward('closed', 'In Progress')).toBe(true)
    })

    it('returns false if sprint closed and finalized', () => {
      expect(isCarryForward('closed', 'Done')).toBe(false)
      expect(isCarryForward('closed', 'Resolved')).toBe(false)
    })
  })

  describe('detectReopened', () => {
    it('returns false for empty changelog', () => {
      expect(detectReopened([])).toBe(false)
    })

    it('returns false if transition does not involve status', () => {
      expect(detectReopened([{ field: 'assignee', fromString: 'Done', toString: 'To Do' }])).toBe(false)
    })

    it('returns true if transitioning from Done to To Do', () => {
      expect(detectReopened([{ field: 'status', fromString: 'Done', toString: 'To Do' }])).toBe(true)
      expect(detectReopened([{ field: 'status', fromString: 'Resolved', toString: 'In Progress' }])).toBe(true)
    })

    it('returns false if transitioning to another Done state', () => {
      expect(detectReopened([{ field: 'status', fromString: 'Done', toString: 'Closed' }])).toBe(false)
    })

    it('returns false if transitioning from active state', () => {
      expect(detectReopened([{ field: 'status', fromString: 'To Do', toString: 'In Progress' }])).toBe(false)
    })
  })
})
