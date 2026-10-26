interface SlideContentItem {
  title?: string
  description?: string
  stat?: string
  tag?: string
}

interface SlideComponent {
  id?: unknown
  type?: unknown
  content?: unknown
  x?: unknown
  y?: unknown
}

export interface AiReadableSlideContext {
  title: string
  subtitle: string
  header: string
  footer: string
  bullets: string[]
  contentItems: SlideContentItem[]
  visibleText: string[]
}

const CHAT_ONLY_REQUEST_PATTERN =
  /(?:^|[\s,;:.!?])(chỉ\s+(?:cần\s+)?(?:trả\s+lời|phản\s+hồi|giải\s+đáp)|không\s+(?:được\s+)?(?:sửa|chỉnh\s+sửa|thay\s+đổi|cập\s+nhật|tạo|thêm)(?:\s+(?:nội\s+dung|bất\s+kỳ))?\s+(?:slide|slides|trang|bài\s+giảng))(?:$|[\s,;:.!?])/iu

const TEXT_COMPONENT_TYPES = new Set([
  'title',
  'subtitle',
  'text',
  'bullets',
  'quote'
])

const asText = (value: unknown) =>
  typeof value === 'string' ? value.trim() : ''

const asNumber = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value)
    ? value
    : Number.MAX_SAFE_INTEGER

const splitText = (value: unknown) =>
  asText(value)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

const uniqueText = (values: string[]) => {
  const seen = new Set<string>()
  return values.filter((value) => {
    const key = value.normalize('NFKC').replace(/\s+/g, ' ').toLowerCase()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

const getStructuredContent = (
  slide: Record<string, unknown>
): AiReadableSlideContext => {
  const contentItems = Array.isArray(slide.contentItems)
    ? (slide.contentItems as Array<Record<string, unknown>>).map((item) => ({
        title: asText(item.title),
        description: asText(item.description),
        stat: asText(item.stat) || undefined,
        tag: asText(item.tag) || undefined
      }))
    : []
  const bullets = Array.isArray(slide.bullets)
    ? slide.bullets.flatMap(splitText)
    : []
  const subtitle = asText(slide.subtitle)
  const visibleText = uniqueText([
    ...splitText(subtitle),
    ...contentItems.flatMap((item) => [
      asText(item.tag),
      asText(item.stat),
      asText(item.title),
      asText(item.description)
    ]),
    ...bullets,
    ...splitText(slide.codeSnippet)
  ])

  return {
    title: asText(slide.title),
    subtitle,
    header: asText(slide.header),
    footer: asText(slide.footer),
    bullets,
    contentItems,
    visibleText
  }
}

export const getAiReadableSlideContext = (
  slide: Record<string, unknown>
): AiReadableSlideContext => {
  if (!Array.isArray(slide.components)) return getStructuredContent(slide)

  const components = (slide.components as SlideComponent[])
    .map((component, index) => ({ component, index }))
    .filter(
      ({ component }) =>
        TEXT_COMPONENT_TYPES.has(asText(component.type)) &&
        Boolean(asText(component.content))
    )
    .sort((a, b) => {
      const yDiff = asNumber(a.component.y) - asNumber(b.component.y)
      if (yDiff !== 0) return yDiff
      const xDiff = asNumber(a.component.x) - asNumber(b.component.x)
      return xDiff !== 0 ? xDiff : a.index - b.index
    })
    .map(({ component }) => component)

  const titleComponent = components.find(
    (component) => asText(component.type) === 'title'
  )
  const subtitleComponent = components.find(
    (component) => asText(component.type) === 'subtitle'
  )
  const headerComponent = components.find((component) =>
    asText(component.id).startsWith('header-')
  )
  const footerComponent = components.find((component) =>
    asText(component.id).startsWith('footer-')
  )
  const excludedComponents = new Set([
    titleComponent,
    headerComponent,
    footerComponent
  ])
  const bullets = components
    .filter((component) => asText(component.type) === 'bullets')
    .flatMap((component) => splitText(component.content))
  const visibleText = uniqueText(
    components
      .filter((component) => !excludedComponents.has(component))
      .flatMap((component) => splitText(component.content))
  )

  return {
    title: asText(titleComponent?.content),
    subtitle: asText(subtitleComponent?.content),
    header: asText(headerComponent?.content),
    footer: asText(footerComponent?.content),
    bullets,
    contentItems: [],
    visibleText
  }
}

export const isExplicitChatOnlyRequest = (message: string) =>
  CHAT_ONLY_REQUEST_PATTERN.test(message.normalize('NFKC').trim())
