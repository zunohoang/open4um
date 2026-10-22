import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent
} from 'react'

interface TimeSeriesPoint {
  date: string // YYYY-MM-DD
  value: number
}

interface TimeSeriesChartProps {
  title: string
  unit: string
  points: TimeSeriesPoint[]
}

const HEIGHT = 200
const MARGIN = { top: 12, right: 12, bottom: 28, left: 44 }
const MIN_LABEL_SPACING = 64
const LABEL_HALF_WIDTH = 18

const numberFormatter = new Intl.NumberFormat('vi-VN')
const compactFormatter = new Intl.NumberFormat('vi-VN', {
  notation: 'compact',
  maximumFractionDigits: 1
})

// 'YYYY-MM-DD' -> 'dd/MM' hoặc 'dd/MM/yyyy', tách chuỗi để không bị lệch múi giờ như khi qua Date
export const formatDay = (date: string, withYear = false) => {
  const [year, month, day] = date.split('-')
  return withYear ? `${day}/${month}/${year}` : `${day}/${month}`
}

const formatTick = (value: number) =>
  value >= 1000 ? compactFormatter.format(value) : numberFormatter.format(value)

// Bước chia trục Y "tròn" (1, 2, 5 × 10^n) cho khoảng 4 vạch; tối thiểu 1 vì dữ liệu là số nguyên
const niceStep = (max: number) => {
  const raw = max / 4
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const normalized = raw / magnitude
  const nice =
    normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10
  return Math.max(1, nice * magnitude)
}

