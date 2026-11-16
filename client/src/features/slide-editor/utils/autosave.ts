import type { Lecture } from '@/lib/types'

const SAVED_FIELDS = [
  'title',
  'slides',
  'theme',
  'contextSummary',
  'sourceMaterial',
  'aiChatHistory'
] as const

export type AutosavePayload = Partial<
  Pick<Lecture, (typeof SAVED_FIELDS)[number]>
>

export const buildAutosavePayload = (lecture: Lecture, previous?: Lecture) => {
  const payload: AutosavePayload = {}
  for (const field of SAVED_FIELDS) {
    if (!previous || !Object.is(lecture[field], previous[field])) {
      Object.assign(payload, { [field]: lecture[field] })
    }
  }
  return payload
}

export const createSerialAutosaver = <T>(
  persist: (lecture: Lecture, previous?: Lecture) => Promise<T>
) => {
  let previous: Lecture | undefined
  let tail: Promise<unknown> = Promise.resolve()

  return {
    save(lecture: Lecture): Promise<T> {
      const task = tail.then(async () => {
        const receipt = await persist(
          lecture,
          previous?._id === lecture._id ? previous : undefined
        )
        previous = lecture
        return receipt
      })
      tail = task.catch(() => undefined)
      return task
    }
  }
}
