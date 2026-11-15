// How a change to one record travels between a browser and the server (lib/sync.ts, server/data.ts): as the places in it
// that changed, not the record whole. Two people changing different parts of one record both keep their change: one
// marks a chat read while the other renames it. A map (a chat's `read`, a message's `reactions`) is followed key by key;
// a list or a plain value is replaced whole, the later change winning.

/** One place: its path of keys and its new value; no value takes the place out */
export type Op = [path: string[], value?: unknown]

const map = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b)

/** What turns `a` into `b`. A record that is new (`a` undefined) is one change with an empty path. */
export function diff(a: unknown, b: unknown, path: string[] = [], out: Op[] = []): Op[] {
  if (a === b) return out
  if (map(a) && map(b)) {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (b[k] !== undefined) diff(a[k], b[k], [...path, k], out)
      else if (a[k] !== undefined) out.push([[...path, k]])
    }
  } else if (!same(a, b)) out.push([path, b])
  return out
}

/** Keys that would reach an object's own workings instead of its data */
const UNSAFE = ['__proto__', 'constructor', 'prototype']
export const safe = (ops: Op[]) => ops.every(([path]) => Array.isArray(path) && path.every(k => typeof k === 'string' && !UNSAFE.includes(k)))

function put(v: unknown, path: string[], i: number, val: unknown[]): unknown {
  if (i === path.length) return val[0]
  const o: Record<string, unknown> = map(v) ? { ...v } : {}
  const next = put(o[path[i]], path, i + 1, val)
  if (next === undefined) delete o[path[i]]
  else o[path[i]] = next
  return o
}

/** `v` with the changes made. `v` itself stays as it was, and so does every part of it that did not change. */
export function apply<T>(v: T | undefined, ops: Op[]): T | undefined {
  let out: unknown = v
  for (const [path, ...val] of ops) out = put(out, path, 0, val)
  return out as T | undefined
}
