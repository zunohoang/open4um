type SlideAction = 'addSlide' | 'duplicateSlide' | 'deleteSlide' | 'moveSlide'

export function shouldFail(action: SlideAction) {
  if (import.meta.env.VITE_RELEASE_ENVIRONMENT !== 'develop') return false
  try {
    const key = 'abslider.qaFaults'
    const switches = JSON.parse(localStorage.getItem(key) ?? '{}')
    if (switches[action] === 'always') return true
    if (switches[action] !== 'once') return false
    delete switches[action]
    localStorage.setItem(key, JSON.stringify(switches))
    return true
  } catch {
    return false
  }
}
