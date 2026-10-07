export interface SlideTheme {
  id: string
  name: string
  description: string
  background: string
  cardBackground: string
  cardBorder: string
  textPrimary: string
  textSecondary: string
  accentColor: string
  headingFont: string
  bodyFont: string
  isDark?: boolean
}

export const THEME_PRESETS: SlideTheme[] = [
  {
    id: 'classic-editorial',
    name: 'Giấy ngà & Mực đậm',
    description: 'Biên tập học thuật cổ điển, trang nhã, tương phản dịu mắt',
    background: '#fbf8f2',
    cardBackground: '#f3ece0',
    cardBorder: '#e5d9c7',
    textPrimary: '#1c1917',
    textSecondary: '#57534e',
    accentColor: '#c45b3f',
    headingFont: 'display',
    bodyFont: 'sans',
    isDark: false
  },
  {
    id: 'modern-obsidian',
    name: 'Dark Mode Công nghệ',
    description: 'Nền tối cao cấp, màu nhấn Cyan nổi bật, hiện đại và lôi cuốn',
    background: '#0f172a',
    cardBackground: '#1e293b',
    cardBorder: '#334155',
    textPrimary: '#f8fafc',
    textSecondary: '#94a3b8',
    accentColor: '#38bdf8',
    headingFont: 'jakarta',
    bodyFont: 'inter',
    isDark: true
  },
  {
    id: 'clean-minimalist',
    name: 'Tối giản thanh lịch',
    description:
      'Nền trắng thuần khiết, điểm nhấn Indigo sắc sảo, phong cách Apple',
    background: '#ffffff',
    cardBackground: '#f8fafc',
    cardBorder: '#e2e8f0',
    textPrimary: '#0f172a',
    textSecondary: '#64748b',
    accentColor: '#4f46e5',
    headingFont: 'inter',
    bodyFont: 'roboto',
    isDark: false
  },
  {
    id: 'ocean-emerald',
    name: 'Lục bảo học thuật',
    description: 'Tone xanh lục bảo quý phái, sư phạm và trang trọng',
    background: '#072b24',
    cardBackground: '#0e3830',
    cardBorder: '#1b564a',
    textPrimary: '#ffffff',
    textSecondary: '#a7f3d0',
    accentColor: '#34d399',
    headingFont: 'montserrat',
    bodyFont: 'inter',
    isDark: true
  },
  {
    id: 'warm-coral',
    name: 'San hô sáng tạo',
    description:
      'Tone ấm áp nhiệt huyết, phù hợp cho workshop và thuyết trình dự án',
    background: '#fff7ed',
    cardBackground: '#ffedd5',
    cardBorder: '#fed7aa',
    textPrimary: '#431407',
    textSecondary: '#9a3412',
    accentColor: '#ea580c',
    headingFont: 'comfortaa',
    bodyFont: 'jakarta',
    isDark: false
  }
]

export const DEFAULT_THEME_ID = 'classic-editorial'

export const getThemeById = (id?: string | null): SlideTheme => {
  return THEME_PRESETS.find((t) => t.id === id) || THEME_PRESETS[0]
}

export interface ServerSlideComponent {
  id: string
  type: 'title' | 'subtitle' | 'text' | 'bullets' | 'quote' | 'shape' | 'image'
  content: string
  x: number
  y: number
  width?: number
  height?: number
  fontSize?: number
  fontWeight?: 'normal' | 'bold'
  fontStyle?: 'normal' | 'italic'
  textDecoration?: 'none' | 'underline'
  textAlign?: 'left' | 'center' | 'right'
  color?: string
  fillColor?: string
  borderColor?: string
  borderWidth?: number
  borderRadius?: number
  shapeType?: string
  imageUrl?: string
  fontFamily?: string
  textCase?: 'none' | 'uppercase'
}

/**
 * Sinh danh sách components thực tế cho slide dựa trên Theme của bài giảng
 * và layout trực quan phong phú có các khối hình nền vuông/chữ nhật bo góc (Cards, Two-Column, Steps, Quote, Headline).
 * Tự động tính toán xếp tầng (Vertical Stacking) chống đè chữ 100%.
 */
