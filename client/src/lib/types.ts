export type Role = 'user' | 'admin'
export type UserStatus = 'active' | 'locked'

export interface User {
  id: string
  name: string
  email: string
  role: Role
  status?: UserStatus
  creditBalance: number
  avatar?: string | null
}

export interface AdminUser {
  _id: string
  name: string
  email: string
  role: Role
  status?: UserStatus
  lockedAt?: string | null
  scheduledDeleteAt?: string | null
  creditBalance: number
  createdAt: string
}

export interface OutlineSection {
  heading: string
  bullets: string[]
}

export interface Outline {
  title: string
  sections: OutlineSection[]
}

export type ShapeType =
  | 'rectangle'
  | 'circle'
  | 'square'
  | 'rounded-rect'
  | 'triangle'
  | 'star'
  | 'line'

export interface SlideComponent {
  id: string
  type: 'title' | 'subtitle' | 'bullets' | 'text' | 'quote' | 'image' | 'shape'
  content: string
  imageUrl?: string
  shapeType?: ShapeType
  fillColor?: string
  borderColor?: string
  borderWidth?: number
  borderRadius?: number
  x: number // % từ mép trái (0 - 100)
  y: number // % từ mép trên (0 - 100)
  width?: number // % chiều rộng
  height?: number // % chiều cao
  rotation?: number // Góc xoay theo độ (degrees 0 - 360)
  fontSize?: number // px
  fontWeight?: 'normal' | 'bold'
  fontStyle?: 'normal' | 'italic'
  textDecoration?: 'none' | 'underline'
  textCase?: 'normal' | 'uppercase'
  textAlign?: 'left' | 'center' | 'right'
  color?: string
  fontFamily?:
    | 'sans'
    | 'display'
    | 'playfair'
    | 'montserrat'
    | 'jakarta'
    | 'merriweather'
    | 'handwriting'
    | 'mono'
    | string
}

export type ContentLayoutType =
  | 'cards'
  | 'two-column'
  | 'steps'
  | 'split-highlight'
  | 'metrics-grid'
  | 'quad-grid'
  | 'horizontal-rows'
  | 'headline'
  | 'standard'
  | 'code'

export interface SlideContentItem {
  title: string
  description: string
  tag?: string
  icon?: string
  stat?: string
  code?: string
}

export interface Slide {
  id: string
  title: string
  subtitle?: string
  header?: string
  footer?: string
  contentLayout?: ContentLayoutType
  contentItems?: SlideContentItem[]
  bullets: string[]
  layout?: ContentLayoutType
  codeSnippet?: string
  codeLanguage?: string
  titleAlign?: 'left' | 'center' | 'right'
  titleSize?: 'sm' | 'md' | 'lg' | 'xl'
  bulletStyle?: 'disc' | 'decimal' | 'dash' | 'none'
  components?: SlideComponent[]
  speakerNotes?: string
  theme?: string
  backgroundColor?: string
  [key: string]: unknown
}

export interface Lecture {
  _id: string
  userId: string
  folderId: string | null
  title: string
  prompt: string
  theme?: string
  outline?: Outline | null
  slides: Slide[]
  contextSummary?: string
  sourceMaterial?: string
  aiChatHistory?: Array<Record<string, unknown>>
  deletedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface Folder {
  _id: string
  userId: string
  name: string
  createdAt: string
  updatedAt: string
}

export interface AiUsageLog {
  _id: string
  userId:
    | string
    | {
        _id: string
        name?: string
        email?: string
      }
  prompt: string
  slideCount: number
  creditSpent: number
  createdAt: string
}

export interface CreditConfig {
  _id: string
  pricePerSlide: number
  pricePerAiEdit: number
  signupBonus: number
}

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  limit: number
}

interface ApiSuccess<T> {
  success: true
  data: T
}

interface ApiError {
  success: false
  message: string
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError
