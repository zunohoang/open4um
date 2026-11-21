import {
  buildSlideComponents,
  getThemeById,
  withSlideColors
} from '@/constants/theme-options'

// SRS UC008 bước 5: AI Chat đổi màu slide qua các trường ghi đè
describe('withSlideColors / buildSlideComponents', () => {
  const theme = getThemeById('classic-editorial')

  it('giữ nguyên màu theme khi slide không ghi đè', () => {
    expect(withSlideColors(theme, {})).toEqual(theme)
  })

  it('áp dụng màu HEX hợp lệ và bỏ qua giá trị không hợp lệ', () => {
    const result = withSlideColors(theme, {
      backgroundColor: '#000000',
      accentColor: 'red; drop table',
      textColor: '#ffeedd'
    })
    expect(result.background).toBe('#000000')
    expect(result.accentColor).toBe(theme.accentColor)
    expect(result.textPrimary).toBe('#ffeedd')
  })

  it('component tiêu đề dùng màu chữ ghi đè của slide', () => {
    const comps = buildSlideComponents(
      { id: 's1', title: 'Tiêu đề', bullets: ['A'], textColor: '#123456' },
      'classic-editorial'
    )
    const title = comps.find((c) => c.type === 'title')
    expect(title?.color).toBe('#123456')
  })
})