export const buildSlideComponents = (
  slide: Record<string, unknown>,
  themeId?: string
): ServerSlideComponent[] => {
  const theme = getThemeById(themeId)
  const comps: ServerSlideComponent[] = []
  const slideId = (slide.id as string) || `slide-${Date.now()}`
  const title = ((slide.title as string) || 'Tiêu đề slide').trim()
  const subtitle = ((slide.subtitle as string) || '').trim()
  const header = ((slide.header as string) || '').trim()
  const footer = ((slide.footer as string) || '').trim()
  const layout = (
    (slide.layout as string) ||
    (slide.contentLayout as string) ||
    'cards'
  ).toLowerCase()
  const titleAlign = ((slide.titleAlign as string) ||
    (layout === 'headline' || layout === 'quote' ? 'center' : 'left')) as
    'left' | 'center' | 'right'
  const titleSize =
    (slide.titleSize as string) || (layout === 'headline' ? 'xl' : 'md')

  type Item = {
    title: string
    description: string
    tag?: string
    stat?: string
    code?: string
  }
  let items: Item[] = []
  if (Array.isArray(slide.contentItems) && slide.contentItems.length > 0) {
    items = slide.contentItems as Item[]
  } else if (Array.isArray(slide.bullets) && slide.bullets.length > 0) {
    items = (slide.bullets as string[])
      .filter((b) => Boolean(b && b.trim()))
      .map((b, idx) => {
        const clean = b.trim()
        const colonIdx = clean.indexOf(':')
        if (colonIdx > 0 && colonIdx < 50) {
          return {
            title: clean.substring(0, colonIdx).trim(),
            description: clean.substring(colonIdx + 1).trim(),
            tag: `0${idx + 1}`
          }
        }
        const dashIdx = clean.indexOf(' - ')
        if (dashIdx > 0 && dashIdx < 50) {
          return {
            title: clean.substring(0, dashIdx).trim(),
            description: clean.substring(dashIdx + 3).trim(),
            tag: `0${idx + 1}`
          }
        }
        return {
          title: clean,
          description: '',
          tag: `0${idx + 1}`
        }
      })
  }

  // 1. DẠNG COVER / HEADLINE (Slide mở đầu trang trọng - Tuyệt đối không đè chữ)
  if (layout === 'headline') {
    const titleLines = Math.max(1, Math.ceil(title.length / 28))
    const titleH = titleLines * 9.5
    const totalBlockH = titleH + (subtitle ? 9 : 0) + 6
    const startCoverY = Math.max(16, Math.min(30, 48 - totalBlockH / 2))

    comps.push({
      id: `title-${slideId}`,
      type: 'title',
      content: title,
      x: 8,
      y: startCoverY,
      width: 84,
      fontSize: 44,
      fontWeight: 'bold',
      fontStyle: 'normal',
      textDecoration: 'none',
      textAlign: 'center',
      fontFamily: theme.headingFont,
      color: theme.textPrimary
    })

    if (subtitle) {
      comps.push({
        id: `sub-${slideId}`,
        type: 'subtitle',
        content: subtitle,
        x: 10,
        y: startCoverY + titleH + 3,
        width: 80,
        fontSize: 18,
        fontWeight: 'normal',
        fontStyle: 'italic',
        textDecoration: 'none',
        textAlign: 'center',
        fontFamily: theme.bodyFont,
        color: theme.textSecondary
      })
    }

    // Đường line trang trí
    comps.push({
      id: `divider-${slideId}`,
      type: 'shape',
      shapeType: 'line',
      x: 42,
      y: startCoverY + titleH + (subtitle ? 12 : 5),
      width: 16,
      height: 2,
      fillColor: theme.accentColor,
      borderColor: theme.accentColor,
      borderWidth: 2,
      content: ''
    })

    if (footer) {
      comps.push({
        id: `footer-${slideId}`,
        type: 'text',
        content: footer,
        x: 8,
        y: 91,
        width: 84,
        fontSize: 11,
        textAlign: 'center',
        fontFamily: theme.bodyFont,
        color: theme.textSecondary
      })
    }

    return comps
  }

  // 2. HEADER PAGE (nếu có nhãn chương mục)
  if (header) {
    comps.push({
      id: `header-${slideId}`,
      type: 'text',
      content: header.toUpperCase(),
      x: 8,
      y: 6,
      width: 84,
      fontSize: 11,
      fontWeight: 'bold',
      fontStyle: 'normal',
      textDecoration: 'none',
      textAlign: 'left',
      fontFamily: theme.bodyFont,
      color: theme.accentColor
    })
  }

  // 3. FOOTER PAGE (nếu có chân trang)
  if (footer) {
    comps.push({
      id: `footer-${slideId}`,
      type: 'text',
      content: footer,
      x: 8,
      y: 91,
      width: 84,
      fontSize: 11,
      fontWeight: 'normal',
      fontStyle: 'normal',
      textDecoration: 'none',
      textAlign: 'left',
      fontFamily: theme.bodyFont,
      color: theme.textSecondary
    })
  }

  // 4. TIÊU ĐỀ SLIDE (Tính toán số dòng và font size thích ứng chống đè chữ 100%)
  const titleY = header ? 10.5 : 7.5
  const isLongTitle = title.length > 28
  const titleFontSize =
    titleSize === 'xl'
      ? 42
      : titleSize === 'sm'
        ? 24
        : title.length > 45
          ? 25
          : title.length > 28
            ? 27.5
            : 32
  const charsPerLine =
    titleSize === 'xl' ? 20 : titleSize === 'sm' ? 36 : isLongTitle ? 32 : 26
  const estimatedTitleLines = Math.max(
    1,
    Math.ceil(title.length / charsPerLine)
  )
  const lineHeightPercent =
    titleSize === 'xl' ? 11 : titleSize === 'sm' ? 6.5 : isLongTitle ? 9.5 : 10
  const titleHeight = estimatedTitleLines * lineHeightPercent

  comps.push({
    id: `title-${slideId}`,
    type: 'title',
    content: title,
    x: 8,
    y: titleY,
    width: 84,
    fontSize: titleFontSize,
    fontWeight: 'bold',
    fontStyle: 'normal',
    textDecoration: 'none',
    textAlign: titleAlign,
    fontFamily: theme.headingFont,
    color: theme.textPrimary
  })

  // 5. PHỤ ĐỀ SLIDE (Luôn nằm an toàn bên dưới chiều cao thực của tiêu đề)
  let subtitleHeight = 0
  const subtitleY = titleY + titleHeight + 2
  if (subtitle) {
    const subLines = Math.max(1, Math.ceil(subtitle.length / 48))
    subtitleHeight = subLines * 4.5
    comps.push({
      id: `sub-${slideId}`,
      type: 'subtitle',
      content: subtitle,
      x: 8,
      y: subtitleY,
      width: 84,
      fontSize: 15,
      fontWeight: 'normal',
      fontStyle: 'italic',
      textDecoration: 'none',
      textAlign: titleAlign,
      fontFamily: theme.bodyFont,
      color: theme.textSecondary
    })
  }

  // Tọa độ bắt đầu vùng nội dung thẻ card (Content Box Area)
  // Đảm bảo khoảng cách an toàn tối thiểu 4.5% bên dưới dòng cuối cùng của tiêu đề/phụ đề
  const minSafeY = subtitle
    ? subtitleY + subtitleHeight + 4.5
    : titleY + titleHeight + 4.5
  const startY = Math.min(54, Math.max(28, Math.ceil(minSafeY)))
  const contentHeight = Math.max(38, Math.min(58, 89 - startY))

  // 6. CÁC DẠNG BỐ CỤC HÌNH NỀN HỘP THẺ TRỰC QUAN ĐA DẠNG

  // A. DẠNG SPLIT-HIGHLIGHT (Cột trái: Hero Card trọng tâm nổi bật; Cột phải: 2 thẻ con xếp chồng)
  if (layout === 'split-highlight' && items.length >= 2) {
    const heroWidth = 38
    const subWidth = 43
    const subX = 49
    const subGap = 2.5
    const subCardH = (contentHeight - subGap) / 2

    // 1. Thẻ Hero bên trái (Viền accentColor nổi bật)
    comps.push({
      id: `hero-bg-${slideId}`,
      type: 'shape',
      shapeType: 'rounded-rect',
      fillColor: theme.cardBackground,
      borderColor: theme.accentColor,
      borderWidth: 2,
      borderRadius: 14,
      x: 8,
      y: startY,
      width: heroWidth,
      height: contentHeight,
      content: ''
    })

    // Huy hiệu TRỌNG TÂM của Hero Card
    const heroTag = items[0].tag || 'TRỌNG TÂM'
    comps.push({
      id: `hero-tag-bg-${slideId}`,
      type: 'shape',
      shapeType: 'rounded-rect',
      fillColor: theme.accentColor,
      borderColor: theme.accentColor,
      borderWidth: 0,
      borderRadius: 5,
      x: 10.5,
      y: startY + 3,
      width: 14,
      height: 4.2,
      content: ''
    })

    comps.push({
      id: `hero-tag-${slideId}`,
      type: 'text',
      content: heroTag.toUpperCase(),
      x: 10.5,
      y: startY + 3.5,
      width: 14,
      fontSize: 10,
      fontWeight: 'bold',
      textAlign: 'center',
      fontFamily: 'mono',
      color: '#ffffff'
    })

    // Tiêu đề Hero (tính chiều cao thực tế)
    const heroTitleLen = (items[0].title || '').length
    const heroTitleLines = Math.max(1, Math.ceil(heroTitleLen / 20))
    const heroTitleH = heroTitleLines * 4.8
    const heroTitleY = startY + 9.5

    comps.push({
      id: `hero-title-${slideId}`,
      type: 'text',
      content: items[0].title,
      x: 10.5,
      y: heroTitleY,
      width: heroWidth - 5,
      fontSize: heroTitleLen > 28 ? 18 : 20,
      fontWeight: 'bold',
      textAlign: 'left',
      fontFamily: theme.headingFont,
      color: theme.textPrimary
    })

    // Mô tả Hero (Xếp tầng động bên dưới tiêu đề + Font thích ứng theo độ dài)
    if (items[0].description) {
      const heroDesc = items[0].description
      const heroDescY = heroTitleY + heroTitleH + 2
      const heroDescFontSize =
        heroDesc.length > 180 ? 11.5 : heroDesc.length > 120 ? 12.5 : 13.5

      comps.push({
        id: `hero-desc-${slideId}`,
        type: 'text',
        content: heroDesc,
        x: 10.5,
        y: heroDescY,
        width: heroWidth - 5,
        fontSize: heroDescFontSize,
        textAlign: 'left',
        fontFamily: theme.bodyFont,
        color: theme.textSecondary
      })
    }

    // 2. Hai thẻ con bên phải xếp chồng
    const subItems = items.slice(1, 3)
    subItems.forEach((item, subIdx) => {
      const curY = startY + subIdx * (subCardH + subGap)

      comps.push({
        id: `sub-bg-${slideId}-${subIdx}`,
        type: 'shape',
        shapeType: 'rounded-rect',
        fillColor: theme.cardBackground,
        borderColor: theme.cardBorder,
        borderWidth: 1,
        borderRadius: 12,
        x: subX,
        y: curY,
        width: subWidth,
        height: subCardH,
        content: ''
      })

      const subTitleLen = (item.title || '').length
      const subTitleLines = Math.max(1, Math.ceil(subTitleLen / 24))
      const subTitleH = subTitleLines * 4.2
      const subTitleY = curY + 2.5

      comps.push({
        id: `sub-title-${slideId}-${subIdx}`,
        type: 'text',
        content: item.title,
        x: subX + 3,
        y: subTitleY,
        width: subWidth - 6,
        fontSize: subTitleLen > 25 ? 14.5 : 16,
        fontWeight: 'bold',
        textAlign: 'left',
        fontFamily: theme.headingFont,
        color: theme.textPrimary
      })

      if (item.description) {
        const subDesc = item.description
        const subDescY = subTitleY + subTitleH + 1.5
        const subDescFontSize =
          subDesc.length > 110 ? 11 : subDesc.length > 60 ? 12 : 13

        comps.push({
          id: `sub-desc-${slideId}-${subIdx}`,
          type: 'text',
          content: subDesc,
          x: subX + 3,
          y: subDescY,
          width: subWidth - 6,
          fontSize: subDescFontSize,
          textAlign: 'left',
          fontFamily: theme.bodyFont,
          color: theme.textSecondary
        })
      }
    })

    return comps
  }

  // B. DẠNG METRICS-GRID (Các con số / chỉ số thống kê khổng lồ ấn tượng)
  if (layout === 'metrics-grid' && items.length > 0) {
    const count = Math.min(3, Math.max(2, items.length))
    const gap = 3
    const totalGap = gap * (count - 1)
    const totalWidth = 84
    const colWidth = (totalWidth - totalGap) / count

    items.slice(0, count).forEach((item, idx) => {
      const colX = 8 + idx * (colWidth + gap)
      const statVal =
        item.stat ||
        item.tag ||
        (idx === 0 ? '85%' : idx === 1 ? '3.5X' : '10M+')

      // Khối nền bo góc
      comps.push({
        id: `metric-bg-${slideId}-${idx}`,
        type: 'shape',
        shapeType: 'rounded-rect',
        fillColor: theme.cardBackground,
        borderColor: theme.cardBorder,
        borderWidth: 1,
        borderRadius: 14,
        x: colX,
        y: startY,
        width: colWidth,
        height: contentHeight,
        content: ''
      })

      // Con số khổng lồ (Chỉ số nổi bật: tự động thích ứng kích thước & số dòng để không bao giờ đè chữ)
      const statLen = (statVal || '').length
      const isLongStat = statLen > 6
      const statFontSize =
        count === 2 ? (isLongStat ? 22 : 36) : isLongStat ? 20 : 32
      const charsPerLine = isLongStat ? (count === 2 ? 18 : 12) : 6
      const statLines = Math.max(1, Math.ceil(statLen / charsPerLine))
      const statH = statLines * (isLongStat ? 5.2 : 8.5)

      comps.push({
        id: `metric-num-${slideId}-${idx}`,
        type: 'text',
        content: statVal,
        x: colX + 3,
        y: startY + 3.5,
        width: colWidth - 6,
        fontSize: statFontSize,
        fontWeight: 'bold',
        textAlign: 'left',
        fontFamily: 'mono',
        color: theme.accentColor
      })

      // Line ngăn cách trang nhã (tọa độ động xếp tầng bên dưới chỉ số)
      const dividerY = startY + 3.5 + statH + 1.5
      comps.push({
        id: `metric-divider-${slideId}-${idx}`,
        type: 'shape',
        shapeType: 'line',
        x: colX + 3,
        y: dividerY,
        width: colWidth - 6,
        height: 1,
        fillColor: theme.cardBorder,
        borderColor: theme.cardBorder,
        borderWidth: 1,
        content: ''
      })

      // Tiêu đề chỉ số (tọa độ động xếp tầng bên dưới đường ngăn cách)
      const mTitleLen = (item.title || '').length
      const mTitleLines = Math.max(1, Math.ceil(mTitleLen / 18))
      const mTitleH = mTitleLines * 4.5
      const mTitleY = dividerY + 2

      comps.push({
        id: `metric-title-${slideId}-${idx}`,
        type: 'text',
        content: item.title,
        x: colX + 3,
        y: mTitleY,
        width: colWidth - 6,
        fontSize: count === 2 ? 16 : 14.5,
        fontWeight: 'bold',
        textAlign: 'left',
        fontFamily: theme.headingFont,
        color: theme.textPrimary
      })

      // Mô tả chỉ số (tọa độ động xếp tầng bên dưới tiêu đề)
      if (item.description) {
        const mDesc = item.description
        const mDescY = mTitleY + mTitleH + 1.5
        const mDescFontSize = mDesc.length > 90 ? 11.5 : 12.5

        comps.push({
          id: `metric-desc-${slideId}-${idx}`,
          type: 'text',
          content: mDesc,
          x: colX + 3,
          y: mDescY,
          width: colWidth - 6,
          fontSize: mDescFontSize,
          textAlign: 'left',
          fontFamily: theme.bodyFont,
          color: theme.textSecondary
        })
      }
    })

    return comps
  }

  // C. DẠNG QUAD-GRID (Lưới 4 ô 2x2 cân xứng - SWOT / 4 góc nhìn / 4 trụ cột)
  if ((layout === 'quad-grid' || items.length === 4) && items.length >= 4) {
    const colWidth = 40.5
    const gapX = 3
    const gapY = 3
    const rowH = (contentHeight - gapY) / 2

    items.slice(0, 4).forEach((item, idx) => {
      const colIdx = idx % 2
      const rowIdx = Math.floor(idx / 2)
      const curX = 8 + colIdx * (colWidth + gapX)
      const curY = startY + rowIdx * (rowH + gapY)

      // Hình nền hộp 2x2
      comps.push({
        id: `quad-bg-${slideId}-${idx}`,
        type: 'shape',
        shapeType: 'rounded-rect',
        fillColor: theme.cardBackground,
        borderColor: theme.cardBorder,
        borderWidth: 1,
        borderRadius: 12,
        x: curX,
        y: curY,
        width: colWidth,
        height: rowH,
        content: ''
      })

      // Huy hiệu góc nhỏ
      comps.push({
        id: `quad-badge-${slideId}-${idx}`,
        type: 'shape',
        shapeType: 'rounded-rect',
        fillColor: idx === 0 ? theme.accentColor : theme.cardBorder,
        borderColor: idx === 0 ? theme.accentColor : theme.cardBorder,
        borderWidth: 0,
        borderRadius: 5,
        x: curX + 2.5,
        y: curY + 2.5,
        width: 6,
        height: 4.5,
        content: ''
      })

      comps.push({
        id: `quad-num-${slideId}-${idx}`,
        type: 'text',
        content: `0${idx + 1}`,
        x: curX + 2.5,
        y: curY + 3,
        width: 6,
        fontSize: 11,
        fontWeight: 'bold',
        textAlign: 'center',
        fontFamily: 'mono',
        color: idx === 0 ? '#ffffff' : theme.textPrimary
      })

      // Tiêu đề ô
      const qTitleLen = (item.title || '').length
      const qTitleLines = Math.max(1, Math.ceil(qTitleLen / 18))
      const qTitleH = qTitleLines * 4.2
      const qTitleY = curY + 2.5

      comps.push({
        id: `quad-title-${slideId}-${idx}`,
        type: 'text',
        content: item.title,
        x: curX + 10,
        y: qTitleY,
        width: colWidth - 12,
        fontSize: qTitleLen > 22 ? 13.5 : 15,
        fontWeight: 'bold',
        textAlign: 'left',
        fontFamily: theme.headingFont,
        color: theme.textPrimary
      })

      // Mô tả ô
      if (item.description) {
        const qDesc = item.description
        const qDescY = Math.max(curY + 8, qTitleY + qTitleH + 1.5)
        const qDescFontSize = qDesc.length > 90 ? 11 : 12

        comps.push({
          id: `quad-desc-${slideId}-${idx}`,
          type: 'text',
          content: qDesc,
          x: curX + 2.5,
          y: qDescY,
          width: colWidth - 5,
          fontSize: qDescFontSize,
          textAlign: 'left',
          fontFamily: theme.bodyFont,
          color: theme.textSecondary
        })
      }
    })

    return comps
  }

  // D. DẠNG HORIZONTAL-ROWS (3 thanh thẻ dài xếp tầng ngang)
  if (layout === 'horizontal-rows' && items.length > 0) {
    const count = Math.min(3, items.length)
    const gapY = 2.5
    const rowH = (contentHeight - (count - 1) * gapY) / count

    items.slice(0, count).forEach((item, idx) => {
      const curY = startY + idx * (rowH + gapY)

      // Thanh hình nền bo góc ngang
      comps.push({
        id: `row-bg-${slideId}-${idx}`,
        type: 'shape',
        shapeType: 'rounded-rect',
        fillColor: theme.cardBackground,
        borderColor: theme.cardBorder,
        borderWidth: 1,
        borderRadius: 10,
        x: 8,
        y: curY,
        width: 84,
        height: rowH,
        content: ''
      })

      // Huy hiệu số thứ tự ở đầu
      comps.push({
        id: `row-badge-${slideId}-${idx}`,
        type: 'shape',
        shapeType: 'rounded-rect',
        fillColor: theme.accentColor,
        borderColor: theme.accentColor,
        borderWidth: 0,
        borderRadius: 6,
        x: 10,
        y: curY + Math.max(2, (rowH - 5) / 2),
        width: 6.5,
        height: 5,
        content: ''
      })

      comps.push({
        id: `row-num-${slideId}-${idx}`,
        type: 'text',
        content: `0${idx + 1}`,
        x: 10,
        y: curY + Math.max(2, (rowH - 5) / 2) + 0.5,
        width: 6.5,
        fontSize: 11,
        fontWeight: 'bold',
        textAlign: 'center',
        fontFamily: 'mono',
        color: '#ffffff'
      })

      // Tiêu đề thanh ngang
      const rTitleLen = (item.title || '').length
      const rTitleY = curY + (rowH > 14 ? 3 : 2)

      comps.push({
        id: `row-title-${slideId}-${idx}`,
        type: 'text',
        content: item.title,
        x: 17.5,
        y: rTitleY,
        width: 23,
        fontSize: rTitleLen > 24 ? 14 : 15.5,
        fontWeight: 'bold',
        textAlign: 'left',
        fontFamily: theme.headingFont,
        color: theme.textPrimary
      })

      // Mô tả thanh ngang (mở rộng width và font thích ứng chống tràn)
      if (item.description) {
        const rDesc = item.description
        const rDescLen = rDesc.length
        const rDescFontSize =
          rDescLen > 150
            ? 10.5
            : rDescLen > 110
              ? 11.5
              : rDescLen > 65
                ? 12.5
                : 13.5
        const rDescY = curY + (rowH > 14 ? 2.5 : 1.8)

        comps.push({
          id: `row-desc-${slideId}-${idx}`,
          type: 'text',
          content: rDesc,
          x: 42,
          y: rDescY,
          width: 48,
          fontSize: rDescFontSize,
          textAlign: 'left',
          fontFamily: theme.bodyFont,
          color: theme.textSecondary
        })
      }
    })

    return comps
  }

  // E. DẠNG TWO-COLUMN (Hai hộp chữ nhật bo góc đối xứng cân đối)
  if (layout === 'two-column' || (items.length === 2 && layout !== 'steps')) {
    const colWidth = 40
    const gap = 4

    items.slice(0, 2).forEach((item, idx) => {
      const colX = 8 + idx * (colWidth + gap)

      // Hình nền hộp chữ nhật bo góc
      comps.push({
        id: `col-bg-${slideId}-${idx}`,
        type: 'shape',
        shapeType: 'rounded-rect',
        fillColor: theme.cardBackground,
        borderColor: theme.cardBorder,
        borderWidth: 1,
        borderRadius: 14,
        x: colX,
        y: startY,
        width: colWidth,
        height: contentHeight,
        content: ''
      })

      // Tiêu đề cột
      const cTitleLen = (item.title || '').length
      const cTitleLines = Math.max(1, Math.ceil(cTitleLen / 26))
      const cTitleH = cTitleLines * 4.8
      const cTitleY = startY + 4

      comps.push({
        id: `col-title-${slideId}-${idx}`,
        type: 'text',
        content: item.title,
        x: colX + 3,
        y: cTitleY,
        width: colWidth - 6,
        fontSize: cTitleLen > 28 ? 16 : 18,
        fontWeight: 'bold',
        textAlign: 'left',
        fontFamily: theme.headingFont,
        color: theme.textPrimary
      })

      // Nội dung mô tả cột
      if (item.description) {
        const cDesc = item.description
        const cDescY = cTitleY + cTitleH + 2
        const cDescFontSize = cDesc.length > 150 ? 12 : 13.5

        comps.push({
          id: `col-desc-${slideId}-${idx}`,
          type: 'text',
          content: cDesc,
          x: colX + 3,
          y: cDescY,
          width: colWidth - 6,
          fontSize: cDescFontSize,
          textAlign: 'left',
          fontFamily: theme.bodyFont,
          color: theme.textSecondary
        })
      }
    })

    return comps
  }

  // F. DẠNG STEPS (Các hộp quy trình với huy hiệu bước)
  if (layout === 'steps' && items.length > 0) {
    const count = Math.min(3, items.length)
    const gap = 3
    const totalGap = gap * (count - 1)
    const totalWidth = 84
    const colWidth = (totalWidth - totalGap) / count

    items.slice(0, count).forEach((item, idx) => {
      const colX = 8 + idx * (colWidth + gap)

      // Hình nền hộp bước bo góc
      comps.push({
        id: `step-bg-${slideId}-${idx}`,
        type: 'shape',
        shapeType: 'rounded-rect',
        fillColor: theme.cardBackground,
        borderColor: theme.cardBorder,
        borderWidth: 1,
        borderRadius: 12,
        x: colX,
        y: startY,
        width: colWidth,
        height: contentHeight,
        content: ''
      })

      // Huy hiệu số bước
      comps.push({
        id: `step-badge-${slideId}-${idx}`,
        type: 'shape',
        shapeType: 'rounded-rect',
        fillColor: theme.accentColor,
        borderColor: theme.accentColor,
        borderWidth: 0,
        borderRadius: 6,
        x: colX + 3,
        y: startY + 3.5,
        width: 7,
        height: 5.5,
        content: ''
      })

      comps.push({
        id: `step-num-${slideId}-${idx}`,
        type: 'text',
        content: `0${idx + 1}`,
        x: colX + 3,
        y: startY + 4,
        width: 7,
        fontSize: 12,
        fontWeight: 'bold',
        textAlign: 'center',
        fontFamily: 'mono',
        color: '#ffffff'
      })

      // Tiêu đề bước
      const sTitleLen = (item.title || '').length
      const sTitleLines = Math.max(1, Math.ceil(sTitleLen / 20))
      const sTitleH = sTitleLines * 4.5
      const sTitleY = startY + 11

      comps.push({
        id: `step-title-${slideId}-${idx}`,
        type: 'text',
        content: item.title,
        x: colX + 3,
        y: sTitleY,
        width: colWidth - 6,
        fontSize: count === 3 ? 15.5 : 17.5,
        fontWeight: 'bold',
        textAlign: 'left',
        fontFamily: theme.headingFont,
        color: theme.textPrimary
      })

      // Mô tả bước
      if (item.description) {
        const sDesc = item.description
        const sDescY = sTitleY + sTitleH + 2
        const sDescFontSize = sDesc.length > 110 ? 11.5 : 12.5

        comps.push({
          id: `step-desc-${slideId}-${idx}`,
          type: 'text',
          content: sDesc,
          x: colX + 3,
          y: sDescY,
          width: colWidth - 6,
          fontSize: sDescFontSize,
          textAlign: 'left',
          fontFamily: theme.bodyFont,
          color: theme.textSecondary
        })
      }
    })

    return comps
  }

  // G. DẠNG CODE SNIPPET / MINH HỌA MÃ NGUỒN (Khung cửa sổ Code Terminal + Cột giải thích)
  const codeSnippet = (
    (slide.codeSnippet as string) ||
    (slide.code as string) ||
    (items.find((it) => it.code)?.code as string) ||
    ''
  ).trim()
  const isCodeLayout =
    layout === 'code' ||
    Boolean(codeSnippet) ||
    title.toLowerCase().includes('ví dụ code') ||
    title.toLowerCase().includes('cài đặt') ||
    (header && header.toLowerCase().includes('code'))

  if (isCodeLayout && (codeSnippet || items.length > 0)) {
    // Trích xuất code snippet nếu chưa có ở trường riêng biệt
    const finalCode =
      codeSnippet ||
      items.find(
        (it) =>
          it.title.toLowerCase().includes('code') ||
          it.description.includes(';') ||
          it.description.includes('#include')
      )?.description ||
      items[0]?.description ||
      '// Mã nguồn ví dụ C++\n#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hello C++!" << endl;\n    return 0;\n}'

    const codeWidth = 51
    const explainX = 62
    const explainWidth = 30

    // 1. Khung cửa sổ Code Window bo góc (Dark Terminal / IDE Window)
    comps.push({
      id: `code-window-bg-${slideId}`,
      type: 'shape',
      shapeType: 'rounded-rect',
      fillColor: '#0d1117',
      borderColor: '#30363d',
      borderWidth: 1,
      borderRadius: 12,
      x: 8,
      y: startY,
      width: codeWidth,
      height: contentHeight,
      content: ''
    })

    // Thanh Header của Code Window
    comps.push({
      id: `code-window-bar-${slideId}`,
      type: 'shape',
      shapeType: 'rounded-rect',
      fillColor: '#161b22',
      borderColor: '#30363d',
      borderWidth: 0,
      borderRadius: 6,
      x: 9,
      y: startY + 1.2,
      width: codeWidth - 2,
      height: 4.5,
      content: ''
    })

    // 3 nút chấm tròn macOS (Đỏ, Vàng, Xanh)
    const dotColors = ['#f87171', '#fbbf24', '#34d399']
    dotColors.forEach((dotColor, dotIdx) => {
      comps.push({
        id: `code-dot-${slideId}-${dotIdx}`,
        type: 'shape',
        shapeType: 'circle',
        fillColor: dotColor,
        borderColor: dotColor,
        borderWidth: 0,
        x: 10.5 + dotIdx * 1.8,
        y: startY + 2.5,
        width: 1.2,
        height: 1.8,
        content: ''
      })
    })

    // Tên file C++
    const codeLang = (
      (slide.codeLanguage as string) || 'example.cpp'
    ).toLowerCase()
    const fileName =
      codeLang.endsWith('.cpp') ||
      codeLang.endsWith('.c') ||
      codeLang.endsWith('.py') ||
      codeLang.endsWith('.js')
        ? codeLang
        : 'main.cpp'

    comps.push({
      id: `code-filename-${slideId}`,
      type: 'text',
      content: fileName,
      x: 17,
      y: startY + 2.2,
      width: 25,
      fontSize: 10,
      fontWeight: 'bold',
      textAlign: 'left',
      fontFamily: 'mono',
      color: '#8b949e'
    })

    // Khối văn bản chứa mã nguồn C++ thực tế (Monospace, màu sáng)
    comps.push({
      id: `code-content-${slideId}`,
      type: 'text',
      content: finalCode,
      x: 10.5,
      y: startY + 7.5,
      width: codeWidth - 4.5,
      height: contentHeight - 9,
      fontSize: 12.5,
      fontWeight: 'normal',
      fontStyle: 'normal',
      textAlign: 'left',
      fontFamily: 'mono',
      color: '#e2e8f0'
    })

    // 2. Cột phải: Các thẻ ghi chú / giải thích logic code
    const explainItems = items
      .filter((it) => it.description !== finalCode)
      .slice(0, 3)
    if (explainItems.length > 0) {
      const cardCount = explainItems.length
      const cardGap = 2
      const cardH = (contentHeight - (cardCount - 1) * cardGap) / cardCount

      explainItems.forEach((item, eIdx) => {
        const curY = startY + eIdx * (cardH + cardGap)

        comps.push({
          id: `code-exp-bg-${slideId}-${eIdx}`,
          type: 'shape',
          shapeType: 'rounded-rect',
          fillColor: theme.cardBackground,
          borderColor: theme.cardBorder,
          borderWidth: 1,
          borderRadius: 10,
          x: explainX,
          y: curY,
          width: explainWidth,
          height: cardH,
          content: ''
        })

        // Badge số thứ tự
        comps.push({
          id: `code-exp-badge-${slideId}-${eIdx}`,
          type: 'shape',
          shapeType: 'rounded-rect',
          fillColor: eIdx === 0 ? theme.accentColor : theme.cardBorder,
          borderColor: eIdx === 0 ? theme.accentColor : theme.cardBorder,
          borderWidth: 0,
          borderRadius: 4,
          x: explainX + 2,
          y: curY + 2,
          width: 5.5,
          height: 3.5,
          content: ''
        })

        comps.push({
          id: `code-exp-num-${slideId}-${eIdx}`,
          type: 'text',
          content: `0${eIdx + 1}`,
          x: explainX + 2,
          y: curY + 2.2,
          width: 5.5,
          fontSize: 9.5,
          fontWeight: 'bold',
          textAlign: 'center',
          fontFamily: 'mono',
          color: eIdx === 0 ? '#ffffff' : theme.textPrimary
        })

        // Tiêu đề giải thích
        comps.push({
          id: `code-exp-title-${slideId}-${eIdx}`,
          type: 'text',
          content: item.title,
          x: explainX + 9,
          y: curY + 1.8,
          width: explainWidth - 11,
          fontSize: 13,
          fontWeight: 'bold',
          textAlign: 'left',
          fontFamily: theme.headingFont,
          color: theme.textPrimary
        })

        // Nội dung giải thích
        if (item.description) {
          comps.push({
            id: `code-exp-desc-${slideId}-${eIdx}`,
            type: 'text',
            content: item.description,
            x: explainX + 2,
            y: curY + 6.5,
            width: explainWidth - 4,
            fontSize: 11.5,
            textAlign: 'left',
            fontFamily: theme.bodyFont,
            color: theme.textSecondary
          })
        }
      })
    } else {
      // Fallback nếu không có explainItems: hiển thị 1 hộp ghi chú tổng quát
      comps.push({
        id: `code-exp-bg-${slideId}-0`,
        type: 'shape',
        shapeType: 'rounded-rect',
        fillColor: theme.cardBackground,
        borderColor: theme.cardBorder,
        borderWidth: 1,
        borderRadius: 10,
        x: explainX,
        y: startY,
        width: explainWidth,
        height: contentHeight,
        content: ''
      })

      comps.push({
        id: `code-exp-title-${slideId}-0`,
        type: 'text',
        content: 'Điểm Cốt Lõi',
        x: explainX + 2.5,
        y: startY + 3,
        width: explainWidth - 5,
        fontSize: 15,
        fontWeight: 'bold',
        textAlign: 'left',
        fontFamily: theme.headingFont,
        color: theme.textPrimary
      })

      const bulletsList =
        Array.isArray(slide.bullets) && slide.bullets.length > 0
          ? (slide.bullets as string[]).join('\n')
          : 'Minh họa mã nguồn thực tế và thao tác thực thi trong chương trình.'

      comps.push({
        id: `code-exp-desc-${slideId}-0`,
        type: 'bullets',
        content: bulletsList,
        x: explainX + 2.5,
        y: startY + 10,
        width: explainWidth - 5,
        fontSize: 12.5,
        textAlign: 'left',
        fontFamily: theme.bodyFont,
        color: theme.textSecondary
      })
    }

    return comps
  }

  // H. DẠNG CARDS GRID (Mặc định: 2-3 thẻ hộp vuông/chữ nhật song song)
  if (items.length > 0) {
    const count = Math.min(3, items.length)
    const gap = 3
    const totalGap = gap * (count - 1)
    const totalWidth = 84
    const colWidth = (totalWidth - totalGap) / count

    items.slice(0, count).forEach((item, idx) => {
      const colX = 8 + idx * (colWidth + gap)

      // Hình nền thẻ vuông/chữ nhật bo góc
      comps.push({
        id: `card-bg-${slideId}-${idx}`,
        type: 'shape',
        shapeType: 'rounded-rect',
        fillColor: theme.cardBackground,
        borderColor: theme.cardBorder,
        borderWidth: 1,
        borderRadius: 12,
        x: colX,
        y: startY,
        width: colWidth,
        height: contentHeight,
        content: ''
      })

      // Tiêu đề thẻ
      const cardTitleLen = (item.title || '').length
      const cardTitleLines = Math.max(
        1,
        Math.ceil(cardTitleLen / (count === 3 ? 18 : 24))
      )
      const cardTitleH = cardTitleLines * 4.5
      const cardTitleY = startY + 4

      comps.push({
        id: `card-title-${slideId}-${idx}`,
        type: 'text',
        content: item.title,
        x: colX + 2.5,
        y: cardTitleY,
        width: colWidth - 5,
        fontSize: count === 3 ? (cardTitleLen > 24 ? 14.5 : 16) : 18,
        fontWeight: 'bold',
        textAlign: 'left',
        fontFamily: theme.headingFont,
        color: theme.textPrimary
      })

      // Nội dung mô tả thẻ
      if (item.description) {
        const cardDesc = item.description
        const cardDescY = cardTitleY + cardTitleH + 2
        const cardDescFontSize =
          cardDesc.length > 140 ? 11.5 : cardDesc.length > 80 ? 12.5 : 13.5

        comps.push({
          id: `card-desc-${slideId}-${idx}`,
          type: 'text',
          content: cardDesc,
          x: colX + 2.5,
          y: cardDescY,
          width: colWidth - 5,
          fontSize: cardDescFontSize,
          textAlign: 'left',
          fontFamily: theme.bodyFont,
          color: theme.textSecondary
        })
      }
    })

    return comps
  }

  // H. FALLBACK NẾU KHÔNG CÓ ITEMS
  const bulletsContent = Array.isArray(slide.bullets)
    ? (slide.bullets as string[]).join('\n')
    : ''
  if (bulletsContent.trim()) {
    comps.push({
      id: `bullets-${slideId}`,
      type: 'bullets',
      content: bulletsContent,
      x: 8,
      y: startY,
      width: 84,
      fontSize: 18,
      textAlign: 'left',
      fontFamily: theme.bodyFont,
      color: theme.textPrimary
    })
  }

  return comps
}
