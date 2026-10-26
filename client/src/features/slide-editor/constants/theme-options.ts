export interface FontOption {
  key: string
  name: string
  fontFamily: string
  category: 'sans' | 'serif' | 'display' | 'handwriting' | 'mono'
}

export const FONT_OPTIONS: FontOption[] = [
  {
    key: 'sans',
    name: 'Be Vietnam Pro',
    fontFamily: '"Be Vietnam Pro", ui-sans-serif, system-ui, sans-serif',
    category: 'sans'
  },
  {
    key: 'inter',
    name: 'Inter (Hiện đại)',
    fontFamily: '"Inter", sans-serif',
    category: 'sans'
  },
  {
    key: 'roboto',
    name: 'Roboto (Tiêu chuẩn)',
    fontFamily: '"Roboto", sans-serif',
    category: 'sans'
  },
  {
    key: 'jakarta',
    name: 'Plus Jakarta Sans',
    fontFamily: '"Plus Jakarta Sans", sans-serif',
    category: 'sans'
  },
  {
    key: 'montserrat',
    name: 'Montserrat (Mạnh mẽ)',
    fontFamily: '"Montserrat", sans-serif',
    category: 'sans'
  },
  {
    key: 'display',
    name: 'Lora Serif (Báo chí)',
    fontFamily: '"Lora", Georgia, serif',
    category: 'serif'
  },
  {
    key: 'playfair',
    name: 'Playfair Display',
    fontFamily: '"Playfair Display", Georgia, serif',
    category: 'display'
  },
  {
    key: 'merriweather',
    name: 'Merriweather',
    fontFamily: '"Merriweather", serif',
    category: 'serif'
  },
  {
    key: 'cinzel',
    name: 'Cinzel (Cổ điển quyền lực)',
    fontFamily: '"Cinzel", serif',
    category: 'serif'
  },
  {
    key: 'oswald',
    name: 'Oswald (Tiêu đề in hoa)',
    fontFamily: '"Oswald", sans-serif',
    category: 'display'
  },
  {
    key: 'comfortaa',
    name: 'Comfortaa (Tròn sáng tạo)',
    fontFamily: '"Comfortaa", cursive',
    category: 'display'
  },
  {
    key: 'handwriting',
    name: 'Caveat (Bút lông)',
    fontFamily: '"Caveat", cursive',
    category: 'handwriting'
  },
  {
    key: 'dancingscript',
    name: 'Dancing Script (Nghệ thuật)',
    fontFamily: '"Dancing Script", cursive',
    category: 'handwriting'
  },
  {
    key: 'mono',
    name: 'JetBrains Mono',
    fontFamily: '"JetBrains Mono", monospace',
    category: 'mono'
  }
]

export const FONT_MAP: Record<string, string> = Object.fromEntries(
  FONT_OPTIONS.map((f) => [f.key, f.fontFamily])
)

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

export interface ColorGroup {
  name: string
  colors: Array<{ name: string; value: string }>
}

export const COLOR_PALETTES: ColorGroup[] = [
  {
    name: 'Màu thương hiệu',
    colors: [
      { name: 'Mực đậm (Brand Ink)', value: '#173c39' },
      { name: 'Cam đất (Brand Rust)', value: '#c45b3f' },
      { name: 'Giấy ngà (Brand Paper)', value: '#f5f1e8' },
      { name: 'Xanh lục bảo sâu', value: '#064e3b' },
      { name: 'Hổ phách ấm', value: '#d97706' }
    ]
  },
  {
    name: 'Cơ bản & Trung tính',
    colors: [
      { name: 'Đen tuyền', value: '#000000' },
      { name: 'Đen than', value: '#1f2937' },
      { name: 'Xám đá', value: '#4b5563' },
      { name: 'Xám khói', value: '#9ca3af' },
      { name: 'Xám nhạt', value: '#e5e7eb' },
      { name: 'Trắng', value: '#ffffff' }
    ]
  },
  {
    name: 'Màu sắc nổi bật',
    colors: [
      { name: 'Đỏ tươi', value: '#ef4444' },
      { name: 'Đỏ rượu', value: '#dc2626' },
      { name: 'Cam rực', value: '#f97316' },
      { name: 'Vàng nắng', value: '#eab308' },
      { name: 'Xanh lá tươi', value: '#10b981' },
      { name: 'Xanh ngọc', value: '#14b8a6' },
      { name: 'Xanh lơ', value: '#06b6d4' },
      { name: 'Xanh dương', value: '#3b82f6' },
      { name: 'Xanh chàm', value: '#6366f1' },
      { name: 'Tím mộng mơ', value: '#8b5cf6' },
      { name: 'Hồng sen', value: '#ec4899' },
      { name: 'Hồng đỏ', value: '#f43f5e' }
    ]
  },
  {
    name: 'Màu Pastel dịu nhẹ',
    colors: [
      { name: 'Hồng phấn pastel', value: '#fee2e2' },
      { name: 'Cam đào pastel', value: '#ffedd5' },
      { name: 'Vàng kem pastel', value: '#fef3c7' },
      { name: 'Bạc hà pastel', value: '#dcfce7' },
      { name: 'Xanh hồ pastel', value: '#e0f2fe' },
      { name: 'Lam nhạt pastel', value: '#e0e7ff' },
      { name: 'Tím oải hương', value: '#f3e8ff' },
      { name: 'Giấy cổ điển', value: '#fafaf9' }
    ]
  }
]
