import type { CSSProperties } from 'react'
import {
  FONT_MAP,
  getThemeById
} from '@/features/slide-editor/constants/theme-options'
import {
  cropClipPath,
  getSlideComponents
} from '@/features/slide-editor/utils/slide'
import type { Slide, SlideComponent } from '@/lib/types'
import { SlideText } from '@/features/slide-editor/components/SlideText'

interface SlideViewProps {
  slide?: Slide
  lectureTheme?: string
  style?: CSSProperties
}

// Bộ dựng slide chỉ đọc (không có UI chỉnh sửa), dùng chung cho trình chiếu và xuất file
export const SlideView = ({ slide, lectureTheme, style }: SlideViewProps) => {
  const theme = getThemeById(slide?.theme || lectureTheme)
  const components =
    Array.isArray(slide?.components) && slide.components.length > 0
      ? slide.components
      : slide
        ? getSlideComponents(slide, theme.id)
        : []

  const renderShape = (comp: SlideComponent) => {
    const shapeType = comp.shapeType || 'rectangle'
    const fill =
      comp.fillColor === 'transparent'
        ? 'transparent'
        : comp.fillColor || theme.cardBackground
    const stroke = comp.borderColor || theme.cardBorder
    const strokeW = comp.borderWidth ?? 0
    const radius = comp.borderRadius ?? 0

    switch (shapeType) {
      case 'circle':
        return (
          <div
            className='h-full w-full'
            style={{
              backgroundColor: fill,
              border: strokeW > 0 ? `${strokeW}px solid ${stroke}` : 'none',
              borderRadius: '9999px'
            }}
          />
        )
      case 'triangle':
        return (
          <svg
            viewBox='0 0 100 100'
            preserveAspectRatio='none'
            className='h-full w-full'
          >
            <polygon
              points='50,5 98,95 2,95'
              fill={fill}
              stroke={strokeW > 0 ? stroke : 'none'}
              strokeWidth={strokeW}
            />
          </svg>
        )
      case 'star':
        return (
          <svg
            viewBox='0 0 100 100'
            preserveAspectRatio='none'
            className='h-full w-full'
          >
            <polygon
              points='50,5 63,38 98,40 70,62 80,96 50,75 20,96 30,62 2,40 37,38'
              fill={fill}
              stroke={strokeW > 0 ? stroke : 'none'}
              strokeWidth={strokeW}
            />
          </svg>
        )
      case 'line':
        return (
          <div
            className='w-full'
            style={{
              height: `${Math.max(2, strokeW || 2)}px`,
              backgroundColor: stroke || fill
            }}
          />
        )
      case 'rounded-rect':
        return (
          <div
            className='h-full w-full'
            style={{
              backgroundColor: fill,
              border: strokeW > 0 ? `${strokeW}px solid ${stroke}` : 'none',
              borderRadius: `${radius || 16}px`
            }}
          />
        )
      case 'rectangle':
      case 'square':
      default:
        return (
          <div
            className='h-full w-full'
            style={{
              backgroundColor: fill,
              border: strokeW > 0 ? `${strokeW}px solid ${stroke}` : 'none',
              borderRadius: `${radius}px`
            }}
          />
        )
    }
  }

  return (
    <div
      className='relative overflow-hidden shadow-2xl'
      style={{
        aspectRatio: '16 / 9',
        ...style,
        backgroundColor: slide?.backgroundColor || theme.background,
        color: theme.textPrimary
      }}
    >
      {components.length > 0 ? (
        <div
          className='absolute inset-0'
          style={{ containerType: 'inline-size' }}
        >
          {components.map((comp) => (
            <div
              key={comp.id}
              style={{
                position: 'absolute',
                left: `${comp.x}%`,
                top: `${comp.y}%`,
                width: comp.width ? `${comp.width}%` : 'auto',
                height:
                  comp.type === 'shape' &&
                  comp.shapeType !== 'line' &&
                  comp.height
                    ? `${comp.height}%`
                    : comp.type === 'image' && comp.height
                      ? `${comp.height}%`
                      : 'auto',
                minHeight:
                  comp.type !== 'shape' && comp.type !== 'image' && comp.height
                    ? `${comp.height}%`
                    : undefined,
                maxWidth: '100%',
                transform: comp.rotation
                  ? `rotate(${comp.rotation}deg)`
                  : undefined,
                fontSize: `clamp(8px, ${((comp.fontSize ?? 20) / 9.6).toFixed(3)}cqw, ${(comp.fontSize ?? 20) * 1.6}px)`,
                fontWeight: comp.fontWeight ?? 'normal',
                fontStyle: comp.fontStyle ?? 'normal',
                textDecoration: comp.textDecoration ?? 'none',
                textAlign: comp.textAlign ?? 'left',
                color: comp.color || theme.textPrimary,
                lineHeight: 1.3,
                wordBreak: 'break-word',
                overflowWrap: 'anywhere',
                fontFamily:
                  FONT_MAP[comp.fontFamily || 'sans'] ||
                  comp.fontFamily ||
                  'inherit',
                textTransform:
                  comp.textCase === 'uppercase' ? 'uppercase' : 'none'
              }}
            >
              {comp.type === 'shape' ? (
                renderShape(comp)
              ) : comp.type === 'image' ? (
                <img
                  src={comp.imageUrl || comp.content}
                  alt='Slide visual'
                  style={{ clipPath: cropClipPath(comp.crop) }}
                  className={
                    comp.height
                      ? 'h-full w-full object-contain'
                      : 'h-auto w-full object-contain'
                  }
                />
              ) : (
                <SlideText component={comp} />
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className='my-auto w-full'>
          <div
            className={`w-full ${
              slide?.titleAlign === 'center'
                ? 'text-center'
                : slide?.titleAlign === 'right'
                  ? 'text-right'
                  : 'text-left'
            }`}
          >
            <h1
              className={`font-medium leading-tight font-display ${
                slide?.titleSize === 'xl'
                  ? 'text-5xl sm:text-7xl'
                  : slide?.titleSize === 'sm'
                    ? 'text-3xl sm:text-5xl'
                    : 'text-4xl sm:text-6xl'
              }`}
            >
              {slide?.title}
            </h1>
            {slide?.subtitle && (
              <p className='mt-3 font-sans text-xl sm:text-2xl opacity-75'>
                {slide.subtitle}
              </p>
            )}
          </div>

          {slide?.layout === 'two-column' ? (
            <div className='mt-8 grid grid-cols-2 gap-8'>
              <div className='space-y-3 border-r border-stone-300/30 pr-4'>
                {(slide?.bullets ?? [])
                  .slice(0, Math.ceil((slide?.bullets ?? []).length / 2))
                  .map((bullet, idx) => (
                    <div
                      key={idx}
                      className='flex items-start gap-3 font-sans text-base sm:text-xl'
                    >
                      <span
                        className='font-bold'
                        style={{ color: theme.accentColor }}
                      >
                        {slide?.bulletStyle === 'decimal'
                          ? `${idx + 1}.`
                          : slide?.bulletStyle === 'dash'
                            ? '—'
                            : '•'}
                      </span>
                      <span>{bullet}</span>
                    </div>
                  ))}
              </div>
              <div className='space-y-3 pl-2'>
                {(slide?.bullets ?? [])
                  .slice(Math.ceil((slide?.bullets ?? []).length / 2))
                  .map((bullet, idx) => (
                    <div
                      key={idx}
                      className='flex items-start gap-3 font-sans text-base sm:text-xl'
                    >
                      <span
                        className='font-bold'
                        style={{ color: theme.accentColor }}
                      >
                        {slide?.bulletStyle === 'decimal'
                          ? `${Math.ceil((slide?.bullets ?? []).length / 2) + idx + 1}.`
                          : slide?.bulletStyle === 'dash'
                            ? '—'
                            : '•'}
                      </span>
                      <span>{bullet}</span>
                    </div>
                  ))}
              </div>
            </div>
          ) : slide?.layout === 'headline' ? (
            <div className='mt-8 font-sans text-lg leading-relaxed opacity-80 sm:text-2xl'>
              {(slide?.bullets ?? []).join(' • ')}
            </div>
          ) : (
            <div className='mt-8'>
              {slide?.bulletStyle === 'none' ? (
                <div className='space-y-3 font-sans text-base leading-relaxed sm:text-xl'>
                  {(slide?.bullets ?? []).map((bullet, idx) => (
                    <p key={idx}>{bullet}</p>
                  ))}
                </div>
              ) : slide?.bulletStyle === 'decimal' ? (
                <ol className='list-decimal space-y-3 pl-6 font-sans text-base sm:text-xl'>
                  {(slide?.bullets ?? []).map((bullet, idx) => (
                    <li key={idx}>{bullet}</li>
                  ))}
                </ol>
              ) : slide?.bulletStyle === 'dash' ? (
                <div className='space-y-3 font-sans text-base sm:text-xl'>
                  {(slide?.bullets ?? []).map((bullet, idx) => (
                    <div key={idx} className='flex items-start gap-3'>
                      <span
                        className='font-bold'
                        style={{ color: theme.accentColor }}
                      >
                        —
                      </span>
                      <span>{bullet}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <ul className='list-disc space-y-3 pl-6 font-sans text-base sm:text-xl'>
                  {(slide?.bullets ?? []).map((bullet, idx) => (
                    <li key={idx}>{bullet}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
