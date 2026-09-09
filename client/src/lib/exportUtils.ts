import { toPng } from 'html-to-image'
import { jsPDF } from 'jspdf'
import type { Lecture, Slide } from '@/lib/types'

/**
 * Tạo DOM element chuẩn tỷ lệ 16:9 (1280x720) cho một slide để xuất hình ảnh / PDF
 */
const createSlideElement = (
  slide: Slide,
  defaultPattern: string,
  index: number,
  total: number
): HTMLElement => {
  const el = document.createElement('div')
  const pattern = slide.pattern || defaultPattern || 'default'

  el.style.width = '1280px'
  el.style.height = '720px'
  el.style.position = 'relative'
  el.style.overflow = 'hidden'
  el.style.boxSizing = 'border-box'
  el.style.padding = '48px 64px'
  el.style.display = 'flex'
  el.style.flexDirection = 'column'
  el.style.justifyContent = 'space-between'

  // Màu sắc theo tông màu mẫu (slidePattern)
  if (pattern === 'warm') {
    el.style.backgroundColor = '#fff7ed' // orange-50
    el.style.color = '#431407' // orange-950
    el.style.borderTop = '12px solid #7c2d12' // orange-900
  } else if (pattern === 'mono') {
    el.style.backgroundColor = '#1c1917' // stone-900
    el.style.color = '#f5f5f4' // stone-100
    el.style.borderTop = '12px solid #e7e5e4' // stone-200
  } else {
    el.style.backgroundColor = '#ffffff'
    el.style.color = '#064e3b' // emerald-950
    el.style.borderTop = '12px solid #c2410c' // orange-700
  }

  // Số thứ tự slide ở góc dưới phải
  const numberTag = document.createElement('div')
  numberTag.style.position = 'absolute'
  numberTag.style.right = '48px'
  numberTag.style.bottom = '28px'
  numberTag.style.fontFamily = "'JetBrains Mono', monospace, sans-serif"
  numberTag.style.fontSize = '14px'
  numberTag.style.fontWeight = 'bold'
  numberTag.style.opacity = '0.5'
  numberTag.innerText = `${index + 1} / ${total}`
  el.appendChild(numberTag)

  // Nếu slide có components kéo thả Canvas
  if (slide.components && slide.components.length > 0) {
    const canvasArea = document.createElement('div')
    canvasArea.style.position = 'relative'
    canvasArea.style.width = '100%'
    canvasArea.style.height = '100%'

    for (const comp of slide.components) {
      const compEl = document.createElement('div')
      compEl.style.position = 'absolute'
      compEl.style.left = `${comp.x}%`
      compEl.style.top = `${comp.y}%`
      compEl.style.width = comp.width ? `${comp.width}%` : 'auto'
      compEl.style.maxWidth = '95%'
      compEl.style.fontSize = `${Math.round((comp.fontSize ?? 20) * 1.35)}px`
      compEl.style.fontWeight = comp.fontWeight ?? 'normal'
      compEl.style.fontStyle = comp.fontStyle ?? 'normal'
      compEl.style.textDecoration = comp.textDecoration ?? 'none'
      compEl.style.textAlign = comp.textAlign ?? 'left'
      compEl.style.color =
        comp.color || (pattern === 'mono' ? '#f5f5f4' : '#064e3b')
      compEl.style.lineHeight = '1.35'
      compEl.style.whiteSpace = 'pre-wrap'
      compEl.style.wordBreak = 'break-word'

      if (comp.fontFamily === 'display') {
        compEl.style.fontFamily = "'Lora', serif"
      } else if (comp.fontFamily === 'mono') {
        compEl.style.fontFamily = "'JetBrains Mono', monospace"
      } else {
        compEl.style.fontFamily = "'Inter', sans-serif"
      }

      if (comp.type === 'bullets') {
        const ul = document.createElement('ul')
        ul.style.listStyleType = 'disc'
        ul.style.paddingLeft = '28px'
        ul.style.margin = '0'
        const lines = comp.content.split('\n').filter((l) => l.trim())
        for (const line of lines) {
          const li = document.createElement('li')
          li.style.marginBottom = '8px'
          li.innerText = line.replace(/^[•\-*]\s*/, '')
          ul.appendChild(li)
        }
        compEl.appendChild(ul)
      } else if (comp.type === 'quote') {
        compEl.style.borderLeft = '4px solid #c2410c'
        compEl.style.paddingLeft = '16px'
        compEl.style.fontStyle = 'italic'
        compEl.innerText = comp.content
      } else {
        compEl.innerText = comp.content
      }

      canvasArea.appendChild(compEl)
    }

    el.appendChild(canvasArea)
  } else {
    // Bố cục slide truyền thống (Tiêu đề, Phụ đề, Danh sách ý)
    const contentBox = document.createElement('div')
    contentBox.style.width = '100%'

    if (slide.title) {
      const h1 = document.createElement('h1')
      h1.style.fontFamily = "'Lora', serif"
      h1.style.fontSize = '44px'
      h1.style.fontWeight = '600'
      h1.style.margin = '0 0 16px 0'
      h1.innerText = slide.title
      contentBox.appendChild(h1)
    }

    if (slide.subtitle) {
      const h2 = document.createElement('p')
      h2.style.fontFamily = "'Inter', sans-serif"
      h2.style.fontSize = '22px'
      h2.style.margin = '0 0 24px 0'
      h2.style.opacity = '0.8'
      h2.innerText = slide.subtitle
      contentBox.appendChild(h2)
    }

    if (slide.bullets && slide.bullets.length > 0) {
      const ul = document.createElement('ul')
      ul.style.listStyleType = 'disc'
      ul.style.paddingLeft = '32px'
      ul.style.fontFamily = "'Inter', sans-serif"
      ul.style.fontSize = '24px'
      ul.style.lineHeight = '1.6'
      for (const bullet of slide.bullets) {
        const li = document.createElement('li')
        li.style.marginBottom = '12px'
        li.innerText = bullet
        ul.appendChild(li)
      }
      contentBox.appendChild(ul)
    }

    el.appendChild(contentBox)
  }

  return el
}

