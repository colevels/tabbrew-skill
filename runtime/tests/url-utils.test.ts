import { describe, expect, it } from 'vitest'
import { compactUrl, stripCountPrefix } from '../src/snapshot'

describe('compactUrl', () => {
  it('returns an empty string for empty input', () => {
    expect(compactUrl('')).toBe('')
  })

  it('strips https:// and leading www.', () => {
    expect(compactUrl('https://www.example.com/path')).toBe('example.com/path')
  })

  it('strips http:// (no www) and preserves the rest', () => {
    expect(compactUrl('http://example.com/x?y=1')).toBe('example.com/x?y=1')
  })

  it('leaves non-http URLs untouched', () => {
    expect(compactUrl('chrome://newtab')).toBe('chrome://newtab')
  })

  it('truncates URLs longer than 80 chars with an ellipsis (total length === 80)', () => {
    const long = 'https://example.com/' + 'a'.repeat(200)
    const out = compactUrl(long)
    expect(out.length).toBe(80)
    expect(out.endsWith('…')).toBe(true)
  })

  it('does not truncate URLs at or under the 80-char cap', () => {
    const at80 = 'a'.repeat(80)
    expect(compactUrl(at80)).toBe(at80)
  })
})

describe('stripCountPrefix', () => {
  it('strips a "(N) " unread badge', () => {
    expect(stripCountPrefix('(12) Inbox')).toBe('Inbox')
  })

  it('strips a "(N+) " badge (e.g. 99+)', () => {
    expect(stripCountPrefix('(99+) Inbox')).toBe('Inbox')
  })

  it('leaves titles without a leading numeric badge alone', () => {
    expect(stripCountPrefix('(foo) Bar')).toBe('(foo) Bar')
    expect(stripCountPrefix('Hello (12) world')).toBe('Hello (12) world')
  })

  it('returns the input verbatim when there is no prefix', () => {
    expect(stripCountPrefix('Plain title')).toBe('Plain title')
  })
})
