import type { Slide, SlideComponent } from '@/lib/types'

/**
 * Lấy danh sách components của slide. Nếu slide chưa có mảng components tùy biến,
 * tự động chuyển đổi title, subtitle và bullets thành các SlideComponent tiêu chuẩn.
 */
export const getSlideComponents = (slide: Slide): SlideComponent[] => {
  if (Array.isArray(slide.components)) {
    return slide.components
  }

  const comps: SlideComponent[] = []

  comps.push({
    id: `title-${slide.id}`,
    type: 'title',
    content: slide.title || 'Tiêu đề slide',
    x: 8,
    y: 12,
    width: 84,
    fontSize:
      slide.titleSize === 'xl' ? 48 : slide.titleSize === 'sm' ? 26 : 36,
    fontWeight: 'bold',
    fontStyle: 'normal',
    textDecoration: 'none',
    textAlign: slide.titleAlign || 'left',
    fontFamily: 'display',
    color: '#1c1917'
  })

  if (slide.subtitle) {
    comps.push({
      id: `sub-${slide.id}`,
      type: 'subtitle',
      content: slide.subtitle,
      x: 8,
      y: 26,
      width: 84,
      fontSize: 18,
      fontWeight: 'normal',
      fontStyle: 'italic',
      textDecoration: 'none',
      textAlign: slide.titleAlign || 'left',
      fontFamily: 'sans',
      color: '#64748b'
    })
  }

  if (slide.bullets && slide.bullets.length > 0) {
    comps.push({
      id: `bullets-${slide.id}`,
      type: 'bullets',
      content: slide.bullets.join('\n'),
      x: 8,
      y: slide.subtitle ? 38 : 28,
      width: 84,
      fontSize: 20,
      fontWeight: 'normal',
      fontStyle: 'normal',
      textDecoration: 'none',
      textAlign: 'left',
      fontFamily: 'sans',
      color: '#1c1917'
    })
  }

  return comps
}
