import { Link } from 'react-router-dom'
import logoHorizontal from '@/assets/abslider-logo-horizontal.svg'
import logoHorizontalLight from '@/assets/abslider-logo-horizontal-light.svg'
import markDark from '@/assets/abslider-mark.svg'
import markLight from '@/assets/abslider-mark-light.svg'

export interface BrandLogoProps {
  /**
   * Phiên bản logo:
   * - 'horizontal': Logo đầy đủ biểu tượng + tên thương hiệu (chiều rộng tối thiểu khuyến nghị 140px)
   * - 'mark': Chỉ biểu tượng độc lập (dành cho kích thước nhỏ < 140px, favicon, collapsed header/sidebar)
   */
  variant?: 'horizontal' | 'mark'

  /**
   * Giao diện hiển thị:
   * - 'light': Dùng trên nền sáng (màu Ink Green & Terracotta)
   * - 'dark': Dùng trên nền tối (màu Warm Paper & Terracotta)
   */
  theme?: 'light' | 'dark'

  /**
   * Chiều cao hiển thị (pixel hoặc css string).
   * Mặc định: 36px cho horizontal, 32px cho mark
   */
  height?: number | string

  /**
   * Chiều rộng hiển thị (tùy chọn)
   */
  width?: number | string

  /**
   * ClassName bổ sung cho thẻ img hoặc bọc Link
   */
  className?: string

  /**
   * Nếu true, bọc logo trong thẻ React Router Link
   */
  asLink?: boolean

  /**
   * Đường dẫn khi bọc Link (mặc định: '/')
   */
  to?: string

  /**
   * Tiêu đề / văn bản trợ năng
   */
  alt?: string
}

export const BrandLogo = ({
  variant = 'horizontal',
  theme = 'light',
  height,
  width,
  className = '',
  asLink = false,
  to = '/',
  alt = 'ABSlider'
}: BrandLogoProps) => {
  // Chọn asset tương ứng theo variant và theme
  const src =
    variant === 'mark'
      ? theme === 'dark'
        ? markLight
        : markDark
      : theme === 'dark'
        ? logoHorizontalLight
        : logoHorizontal

  const defaultHeight = variant === 'horizontal' ? 36 : 32
  const computedHeight = height ?? defaultHeight

  const imageElement = (
    <img
      src={src}
      alt={alt}
      height={computedHeight}
      width={width}
      style={{
        height:
          typeof computedHeight === 'number'
            ? `${computedHeight}px`
            : computedHeight,
        width: width
          ? typeof width === 'number'
            ? `${width}px`
            : width
          : 'auto'
      }}
      className={`select-none object-contain transition-opacity duration-200 ${className}`}
      draggable={false}
    />
  )

  if (asLink) {
    return (
      <Link
        to={to}
        className='inline-flex items-center transition-opacity hover:opacity-85 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-rust'
        aria-label={alt}
      >
        {imageElement}
      </Link>
    )
  }

  return imageElement
}
