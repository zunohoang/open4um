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
    key: 'display',
    name: 'Lora Serif',
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
    key: 'montserrat',
    name: 'Montserrat',
    fontFamily: '"Montserrat", sans-serif',
    category: 'sans'
  },
  {
    key: 'jakarta',
    name: 'Plus Jakarta Sans',
    fontFamily: '"Plus Jakarta Sans", sans-serif',
    category: 'sans'
  },
  {
    key: 'merriweather',
    name: 'Merriweather',
    fontFamily: '"Merriweather", serif',
    category: 'serif'
  },
  {
    key: 'handwriting',
    name: 'Caveat (Viết tay)',
    fontFamily: '"Caveat", cursive',
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