// Biểu đồ cột một chuỗi theo ngày: tooltip theo ngày (chuột/bàn phím), có bảng thay thế
export const TimeSeriesChart = ({
  title,
  unit,
  points
}: TimeSeriesChartProps) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [showTable, setShowTable] = useState(false)

  useEffect(() => {
    const element = containerRef.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) =>
      setWidth(entry.contentRect.width)
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const total = points.reduce((sum, point) => sum + point.value, 0)
  const hasData = points.some((point) => point.value > 0)
  const lastIndex = points.length - 1

  const plotWidth = Math.max(0, width - MARGIN.left - MARGIN.right)
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom
  const baseline = MARGIN.top + plotHeight
  const maxValue = Math.max(0, ...points.map((point) => point.value))
  const step = hasData ? niceStep(maxValue) : 1
  const yMax = Math.max(step, Math.ceil(maxValue / step) * step)
  const ticks = Array.from(
    { length: Math.round(yMax / step) + 1 },
    (_, index) => index * step
  )
  const y = (value: number) => baseline - (value / yMax) * plotHeight

  const band = points.length > 0 ? plotWidth / points.length : 0
  // Cột tối đa 24px, chừa khe 2px giữa các cột; quá nhiều ngày thì bỏ khe
  const barWidth = Math.max(0.5, Math.min(24, band >= 4 ? band - 2 : band))
  const center = (index: number) => MARGIN.left + band * (index + 0.5)
  // Bo 4px ở đầu cột, vuông ở đường gốc
  const barPath = (index: number, value: number) => {
    const left = center(index) - barWidth / 2
    const right = left + barWidth
    const top = y(value)
    const radius = Math.min(4, barWidth / 2, baseline - top)
    return `M${left},${baseline} V${top + radius} Q${left},${top} ${left + radius},${top} H${right - radius} Q${right},${top} ${right},${top + radius} V${baseline} Z`
  }

  // Nhãn trục X rải đều (luôn có ngày đầu và ngày cuối), cách nhau tối thiểu ~64px
  const labelCount = Math.min(
    points.length,
    Math.max(2, Math.floor(plotWidth / MIN_LABEL_SPACING))
  )
  const labelIndexes =
    labelCount <= 1
      ? [0]
      : Array.from({ length: labelCount }, (_, index) =>
          Math.round((index * lastIndex) / (labelCount - 1))
        )
  const labelX = (index: number) =>
    Math.min(
      Math.max(center(index), MARGIN.left + LABEL_HALF_WIDTH),
      width - MARGIN.right - LABEL_HALF_WIDTH
    )

  const active = activeIndex === null ? null : points[activeIndex]
  const activeText = active
    ? `${formatDay(active.date, true)}: ${numberFormatter.format(active.value)} ${unit}`
    : ''

  const handlePointerMove = (event: PointerEvent<SVGRectElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    const ratio = (event.clientX - bounds.left) / bounds.width
    setActiveIndex(
      Math.min(lastIndex, Math.max(0, Math.floor(ratio * points.length)))
    )
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = activeIndex ?? lastIndex
    const moves: Record<string, number> = {
      ArrowLeft: current - 1,
      ArrowRight: current + 1,
      Home: 0,
      End: lastIndex
    }
    if (!(event.key in moves)) return
    event.preventDefault()
    setActiveIndex(Math.min(lastIndex, Math.max(0, moves[event.key])))
  }

  return (
    <figure className='min-w-0 border border-stone-200 bg-white p-4 font-sans'>
      <figcaption className='mb-3 flex items-start justify-between gap-3'>
        <div>
          <h3 className='text-sm font-semibold text-stone-900'>{title}</h3>
          <p className='text-xs text-stone-500'>
            Tổng trong khoảng: {numberFormatter.format(total)} {unit}
          </p>
        </div>
        {hasData && (
          <button
            aria-pressed={showTable}
            className='shrink-0 text-xs font-semibold text-stone-600 underline underline-offset-2 hover:text-stone-900'
            onClick={() => setShowTable((current) => !current)}
            type='button'
          >
            {showTable ? 'Xem biểu đồ' : 'Xem bảng'}
          </button>
        )}
      </figcaption>

      <div className='relative' ref={containerRef}>
        {!hasData ? (
          <div className='flex h-[200px] items-center justify-center text-sm text-stone-500'>
            Chưa có dữ liệu
          </div>
        ) : showTable ? (
          <div className='h-[200px] overflow-y-auto'>
            <table className='w-full text-sm'>
              <caption className='sr-only'>{title}</caption>
              <thead>
                <tr className='border-b border-stone-200 text-left text-xs text-stone-500'>
                  <th className='py-2 font-semibold' scope='col'>
                    Ngày
                  </th>
                  <th className='py-2 text-right font-semibold' scope='col'>
                    Số {unit}
                  </th>
                </tr>
              </thead>
              <tbody className='divide-y divide-stone-100'>
                {points.map((point) => (
                  <tr key={point.date}>
                    <td className='py-1.5 tabular-nums text-stone-600'>
                      {formatDay(point.date, true)}
                    </td>
                    <td className='py-1.5 text-right tabular-nums text-stone-900'>
                      {numberFormatter.format(point.value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div
            aria-label={`${title}. Dùng phím mũi tên trái, phải để xem từng ngày.`}
            className='h-[200px] outline-none focus-visible:ring-2 focus-visible:ring-brand-rust/40'
            onBlur={() => setActiveIndex(null)}
            onFocus={() => setActiveIndex((current) => current ?? lastIndex)}
            onKeyDown={handleKeyDown}
            role='group'
            tabIndex={0}
          >
            {width > 0 && (
              <svg
                aria-hidden='true'
                className='block'
                height={HEIGHT}
                width={width}
              >
                {/* Nền nhạt cho ngày đang xem (thấy được cả khi giá trị 0) */}
                {activeIndex !== null && (
                  <rect
                    className='fill-stone-100'
                    height={plotHeight}
                    width={band}
                    x={center(activeIndex) - band / 2}
                    y={MARGIN.top}
                  />
                )}
                {ticks.map((tick) => (
                  <g key={tick}>
                    <line
                      className={
                        tick === 0 ? 'stroke-stone-300' : 'stroke-stone-200'
                      }
                      shapeRendering='crispEdges'
                      strokeWidth={1}
                      x1={MARGIN.left}
                      x2={width - MARGIN.right}
                      y1={y(tick)}
                      y2={y(tick)}
                    />
                    <text
                      className='fill-stone-500 text-[11px] tabular-nums'
                      dy='0.32em'
                      textAnchor='end'
                      x={MARGIN.left - 8}
                      y={y(tick)}
                    >
                      {formatTick(tick)}
                    </text>
                  </g>
                ))}
                {points.map(
                  (point, index) =>
                    point.value > 0 && (
                      <path
                        className='fill-brand-rust'
                        d={barPath(index, point.value)}
                        key={point.date}
                      />
                    )
                )}
                {labelIndexes.map((index) => (
                  <text
                    className='fill-stone-500 text-[11px] tabular-nums'
                    key={index}
                    textAnchor='middle'
                    x={labelX(index)}
                    y={HEIGHT - 8}
                  >
                    {formatDay(points[index].date)}
                  </text>
                ))}
                {/* Vùng bắt chuột phủ cả vùng vẽ: trỏ vào cột nào thì xem ngày đó */}
                <rect
                  fill='transparent'
                  height={plotHeight}
                  onPointerLeave={() => setActiveIndex(null)}
                  onPointerMove={handlePointerMove}
                  width={plotWidth}
                  x={MARGIN.left}
                  y={MARGIN.top}
                />
              </svg>
            )}

            {active && activeIndex !== null && (
              <div
                className='pointer-events-none absolute top-0 z-10 -translate-x-1/2 whitespace-nowrap border border-stone-200 bg-white px-2.5 py-1.5 shadow-sm'
                style={{
                  left: Math.min(Math.max(center(activeIndex), 72), width - 72)
                }}
              >
                <div className='flex items-center gap-1.5'>
                  <span
                    aria-hidden='true'
                    className='h-0.5 w-3 rounded-full bg-brand-rust'
                  />
                  <span className='text-sm font-semibold text-stone-900'>
                    {numberFormatter.format(active.value)} {unit}
                  </span>
                </div>
                <div className='text-[11px] text-stone-500'>
                  {formatDay(active.date, true)}
                </div>
              </div>
            )}
            <p aria-live='polite' className='sr-only'>
              {activeText}
            </p>
          </div>
        )}
      </div>
    </figure>
  )
}
