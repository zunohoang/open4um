import type { Slide, SlideComponent } from '@/lib/types'
import { FONT_MAP } from '@/features/slide-editor/constants/theme-options'
import React from 'react'

interface SlidePreviewProps {
  slide?: Slide | null
  lectureTitle?: string
  className?: string
}

// Hàm tính toán các đỉnh của ngôi sao 5 cánh trong bounding box
const getStarPoints = (x: number, y: number, w: number, h: number): string => {
  const cx = x + w / 2
  const cy = y + h / 2
  const rOuter = Math.min(w, h) / 2
  const rInner = rOuter * 0.4
  const points: string[] = []

  for (let i = 0; i < 10; i++) {
    const angle = (i * Math.PI) / 5 - Math.PI / 2
    const r = i % 2 === 0 ? rOuter : rInner
    const px = cx + r * Math.cos(angle)
    const py = cy + r * Math.sin(angle)
    points.push(`${px.toFixed(1)},${py.toFixed(1)}`)
  }

  return points.join(' ')
}

export const SlidePreview: React.FC<SlidePreviewProps> = ({
  slide,
  lectureTitle,
  className = ''
}) => {
  const hasComponents = Boolean(
    slide?.components && slide.components.length > 0
  )
  const hasContent = Boolean(
    hasComponents ||
    slide?.title ||
    (slide?.bullets && slide.bullets.length > 0) ||
    slide?.subtitle
  )

  // 1. Trường hợp slide hoàn toàn trống
  if (!hasContent) {
    return (
      <svg
        viewBox='0 0 960 540'
        className={`h-full w-full select-none ${className}`}
        preserveAspectRatio='xMidYMid meet'
      >
        <defs>
          <pattern
            id='grid-dots'
            x='0'
            y='0'
            width='24'
            height='24'
            patternUnits='userSpaceOnUse'
          >
            <circle cx='12' cy='12' r='1' fill='#e7e5e4' />
          </pattern>
        </defs>
        <rect width='960' height='540' fill='#fafaf9' />
        <rect width='960' height='540' fill='url(#grid-dots)' />
        <rect width='960' height='6' fill='#c2410c' opacity='0.8' />

        {/* Khung nội dung tối giản */}
        <rect
          x='160'
          y='120'
          width='640'
          height='300'
          rx='8'
          fill='#ffffff'
          stroke='#e7e5e4'
          strokeWidth='2'
          strokeDasharray='6 6'
        />
        <foreignObject x='180' y='180' width='600' height='180'>
          <div
            style={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              fontFamily: '"Lora", Georgia, serif',
              color: '#064e3b'
            }}
          >
            <span style={{ fontSize: '32px', marginBottom: '8px' }}>📄</span>
            <span
              style={{
                fontSize: '22px',
                fontWeight: 600,
                color: '#1c1917',
                maxWidth: '90%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {lectureTitle || 'Slide trống'}
            </span>
            <span
              style={{
                fontSize: '13px',
                color: '#78716c',
                fontFamily: '"Be Vietnam Pro", sans-serif',
                marginTop: '4px'
              }}
            >
              Chưa có nội dung xem trước
            </span>
          </div>
        </foreignObject>
      </svg>
    )
  }

  // Helper render hình khối SVG chuẩn
  const renderShapeComp = (comp: SlideComponent) => {
    const x = (comp.x / 100) * 960
    const y = (comp.y / 100) * 540
    const w = ((comp.width ?? 30) / 100) * 960
    const h = comp.height ? (comp.height / 100) * 540 : w * 0.6
    const fill =
      comp.fillColor === 'transparent'
        ? 'transparent'
        : comp.fillColor || '#c45b3f'
    const stroke = comp.borderColor || '#173c39'
    const strokeW = comp.borderWidth ?? 0
    const radius = comp.borderRadius ?? 0
    const shapeType = comp.shapeType || 'rectangle'

    switch (shapeType) {
      case 'circle':
        return (
          <ellipse
            key={comp.id}
            cx={x + w / 2}
            cy={y + h / 2}
            rx={w / 2}
            ry={h / 2}
            fill={fill}
            stroke={strokeW > 0 ? stroke : 'none'}
            strokeWidth={strokeW}
          />
        )
      case 'triangle':
        return (
          <polygon
            key={comp.id}
            points={`${x + w / 2},${y} ${x + w},${y + h} ${x},${y + h}`}
            fill={fill}
            stroke={strokeW > 0 ? stroke : 'none'}
            strokeWidth={strokeW}
          />
        )
      case 'star':
        return (
          <polygon
            key={comp.id}
            points={getStarPoints(x, y, w, h)}
            fill={fill}
            stroke={strokeW > 0 ? stroke : 'none'}
            strokeWidth={strokeW}
          />
        )
      case 'line':
        return (
          <line
            key={comp.id}
            x1={x}
            y1={y + (strokeW || 2) / 2}
            x2={x + w}
            y2={y + (strokeW || 2) / 2}
            stroke={stroke || fill}
            strokeWidth={Math.max(2, strokeW || 2)}
          />
        )
      case 'rounded-rect':
        return (
          <rect
            key={comp.id}
            x={x}
            y={y}
            width={w}
            height={h}
            rx={radius || 16}
            fill={fill}
            stroke={strokeW > 0 ? stroke : 'none'}
            strokeWidth={strokeW}
          />
        )
      case 'rectangle':
      case 'square':
      default:
        return (
          <rect
            key={comp.id}
            x={x}
            y={y}
            width={w}
            height={h}
            rx={radius}
            fill={fill}
            stroke={strokeW > 0 ? stroke : 'none'}
            strokeWidth={strokeW}
          />
        )
    }
  }

  // 2. Trường hợp slide có components tùy biến
  if (hasComponents && slide?.components) {
    return (
      <svg
        viewBox='0 0 960 540'
        className={`h-full w-full select-none ${className}`}
        preserveAspectRatio='xMidYMid meet'
      >
        {/* Nền slide */}
        <rect
          width='960'
          height='540'
          fill={(slide.backgroundColor as string) || '#ffffff'}
        />

        {/* Kết xuất các components */}
        {slide.components.map((comp) => {
          const x = (comp.x / 100) * 960
          const y = (comp.y / 100) * 540
          const w = ((comp.width ?? 84) / 100) * 960
          const h = comp.height ? (comp.height / 100) * 540 : undefined

          if (comp.type === 'shape') {
            return renderShapeComp(comp)
          }

          if (comp.type === 'image') {
            return (
              <image
                key={comp.id}
                href={comp.imageUrl || comp.content}
                x={x}
                y={y}
                width={w}
                height={h || w * 0.6}
                preserveAspectRatio='xMidYMid slice'
              />
            )
          }

          // Các dạng văn bản (title, subtitle, bullets, text, quote)
          const fontFamily =
            FONT_MAP[comp.fontFamily || 'sans'] ||
            comp.fontFamily ||
            '"Lora", serif'
          const fontSize = comp.fontSize ?? 20
          const color = comp.color || '#173c39'
          const textAlign = comp.textAlign ?? 'left'
          const fontWeight = comp.fontWeight ?? 'normal'
          const fontStyle = comp.fontStyle ?? 'normal'
          const textTransform =
            comp.textCase === 'uppercase' ? 'uppercase' : 'none'
          const textDecoration = comp.textDecoration ?? 'none'

          return (
            <foreignObject
              key={comp.id}
              x={x}
              y={y}
              width={w}
              height={h || Math.max(60, 540 - y - 10)}
              className='overflow-hidden pointer-events-none'
            >
              <div
                style={{
                  fontFamily,
                  fontSize: `${fontSize}px`,
                  fontWeight,
                  fontStyle,
                  textDecoration,
                  color,
                  textAlign,
                  textTransform,
                  lineHeight: 1.3,
                  wordBreak: 'break-word',
                  width: '100%',
                  height: '100%',
                  overflow: 'hidden'
                }}
              >
                {comp.type === 'bullets' ? (
                  <ul
                    style={{
                      listStyleType: 'disc',
                      paddingLeft: '24px',
                      margin: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}
                  >
                    {comp.content
                      .split('\n')
                      .filter((s) => s.trim())
                      .map((bullet, idx) => (
                        <li key={idx}>{bullet}</li>
                      ))}
                  </ul>
                ) : comp.type === 'quote' ? (
                  <div
                    style={{
                      fontStyle: 'italic',
                      borderTop: '2px solid rgba(0,0,0,0.15)',
                      borderBottom: '2px solid rgba(0,0,0,0.15)',
                      padding: '12px 8px'
                    }}
                  >
                    “ {comp.content} ”
                  </div>
                ) : (
                  <div style={{ whiteSpace: 'pre-wrap' }}>{comp.content}</div>
                )}
              </div>
            </foreignObject>
          )
        })}
      </svg>
    )
  }

  // 3. Trường hợp slide dạng tiêu chuẩn / AI sinh ra (chưa tùy biến components)
  const title = slide?.title || lectureTitle || 'Tiêu đề bài giảng'
  const subtitle = slide?.subtitle
  const bullets = slide?.bullets || []
  const layout = slide?.layout || 'standard'
  const titleAlign = slide?.titleAlign || 'left'
  const titleSize =
    slide?.titleSize === 'xl' ? 44 : slide?.titleSize === 'sm' ? 28 : 36
  const bulletStyle = slide?.bulletStyle || 'disc'

  return (
    <svg
      viewBox='0 0 960 540'
      className={`h-full w-full select-none ${className}`}
      preserveAspectRatio='xMidYMid meet'
    >
      {/* Nền slide */}
      <rect
        width='960'
        height='540'
        fill={(slide?.backgroundColor as string) || '#ffffff'}
      />

      <foreignObject
        x='64'
        y='48'
        width='832'
        height='444'
        className='overflow-hidden pointer-events-none'
      >
        <div
          style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-start',
            color: '#173c39',
            fontFamily: '"Be Vietnam Pro", sans-serif'
          }}
        >
          {/* Tiêu đề & Phụ đề */}
          <div style={{ textAlign: titleAlign, marginBottom: '20px' }}>
            <h1
              style={{
                fontFamily: '"Lora", Georgia, serif',
                fontSize: `${titleSize}px`,
                fontWeight: 600,
                color: '#064e3b',
                lineHeight: 1.25,
                margin: 0,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden'
              }}
            >
              {title}
            </h1>
            {subtitle && (
              <p
                style={{
                  fontSize: '18px',
                  color: '#64748b',
                  fontStyle: 'italic',
                  margin: '8px 0 0 0',
                  lineHeight: 1.3
                }}
              >
                {subtitle}
              </p>
            )}
          </div>

          {/* Nội dung theo bố cục */}
          {layout === 'quote' && bullets.length > 0 ? (
            <div
              style={{
                margin: 'auto 0',
                padding: '24px 16px',
                borderTop: '2px solid rgba(0,0,0,0.1)',
                borderBottom: '2px solid rgba(0,0,0,0.1)',
                textAlign: 'center',
                fontFamily: '"Lora", serif',
                fontStyle: 'italic',
                fontSize: '24px',
                color: '#064e3b',
                lineHeight: 1.4
              }}
            >
              “ {bullets.join(' ')} ”
            </div>
          ) : layout === 'two-column' && bullets.length > 0 ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '24px',
                marginTop: '12px'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}
              >
                {bullets
                  .slice(0, Math.ceil(bullets.length / 2))
                  .map((bullet, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '8px',
                        fontSize: '16px',
                        lineHeight: 1.35
                      }}
                    >
                      <span
                        style={{
                          color: '#c2410c',
                          fontWeight: 'bold',
                          flexShrink: 0
                        }}
                      >
                        {bulletStyle === 'decimal'
                          ? `${idx + 1}.`
                          : bulletStyle === 'dash'
                            ? '—'
                            : '•'}
                      </span>
                      <span>{bullet}</span>
                    </div>
                  ))}
              </div>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}
              >
                {bullets
                  .slice(Math.ceil(bullets.length / 2))
                  .map((bullet, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '8px',
                        fontSize: '16px',
                        lineHeight: 1.35
                      }}
                    >
                      <span
                        style={{
                          color: '#c2410c',
                          fontWeight: 'bold',
                          flexShrink: 0
                        }}
                      >
                        {bulletStyle === 'decimal'
                          ? `${Math.ceil(bullets.length / 2) + idx + 1}.`
                          : bulletStyle === 'dash'
                            ? '—'
                            : '•'}
                      </span>
                      <span>{bullet}</span>
                    </div>
                  ))}
              </div>
            </div>
          ) : layout === 'headline' && bullets.length > 0 ? (
            <div
              style={{
                fontSize: '19px',
                lineHeight: 1.5,
                color: '#334155',
                marginTop: '16px'
              }}
            >
              {bullets.join(' • ')}
            </div>
          ) : (
            bullets.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  marginTop: '12px'
                }}
              >
                {bullets.slice(0, 5).map((bullet, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      fontSize: '17px',
                      lineHeight: 1.35
                    }}
                  >
                    <span
                      style={{
                        color: '#c2410c',
                        fontWeight: 'bold',
                        flexShrink: 0
                      }}
                    >
                      {bulletStyle === 'none'
                        ? ''
                        : bulletStyle === 'decimal'
                          ? `${idx + 1}.`
                          : bulletStyle === 'dash'
                            ? '—'
                            : '•'}
                    </span>
                    <span>{bullet}</span>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </foreignObject>
    </svg>
  )
}
