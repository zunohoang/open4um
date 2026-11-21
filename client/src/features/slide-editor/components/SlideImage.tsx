import { useState } from 'react'
import type { SlideComponent } from '@/lib/types'
import { mediaUrl } from '@/lib/mediaUrl'
import { cropClipPath } from '../utils/slide'

export function SlideImage({
  component,
  frameRatio
}: {
  component: SlideComponent
  frameRatio?: number
}) {
  const src = mediaUrl(component.imageUrl || component.content)
  const [loaded, setLoaded] = useState<{ src: string; ratio: number }>()
  if (loaded?.src === src && loaded.ratio === 0) {
    return (
      <div
        role='img'
        aria-label='Không tải được ảnh'
        className='flex h-full min-h-6 w-full items-center justify-center bg-stone-200 text-center text-xs text-stone-600'
      >
        Không tải được ảnh
      </div>
    )
  }
  const ratio =
    frameRatio ??
    (component.height && component.width
      ? (16 * component.width) / (9 * component.height)
      : 0)
  const fitHeight = !!ratio && loaded?.src === src && loaded.ratio < ratio
  return (
    <div className='flex h-full w-full items-center justify-center overflow-hidden'>
      <img
        src={src}
        alt=''
        draggable={false}
        onLoad={(e) =>
          setLoaded({
            src,
            ratio: e.currentTarget.naturalWidth / e.currentTarget.naturalHeight
          })
        }
        onError={() => setLoaded({ src, ratio: 0 })}
        style={{
          display: 'block',
          width: fitHeight ? 'auto' : '100%',
          height: fitHeight ? '100%' : 'auto',
          clipPath: cropClipPath(component.crop)
        }}
      />
    </div>
  )
}
