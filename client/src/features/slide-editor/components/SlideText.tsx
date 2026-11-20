import type { SlideComponent } from '@/lib/types'

export const SlideText = ({
  component,
  fontUnit = 'cqw'
}: {
  component: SlideComponent
  fontUnit?: 'cqw' | 'px'
}) => {
  const content = component.content.normalize('NFC')
  if (component.type === 'bullets') {
    return (
      <ul
        className='list-disc'
        style={{ paddingLeft: fontUnit === 'px' ? '20px' : '2.083333cqw' }}
      >
        {content
          .split('\n')
          .filter((text) => text.trim())
          .map((text, index) => (
            <li
              key={index}
              className='break-words'
              style={{ marginBottom: fontUnit === 'px' ? '6px' : '0.625cqw' }}
            >
              {text}
            </li>
          ))}
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
        &ldquo; {content} &rdquo;
      </div>
    )
  }
  return <div className='whitespace-pre-wrap break-words'>{content}</div>
}
