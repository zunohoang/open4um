export const createFrameScheduler = <T>(
  apply: (value: T) => void,
  requestFrame: (
    callback: FrameRequestCallback
  ) => number = requestAnimationFrame,
  cancelFrame: (id: number) => void = cancelAnimationFrame
) => {
  let frame: number | null = null
  let pending: { value: T } | null = null

  const flush = () => {
    if (frame !== null) cancelFrame(frame)
    frame = null
    const next = pending
    pending = null
    if (next) apply(next.value)
  }

  return {
    schedule(value: T) {
      pending = { value }
      if (frame === null) frame = requestFrame(flush)
    },
    flush,
    cancel() {
      if (frame !== null) cancelFrame(frame)
      frame = null
      pending = null
    }
  }
}
