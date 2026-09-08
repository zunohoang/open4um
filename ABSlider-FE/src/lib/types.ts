export type Role = 'user' | 'admin'
export type UserStatus = 'active' | 'locked'

export interface User {
  id: string
  name: string
  email: string
  role: Role
  status?: UserStatus
  creditBalance: number
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

export interface SlideComponent {
  id: string
  type: 'title' | 'subtitle' | 'bullets' | 'text' | 'quote'
  content: string
  x: number // % từ mép trái (0 - 100)
  y: number // % từ mép trên (0 - 100)
  width?: number // % chiều rộng
  fontSize?: number // px
  fontWeight?: 'normal' | 'bold'
  fontStyle?: 'normal' | 'italic'
  textDecoration?: 'none' | 'underline'
  textAlign?: 'left' | 'center' | 'right'
  color?: string
  fontFamily?: 'display' | 'sans' | 'mono'
}

export interface Slide {
  id: string
  pattern: string
  title: string
  bullets: string[]
  subtitle?: string
  layout?: 'standard' | 'two-column' | 'quote' | 'headline'
  titleAlign?: 'left' | 'center' | 'right'
  titleSize?: 'sm' | 'md' | 'lg' | 'xl'
  bulletStyle?: 'disc' | 'decimal' | 'dash' | 'none'
  components?: SlideComponent[]
  speakerNotes?: string
  [key: string]: unknown
}

export interface Lecture {
  _id: string
  userId: string
  folderId: string | null
  title: string
  prompt: string
  pattern: string
  slides: Slide[]
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
