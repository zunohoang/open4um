import { segments } from '../utils/textFormat'
import { FONT_MAP } from '../constants/theme-options'
import { slideLength } from '../utils/slide'
import type { SlideComponent } from '@/lib/types'

export const SlideText = ({
  component,
  selection,
  fontUnit = 'cqw'
}: {
  component: SlideComponent
  selection?: { start: number; end: number } | null
  fontUnit?: 'cqw' | 'px'
}) => {
  const content = component.content
  const render = (start = 0, end = content.length) => {
    const cuts = selection
      ? [
          start,
          ...[selection.start, selection.end].filter(
            (point) => point > start && point < end
          ),
          end
        ]
      : [start, end]
    return cuts
      .slice(1)
      .flatMap((stop, i) => segments(component, cuts[i], stop))
      .map((run) => {
        const { fontFamily, fontSize, textCase, ...style } = run.style
        return (
          <span
            key={run.start}
            style={{
              ...style,
              backgroundColor:
                selection &&
                run.start >= selection.start &&
                run.end <= selection.end
                  ? 'rgba(130, 179, 255, 0.4)'
                  : undefined,
              textDecoration: style.textDecoration ?? component.textDecoration,
              fontFamily: fontFamily
                ? FONT_MAP[fontFamily] || fontFamily
                : undefined,
              fontSize: fontSize
                ? fontUnit === 'px'
                  ? fontSize
                  : slideLength(fontSize)
                : undefined,
              textTransform: textCase
                ? textCase === 'uppercase'
                  ? 'uppercase'
                  : 'none'
                : undefined
            }}
          >
            {content.slice(run.start, run.end).normalize('NFC')}
          </span>
        )
      })
  }
  let lineStart = 0
  if (component.type === 'bullets') {
    return (
      <ul
        className='list-disc'
        style={{ paddingLeft: fontUnit === 'px' ? '20px' : '2.083333cqw' }}
      >
        {content.split('\n').map((text, index) => {
          const start = lineStart
          lineStart += text.length + 1
          return text.trim() ? (
            <li
              key={index}
              className='break-words'
              style={{ marginBottom: fontUnit === 'px' ? '6px' : '0.625cqw' }}
            >
              {render(start, start + text.length)}
            </li>
          ) : null
        })}
      </ul>
    )
  }
  if (component.type === 'quote') {
    return (
      <div
        className='italic border-y border-stone-300 break-words'
        style={{
          padding: fontUnit === 'px' ? '12px 8px' : '1.25cqw 0.833333cqw'
        }}
      >
        &ldquo; {render()} &rdquo;
      </div>
    )
  }
  return <div className='whitespace-pre-wrap break-words'>{render()}</div>
}
