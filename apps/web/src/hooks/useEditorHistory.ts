import { useCallback, useRef, useState } from 'react'

/** Text field with undo/redo stacks (structural commits only; use `setLive` for free typing). */
export function useEditorHistory(initial: string) {
  const [text, setText] = useState(initial)
  const past = useRef<string[]>([])
  const future = useRef<string[]>([])
  const textRef = useRef(initial)
  textRef.current = text

  const reset = useCallback((v: string) => {
    past.current = []
    future.current = []
    textRef.current = v
    setText(v)
  }, [])

  const commit = useCallback((next: string) => {
    if (next === textRef.current) return
    past.current.push(textRef.current)
    future.current = []
    textRef.current = next
    setText(next)
  }, [])

  const setLive = useCallback((next: string) => {
    textRef.current = next
    setText(next)
  }, [])

  const undo = useCallback(() => {
    if (past.current.length === 0) return
    future.current.push(textRef.current)
    const prev = past.current.pop()!
    textRef.current = prev
    setText(prev)
  }, [])

  const redo = useCallback(() => {
    if (future.current.length === 0) return
    past.current.push(textRef.current)
    const n = future.current.pop()!
    textRef.current = n
    setText(n)
  }, [])

  const focusBaseline = useRef<string | null>(null)
  const beginTextareaSession = useCallback(() => {
    focusBaseline.current = textRef.current
  }, [])
  const endTextareaSession = useCallback(() => {
    const b = focusBaseline.current
    focusBaseline.current = null
    if (b == null || textRef.current === b) return
    past.current.push(b)
    future.current = []
  }, [])

  return { text, setLive, commit, undo, redo, reset, beginTextareaSession, endTextareaSession }
}
