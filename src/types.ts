export type Op =
  | { verb: 'DEL'; ids: number[] }
  | { verb: 'PIN'; ids: number[] }
  | { verb: 'UNPIN'; ids: number[] }
  | { verb: 'UNGROUP'; ids: number[] }
  | { verb: 'GROUP'; ids: number[]; name: string }
  | { verb: 'GROUP'; ids: number[]; gid: number }
  | { verb: 'MOVE'; id: number; index: number; windowId?: number }

export type ParseError = { line: number; raw: string; reason: string }

export type ParseResult = { ops: Op[]; errors: ParseError[] }

export type PhaseResult = { phase: string; ok: boolean; detail: string; affectedIds: number[] }

export type ExecuteResult = { phases: PhaseResult[]; ok: boolean }
