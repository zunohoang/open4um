import type { Slide } from '@/lib/types'
import { create } from 'zustand'

export type LeftRailTab =
  'text' | 'shapes' | 'uploads' | 'templates' | 'theme' | null

export interface UploadedImage {
  id: string
  url: string
  name: string
  size: number
  createdAt: string
}

export interface AiSlideProposalItem {
  id: string
  action: 'CREATE_SLIDE' | 'UPDATE_SLIDE'
  targetSlideIndex: number
  proposedSlide: Slide
  summary?: string
  status?: 'pending' | 'accepted' | 'rejected'
}

export interface AiChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  timestamp: string
  action?:
    | 'UPDATE_CURRENT_SLIDE'
    | 'UPDATE_SLIDE'
    | 'CREATE_SLIDE'
    | 'BATCH_CHANGES'
    | 'CHAT_ONLY'
  targetSlideIndex?: number
  proposedSlide?: Slide
  proposals?: AiSlideProposalItem[]
  status?: 'pending' | 'accepted' | 'rejected'
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

  // AI Chat & Context State
  aiMessages: AiChatMessage[]
  previewSlide: Slide | null
  previewSlideAction: 'CREATE_SLIDE' | 'UPDATE_SLIDE' | null
  sourceMaterial: string
  isSourceMaterialModalOpen: boolean

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
  addAiMessage: (
    roleOrMsg: 'user' | 'assistant' | Omit<AiChatMessage, 'id' | 'timestamp'>,
    text?: string
  ) => string
  setAiMessages: (messages: AiChatMessage[]) => void
  updateAiMessageStatus: (id: string, status: 'accepted' | 'rejected') => void
  clearAiMessages: () => void
  setPreviewSlide: (
    slide: Slide | null,
    action?: 'CREATE_SLIDE' | 'UPDATE_SLIDE' | null
  ) => void
  setSourceMaterial: (material: string) => void
  setIsSourceMaterialModalOpen: (open: boolean) => void
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
      text: 'Xin chào! Tôi là trợ lý slide AI nhận biết ngữ cảnh. Bạn có thể trò chuyện, xin gợi ý hoặc yêu cầu tôi chỉnh sửa/tạo slide trực tiếp.',
      timestamp: new Date().toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit'
      })
    }
  ],
  previewSlide: null,
  previewSlideAction: null,
  sourceMaterial: '',
  isSourceMaterialModalOpen: false,

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
    set((state) => {
      const lastSnapshot = state.undoStack[state.undoStack.length - 1]
      // Tránh lưu snapshot trùng lặp nếu nội dung hoàn toàn không thay đổi
      if (
        lastSnapshot &&
        JSON.stringify(lastSnapshot) === JSON.stringify(snapshot)
      ) {
        return state
      }
      return {
        undoStack: [...state.undoStack.slice(-30), snapshot],
        redoStack: []
      }
    })
  },

  undo: (currentSlides: Slide[]) => {
    const { undoStack, redoStack, selectedCompId, activeSlideIndex } = get()
    if (undoStack.length === 0) return null

    const previous = undoStack[undoStack.length - 1]
    const nextUndoStack = undoStack.slice(0, undoStack.length - 1)
    const currentSnapshot = JSON.parse(JSON.stringify(currentSlides)) as Slide[]

    // Kiểm tra xem selectedCompId có còn tồn tại trong slide sau khi hoàn tác không
    const targetSlide = previous[activeSlideIndex]
    const compStillExists =
      targetSlide &&
      selectedCompId &&
      targetSlide.components?.some((c) => c.id === selectedCompId)

    set({
      undoStack: nextUndoStack,
      redoStack: [...redoStack, currentSnapshot],
      selectedCompId: compStillExists ? selectedCompId : null
    })

    return previous
  },

  redo: (currentSlides: Slide[]) => {
    const { undoStack, redoStack, selectedCompId, activeSlideIndex } = get()
    if (redoStack.length === 0) return null

    const next = redoStack[redoStack.length - 1]
    const nextRedoStack = redoStack.slice(0, redoStack.length - 1)
    const currentSnapshot = JSON.parse(JSON.stringify(currentSlides)) as Slide[]

    const targetSlide = next[activeSlideIndex]
    const compStillExists =
      targetSlide &&
      selectedCompId &&
      targetSlide.components?.some((c) => c.id === selectedCompId)

    set({
      undoStack: [...undoStack, currentSnapshot],
      redoStack: nextRedoStack,
      selectedCompId: compStillExists ? selectedCompId : null
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

  addAiMessage: (roleOrMsg, text) => {
    const isObject = typeof roleOrMsg === 'object'
    const id = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const timestamp = new Date().toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit'
    })
    const msg: AiChatMessage = isObject
      ? { ...roleOrMsg, id, timestamp }
      : {
          id,
          role: roleOrMsg,
          text: text || '',
          timestamp
        }
    set((state) => ({ aiMessages: [...state.aiMessages, msg] }))
    return id
  },

  setAiMessages: (messages: AiChatMessage[]) => set({ aiMessages: messages }),

  updateAiMessageStatus: (id: string, status: 'accepted' | 'rejected') => {
    set((state) => ({
      aiMessages: state.aiMessages.map((m) =>
        m.id === id ? { ...m, status } : m
      )
    }))
  },

  clearAiMessages: () => set({ aiMessages: [] }),
  setPreviewSlide: (
    slide: Slide | null,
    action?: 'CREATE_SLIDE' | 'UPDATE_SLIDE' | null
  ) =>
    set({
      previewSlide: slide,
      previewSlideAction: action ?? (slide ? 'UPDATE_SLIDE' : null)
    }),
  setSourceMaterial: (sourceMaterial: string) => set({ sourceMaterial }),
  setIsSourceMaterialModalOpen: (open: boolean) =>
    set({ isSourceMaterialModalOpen: open })
}))
