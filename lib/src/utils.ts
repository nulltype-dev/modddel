type EventLike = {
  version: number
}

const byVersion = (a: EventLike, b: EventLike) => a.version - b.version

export const EventSorter = {
  byVersion,
}

export const areEventsContinous = (sortedEvents: EventLike[]) => {
  if (sortedEvents.length < 2) {
    return true
  }

  const versions = sortedEvents.map((e) => e.version)

  for (let i = 1; i < versions.length; i += 1) {
    if (versions[i - 1] != versions[i] - 1) {
      return false
    }
  }

  return true
}
