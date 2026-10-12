const SHORT_HINT_REQUEST_PATTERN =
  /(bổ sung|thêm|chèn).*?(gợi ý|hint)|(gợi ý|hint).*?(ngắn gọn|ngắn)/i

const normalizeText = (value: string) =>
  value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase()

const asText = (value: unknown) =>
  typeof value === 'string' ? value.trim() : ''

const stripHintPrefix = (value: string) =>
  value.replace(/^\s*(?:[-•]\s*)?(?:gợi\s*ý|hint)\s*[:：-]?\s*/i, '').trim()

const shortenHint = (value: string, maxLength = 180, maxWords = 18) => {
  const normalized = stripHintPrefix(value).replace(/\s+/g, ' ').trim()
  const words = normalized.split(' ')
  const wordLimited =
    words.length > maxWords
      ? `${words.slice(0, maxWords).join(' ')}…`
      : normalized
  if (wordLimited.length <= maxLength) return wordLimited

  const shortened = wordLimited.slice(0, maxLength + 1)
  const lastSpace = shortened.lastIndexOf(' ')
  return `${shortened.slice(0, lastSpace > 0 ? lastSpace : maxLength).trim()}…`
}

const getNovelText = (candidate: unknown, originals: string[]) => {
  const text = asText(candidate)
  if (!text) return ''

  const normalizedCandidate = normalizeText(text)
  const isExisting = originals.some(
    (original) => normalizeText(original) === normalizedCandidate
  )
  return isExisting ? '' : text
}

const extractHint = (
  originalSlide: Record<string, unknown>,
  proposedSlide: Record<string, unknown>
) => {
  const originalSubtitle = asText(originalSlide.subtitle)
  const proposedSubtitle = asText(proposedSlide.subtitle)
  if (proposedSubtitle) {
    if (
      originalSubtitle &&
      normalizeText(proposedSubtitle).startsWith(
        normalizeText(originalSubtitle)
      )
    ) {
      const appendedText = proposedSubtitle
        .slice(originalSubtitle.length)
        .trim()
      if (appendedText) return appendedText
    } else if (
      normalizeText(proposedSubtitle) !== normalizeText(originalSubtitle)
    ) {
      return proposedSubtitle
    }
  }

  const originalBullets = Array.isArray(originalSlide.bullets)
    ? originalSlide.bullets.map(asText).filter(Boolean)
    : []
  const proposedBullets = Array.isArray(proposedSlide.bullets)
    ? proposedSlide.bullets
    : []
  for (const bullet of proposedBullets) {
    const novelBullet = getNovelText(bullet, originalBullets)
    if (novelBullet) return novelBullet
  }

  const originalItems = Array.isArray(originalSlide.contentItems)
    ? (originalSlide.contentItems as Array<Record<string, unknown>>)
    : []
  const originalItemTexts = originalItems.flatMap((item) => [
    asText(item.title),
    asText(item.description)
  ])
  const proposedItems = Array.isArray(proposedSlide.contentItems)
    ? (proposedSlide.contentItems as Array<Record<string, unknown>>)
    : []
  const hintItem = proposedItems.find((item) =>
    /(gợi ý|hint)/i.test(asText(item.title))
  )
  const orderedItems = hintItem
    ? [hintItem, ...proposedItems.filter((item) => item !== hintItem)]
    : proposedItems

  for (const item of orderedItems) {
    const description = getNovelText(item.description, originalItemTexts)
    if (description) return description

    const title = getNovelText(item.title, originalItemTexts)
    if (title && !/^\s*(gợi ý|hint)\s*$/i.test(title)) return title
  }

  const proposedFooter = getNovelText(proposedSlide.footer, [
    asText(originalSlide.footer)
  ])
  if (proposedFooter) return proposedFooter

  const proposedTitle = getNovelText(proposedSlide.title, [
    asText(originalSlide.title)
  ])
  if (proposedTitle && /(gợi ý|hint)/i.test(proposedTitle)) {
    return proposedTitle
  }

  return ''
}

export const isShortHintAdditionRequest = (message: string) =>
  SHORT_HINT_REQUEST_PATTERN.test(message.trim())

export const mergeShortHintIntoSlide = (
  originalSlide: Record<string, unknown>,
  proposedSlide: Record<string, unknown>
): Record<string, unknown> => {
  const extractedHint = shortenHint(extractHint(originalSlide, proposedSlide))
  if (!extractedHint) return { ...originalSlide }

  const hintLine = `Gợi ý: ${extractedHint}`
  const originalSubtitle = asText(originalSlide.subtitle)
  const subtitleAlreadyContainsHint = originalSubtitle
    ? normalizeText(originalSubtitle).includes(normalizeText(hintLine))
    : false

  const originalComponents = Array.isArray(originalSlide.components)
    ? (originalSlide.components as Array<Record<string, unknown>>)
    : null
  let hintAddedToComponents = false
  const components = originalComponents?.map((component) => {
    const componentId = asText(component.id)
    const isHintTarget =
      component.type === 'subtitle' ||
      componentId.startsWith('sub-') ||
      componentId.startsWith('footer-') ||
      componentId.startsWith('ai-hint-')
    if (!isHintTarget || hintAddedToComponents) return { ...component }

    hintAddedToComponents = true
    const currentContent = asText(component.content)
    const alreadyContainsHint = normalizeText(currentContent).includes(
      normalizeText(hintLine)
    )
    return {
      ...component,
      content: alreadyContainsHint
        ? currentContent
        : currentContent
          ? `${currentContent}\n${hintLine}`
          : hintLine
    }
  })

  if (components && !hintAddedToComponents) {
    components.push({
      id: `ai-hint-${String(originalSlide.id || 'slide')}`,
      type: 'text',
      content: hintLine,
      x: 8,
      y: 91,
      width: 84,
      fontSize: 11,
      fontStyle: 'italic',
      textAlign: 'left'
    })
  }

  return {
    ...originalSlide,
    subtitle: subtitleAlreadyContainsHint
      ? originalSubtitle
      : originalSubtitle
        ? `${originalSubtitle}\n${hintLine}`
        : hintLine,
    ...(components ? { components } : {})
  }
}
