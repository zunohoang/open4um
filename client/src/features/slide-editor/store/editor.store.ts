import type { Slide } from '@/lib/types'
import { create } from 'zustand'

export type LeftRailTab = 'text' | 'shapes' | 'uploads' | 'templates' | null

export interface UploadedImage {
  id: string
  url: string
  name: string
  size: number
  createdAt: string
}

export interface AiChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  timestamp: string
}

interface EditorStoreState {
  // Navigation & Selection
  activeSlideIndex: number
  selectedCompId: string | null
  leftRailTab: LeftRailTab
  isDrawerOpen: boolean
  isFilmstripOpen: boolean
  isAiPanelOpen: boolean

  // Undo / Redo Stacks (Snapshots of Slide[])
  undoStack: Slide[][]
  redoStack: Slide[][]

  // Uploaded Media Gallery
  uploadedImages: UploadedImage[]

  // AI Chat History
  aiMessages: AiChatMessage[]

  // Actions
  setActiveSlideIndex: (index: number) => void
  setSelectedCompId: (id: string | null) => void
  setLeftRailTab: (tab: LeftRailTab) => void
  setIsDrawerOpen: (open: boolean) => void
  toggleDrawer: () => void
  toggleFilmstrip: () => void
  toggleAiPanel: () => void

  // Undo / Redo Actions
  recordHistory: (slides: Slide[]) => void
  undo: (currentSlides: Slide[]) => Slide[] | null
  redo: (currentSlides: Slide[]) => Slide[] | null
  clearHistory: () => void

  // Upload Actions
  addUploadedImage: (
    img: Omit<UploadedImage, 'id' | 'createdAt'>
  ) => UploadedImage
  removeUploadedImage: (id: string) => void

  // AI Actions
  addAiMessage: (role: 'user' | 'assistant', text: string) => void
  clearAiMessages: () => void
}

const STORAGE_KEY_UPLOADS = 'open4um_user_uploaded_images'

const loadInitialUploads = (): UploadedImage[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_UPLOADS)
    if (!raw) return []
    return JSON.parse(raw) as UploadedImage[]
  } catch {
    return []
  }
}

const saveUploadsToStorage = (images: UploadedImage[]) => {
  try {
    localStorage.setItem(STORAGE_KEY_UPLOADS, JSON.stringify(images))
  } catch {
    // Quota exceeded or private mode
  }
}

export const useEditorStore = create<EditorStoreState>((set, get) => ({
  activeSlideIndex: 0,
  selectedCompId: null,
  leftRailTab: 'text',
  isDrawerOpen: true,
  isFilmstripOpen: true,
  isAiPanelOpen: true,

  undoStack: [],
  redoStack: [],

  uploadedImages: loadInitialUploads(),
  aiMessages: [
    {
      id: 'welcome-msg',
      role: 'assistant',
      text: 'Xin chào! Tôi là trợ lý slide AI. Bạn có thể chọn các gợi ý nhanh hoặc nhập chỉ dẫn để tôi hoàn thiện nội dung slide.',
      timestamp: new Date().toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit'
      })
    }
  ],

  setActiveSlideIndex: (index: number) => {
    set({ activeSlideIndex: Math.max(0, index), selectedCompId: null })
  },

  setSelectedCompId: (id: string | null) => {
    set({ selectedCompId: id })
  },

  setLeftRailTab: (tab: LeftRailTab) => {
    const current = get().leftRailTab
    const isCurrentlyOpen = get().isDrawerOpen

    if (current === tab && isCurrentlyOpen) {
      // Đang chọn đúng tab và đang mở -> đóng drawer
      set({ isDrawerOpen: false })
    } else {
      set({ leftRailTab: tab, isDrawerOpen: true })
    }
  },

  setIsDrawerOpen: (open: boolean) => set({ isDrawerOpen: open }),
  toggleDrawer: () => set((state) => ({ isDrawerOpen: !state.isDrawerOpen })),
  toggleFilmstrip: () =>
    set((state) => ({ isFilmstripOpen: !state.isFilmstripOpen })),
  toggleAiPanel: () =>
    set((state) => ({ isAiPanelOpen: !state.isAiPanelOpen })),

  recordHistory: (slides: Slide[]) => {
    // Deep clone slides snapshot
    const snapshot = JSON.parse(JSON.stringify(slides)) as Slide[]
    set((state) => ({
      undoStack: [...state.undoStack.slice(-25), snapshot],
      redoStack: []
    }))
  },

  undo: (currentSlides: Slide[]) => {
    const { undoStack, redoStack } = get()
    if (undoStack.length === 0) return null

    const previous = undoStack[undoStack.length - 1]
    const nextUndoStack = undoStack.slice(0, undoStack.length - 1)
    const currentSnapshot = JSON.parse(JSON.stringify(currentSlides)) as Slide[]

    set({
      undoStack: nextUndoStack,
      redoStack: [...redoStack, currentSnapshot],
      selectedCompId: null
    })

    return previous
  },

  redo: (currentSlides: Slide[]) => {
    const { undoStack, redoStack } = get()
    if (redoStack.length === 0) return null

    const next = redoStack[redoStack.length - 1]
    const nextRedoStack = redoStack.slice(0, redoStack.length - 1)
    const currentSnapshot = JSON.parse(JSON.stringify(currentSlides)) as Slide[]

    set({
      undoStack: [...undoStack, currentSnapshot],
      redoStack: nextRedoStack,
      selectedCompId: null
    })

    return next
  },

  clearHistory: () => set({ undoStack: [], redoStack: [] }),

  addUploadedImage: (img) => {
    const newImg: UploadedImage = {
      ...img,
      id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: new Date().toISOString()
    }
    const nextList = [newImg, ...get().uploadedImages]
    set({ uploadedImages: nextList })
    saveUploadsToStorage(nextList)
    return newImg
  },

  removeUploadedImage: (id: string) => {
    const nextList = get().uploadedImages.filter((item) => item.id !== id)
    set({ uploadedImages: nextList })
    saveUploadsToStorage(nextList)
  },

  addAiMessage: (role, text) => {
    const msg: AiChatMessage = {
      id: `msg-${Date.now()}`,
      role,
      text,
      timestamp: new Date().toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit'
      })
    }
    set((state) => ({ aiMessages: [...state.aiMessages, msg] }))
  },

  clearAiMessages: () => set({ aiMessages: [] })
}))