/**
 * Xuất trực tiếp một phần tử DOM thành file ảnh PNG và tự động tải về máy
 */
export const exportElementToPng = async (
  element: HTMLElement,
  filename: string
): Promise<void> => {
  const dataUrl = await toPng(element, {
    pixelRatio: 2,
    cacheBust: true
  })

  const link = document.createElement('a')
  link.download = `${filename}.png`
  link.href = dataUrl
  link.click()
}

/**
 * Xuất đơn một slide bất kỳ thành file ảnh PNG
 */
export const exportSlideToPng = async (
  slide: Slide,
  lecturePattern: string,
  slideIndex: number,
  totalSlides: number,
  filename: string
): Promise<void> => {
  const container = document.createElement('div')
  container.style.position = 'fixed'
  container.style.left = '-99999px'
  container.style.top = '0'
  container.style.width = '1280px'
  container.style.height = '720px'
  container.style.zIndex = '-1000'
  container.style.overflow = 'hidden'
  document.body.appendChild(container)

  try {
    if (document.fonts) {
      await document.fonts.ready
    }

    const slideEl = createSlideElement(
      slide,
      lecturePattern,
      slideIndex,
      totalSlides
    )
    container.appendChild(slideEl)
    await new Promise((resolve) => setTimeout(resolve, 60))

    const dataUrl = await toPng(slideEl, {
      pixelRatio: 2,
      cacheBust: true
    })

    const link = document.createElement('a')
    link.download = `${filename}.png`
    link.href = dataUrl
    link.click()
  } finally {
    if (document.body.contains(container)) {
      document.body.removeChild(container)
    }
  }
}

/**
 * Xuất toàn bộ bài giảng thành file PDF đa trang (mỗi slide là 1 trang 16:9)
 */
export const exportLectureToPdf = async (
  lecture: Lecture,
  onProgress?: (current: number, total: number) => void
): Promise<void> => {
  const total = lecture.slides.length
  if (total === 0) throw new Error('Bài giảng chưa có slide nào để xuất PDF')

  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'px',
    format: [1280, 720]
  })

  const container = document.createElement('div')
  container.style.position = 'fixed'
  container.style.left = '-99999px'
  container.style.top = '0'
  container.style.width = '1280px'
  container.style.height = '720px'
  container.style.zIndex = '-1000'
  container.style.overflow = 'hidden'
  document.body.appendChild(container)

  try {
    if (document.fonts) {
      await document.fonts.ready
    }

    for (let i = 0; i < total; i++) {
      if (onProgress) {
        onProgress(i + 1, total)
      }

      const slide = lecture.slides[i]
      container.innerHTML = ''
      const slideEl = createSlideElement(slide, lecture.pattern, i, total)
      container.appendChild(slideEl)

      // Chờ DOM cập nhật
      await new Promise((resolve) => setTimeout(resolve, 70))

      const dataUrl = await toPng(slideEl, {
        pixelRatio: 1.5,
        cacheBust: true
      })

      if (i > 0) {
        pdf.addPage([1280, 720], 'landscape')
      }
      pdf.addImage(dataUrl, 'PNG', 0, 0, 1280, 720, undefined, 'FAST')
    }

    const safeTitle = (lecture.title || 'bai-giang')
      .replace(/[/\\?%*:|"<>]/g, '-')
      .trim()
    pdf.save(`${safeTitle}.pdf`)
  } finally {
    if (document.body.contains(container)) {
      document.body.removeChild(container)
    }
  }
}
