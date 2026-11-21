import type { InlineStyle, SlideComponent, TextFormat } from '@/lib/types'

export const inlineKeys = [
  'fontSize',
  'fontWeight',
  'fontStyle',
  'textDecoration',
  'fontFamily',
  'color',
  'textCase'
] as const
export function segments(
  component: SlideComponent,
  start = 0,
  end = component.content.length
) {
  const result: TextFormat[] = []
  let cursor = start
  for (const run of Array.isArray(component.textFormats)
    ? component.textFormats
    : []) {
    if (
      !run?.style ||
      !Number.isInteger(run.start) ||
      !Number.isInteger(run.end)
    )
      continue
    const a = Math.max(cursor, run.start),
      b = Math.min(end, run.end)
    if (a >= b) continue
    if (cursor < a) result.push({ start: cursor, end: a, style: {} })
    result.push({ start: a, end: b, style: run.style })
    cursor = b
  }
  if (cursor < end) result.push({ start: cursor, end, style: {} })
  return result
}
function compact(runs: TextFormat[]) {
  const result: TextFormat[] = []
  for (const run of runs) {
    if (run.end <= run.start || !Object.keys(run.style).length) continue
    const last = result.at(-1)
    if (
      last &&
      last.end === run.start &&
      inlineKeys.every((key) => last.style[key] === run.style[key])
    )
      last.end = run.end
    else result.push({ ...run })
  }
  return result
}
export function applyFormat(
  component: SlideComponent,
  start: number,
  end: number,
  patch: InlineStyle
) {
  return compact([
    ...segments(component, 0, start),
    ...segments(component, start, end).map((run) => ({
      ...run,
      style: { ...run.style, ...patch }
    })),
    ...segments(component, end)
  ])
}
export function replaceText(
  component: SlideComponent,
  start: number,
  end: number,
  text: string
) {
  const content =
    component.content.slice(0, start) + text + component.content.slice(end)
  if (!component.textFormats?.length) return { content }
  const delta = text.length - (end - start)
  const offset = start === end && start > 0 ? start - 1 : start
  const style = segments(component, offset, offset + 1)[0]?.style ?? {}
  return {
    content,
    textFormats: compact([
      ...segments(component, 0, start),
      { start, end: start + text.length, style },
      ...segments(component, end).map((run) => ({
        ...run,
        start: run.start + delta,
        end: run.end + delta
      }))
    ])
  }
}
export function editedText(component: SlideComponent, content: string) {
  const previous = component.content
  let start = 0,
    end = previous.length,
    nextEnd = content.length
  while (start < end && start < nextEnd && previous[start] === content[start])
    start++
  while (
    end > start &&
    nextEnd > start &&
    previous[end - 1] === content[nextEnd - 1]
  ) {
    end--
    nextEnd--
  }
  return replaceText(component, start, end, content.slice(start, nextEnd))
}
