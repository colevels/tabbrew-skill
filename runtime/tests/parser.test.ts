import { describe, expect, it } from 'vitest'
import { parseTabbrewScript } from '../src/parser'

describe('parseTabbrewScript — ids-only verbs', () => {
  it('parses DEL with one id', () => {
    const { ops, errors } = parseTabbrewScript('DEL 5')
    expect(errors).toEqual([])
    expect(ops).toEqual([{ verb: 'DEL', ids: [5] }])
  })

  it('parses DEL/PIN/UNPIN/UNGROUP with multiple ids and tolerates extra whitespace', () => {
    const script = ['DEL 1 2 3', '  PIN   4    5  ', 'UNPIN 6', 'UNGROUP 7 8'].join('\n')
    const { ops, errors } = parseTabbrewScript(script)
    expect(errors).toEqual([])
    expect(ops).toEqual([
      { verb: 'DEL', ids: [1, 2, 3] },
      { verb: 'PIN', ids: [4, 5] },
      { verb: 'UNPIN', ids: [6] },
      { verb: 'UNGROUP', ids: [7, 8] },
    ])
  })

  it('lowercases verbs are accepted (case-insensitive)', () => {
    const { ops, errors } = parseTabbrewScript('del 1 2')
    expect(errors).toEqual([])
    expect(ops).toEqual([{ verb: 'DEL', ids: [1, 2] }])
  })

  it('errors when an ids-only verb has no ids', () => {
    const { ops, errors } = parseTabbrewScript('DEL')
    expect(ops).toEqual([])
    expect(errors).toHaveLength(1)
    expect(errors[0].reason).toMatch(/needs at least one id/)
  })

  it('errors when an id is not an integer', () => {
    const { ops, errors } = parseTabbrewScript('PIN 1 abc 3')
    expect(ops).toEqual([])
    expect(errors[0].reason).toMatch(/invalid id "abc"/)
  })

  it('errors when an ids-only verb gets a quoted name', () => {
    const { ops, errors } = parseTabbrewScript('DEL 1 2 "Nope"')
    expect(ops).toEqual([])
    expect(errors[0].reason).toMatch(/does not take a quoted name/)
  })
})

describe('parseTabbrewScript — GROUP', () => {
  it('parses GROUP with quoted name', () => {
    const { ops, errors } = parseTabbrewScript('GROUP 1 2 3 "Work"')
    expect(errors).toEqual([])
    expect(ops).toEqual([{ verb: 'GROUP', ids: [1, 2, 3], name: 'Work' }])
  })

  it('parses GROUP with @gid', () => {
    const { ops, errors } = parseTabbrewScript('GROUP 1 2 @42')
    expect(errors).toEqual([])
    expect(ops).toEqual([{ verb: 'GROUP', ids: [1, 2], gid: 42 }])
  })

  it('errors when GROUP has only a name and no ids', () => {
    const { ops, errors } = parseTabbrewScript('GROUP "Work"')
    expect(ops).toEqual([])
    expect(errors[0].reason).toMatch(/at least one id before the name/)
  })

  it('errors when GROUP name is the empty string', () => {
    const { ops, errors } = parseTabbrewScript('GROUP 1 ""')
    expect(ops).toEqual([])
    expect(errors[0].reason).toMatch(/name cannot be empty/)
  })

  it('errors when GROUP is missing name and gid', () => {
    const { ops, errors } = parseTabbrewScript('GROUP 1 2 3')
    expect(ops).toEqual([])
    expect(errors[0].reason).toMatch(/quoted "name" or @<gid>/)
  })

  it('errors when @gid is not a positive integer', () => {
    const { ops, errors } = parseTabbrewScript('GROUP 1 @0')
    expect(ops).toEqual([])
    expect(errors[0].reason).toMatch(/invalid group id/)
  })

  it('errors when GROUP @gid has no preceding ids', () => {
    const { ops, errors } = parseTabbrewScript('GROUP @5')
    expect(ops).toEqual([])
    // "GROUP @5" parses as [verb, args=['@5']]; args.length=1 so the
    // "needs at least one id and a name/@gid" message wins.
    expect(errors[0].reason).toMatch(/at least one id/)
  })
})

describe('parseTabbrewScript — MOVE', () => {
  it('parses MOVE without window', () => {
    const { ops, errors } = parseTabbrewScript('MOVE 7 3')
    expect(errors).toEqual([])
    expect(ops).toEqual([{ verb: 'MOVE', id: 7, index: 3 }])
  })

  it('parses MOVE with @win=<wid>', () => {
    const { ops, errors } = parseTabbrewScript('MOVE 7 3 @win=20')
    expect(errors).toEqual([])
    expect(ops).toEqual([{ verb: 'MOVE', id: 7, index: 3, windowId: 20 }])
  })

  it('accepts a negative index (e.g. -1 for end-of-window)', () => {
    const { ops, errors } = parseTabbrewScript('MOVE 7 -1')
    expect(errors).toEqual([])
    expect(ops).toEqual([{ verb: 'MOVE', id: 7, index: -1 }])
  })

  it('errors when MOVE has too few or too many args', () => {
    const r1 = parseTabbrewScript('MOVE 7')
    expect(r1.errors[0].reason).toMatch(/expects: MOVE/)
    const r2 = parseTabbrewScript('MOVE 7 3 @win=20 extra')
    expect(r2.errors[0].reason).toMatch(/expects: MOVE/)
  })

  it('errors when MOVE third arg is not @win=<wid>', () => {
    const { errors } = parseTabbrewScript('MOVE 7 3 foo')
    expect(errors[0].reason).toMatch(/@win=<wid>/)
  })

  it('errors when MOVE gets a quoted name', () => {
    const { errors } = parseTabbrewScript('MOVE 7 3 "Nope"')
    expect(errors[0].reason).toMatch(/does not take a quoted name/)
  })
})

describe('parseTabbrewScript — script-level behavior', () => {
  it('ignores comments and blank lines', () => {
    const script = ['# this is a comment', '', '   # leading whitespace', 'DEL 1'].join('\n')
    const { ops, errors } = parseTabbrewScript(script)
    expect(errors).toEqual([])
    expect(ops).toEqual([{ verb: 'DEL', ids: [1] }])
  })

  it('reports line numbers in errors, starting at 1', () => {
    const script = ['DEL 1', 'BOGUS 2', 'PIN 3'].join('\n')
    const { ops, errors } = parseTabbrewScript(script)
    expect(ops).toEqual([
      { verb: 'DEL', ids: [1] },
      { verb: 'PIN', ids: [3] },
    ])
    expect(errors).toHaveLength(1)
    expect(errors[0].line).toBe(2)
    expect(errors[0].raw).toBe('BOGUS 2')
    expect(errors[0].reason).toMatch(/unknown verb/)
  })

  it('returns an empty result for an empty input', () => {
    expect(parseTabbrewScript('')).toEqual({ ops: [], errors: [] })
  })

  it('handles CRLF line endings', () => {
    const { ops, errors } = parseTabbrewScript('DEL 1\r\nPIN 2\r\n')
    expect(errors).toEqual([])
    expect(ops).toEqual([
      { verb: 'DEL', ids: [1] },
      { verb: 'PIN', ids: [2] },
    ])
  })
})
