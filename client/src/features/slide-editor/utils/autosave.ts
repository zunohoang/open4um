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

export const hasSameSavedContent = (left: Lecture, right: Lecture) =>
  SAVED_FIELDS.every((field) => Object.is(left[field], right[field]))

export const buildAutosavePayload = (lecture: Lecture, previous?: Lecture) => {
  const payload: AutosavePayload = {}
  for (const field of SAVED_FIELDS) {
    if (!previous || !Object.is(lecture[field], previous[field])) {
      Object.assign(payload, { [field]: lecture[field] })
    }
  }
  return payload
}

export const createSerialAutosaver = <T extends { revision: number }>(
  persist: (lecture: Lecture, previous?: Lecture) => Promise<T>
) => {
  let previous: Lecture | undefined
  let tail: Promise<unknown> = Promise.resolve()

  return {
    reset(lecture?: Lecture) {
      previous = lecture
    },
    save(lecture: Lecture): Promise<T> {
      const task = tail.then(async () => {
        const receipt = await persist(
          lecture,
          previous?._id === lecture._id ? previous : undefined
        )
        previous = { ...lecture, revision: receipt.revision }
        return receipt
      })
      tail = task.catch(() => undefined)
      return task
    }
  }
}
