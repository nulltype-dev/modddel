type Release = () => void

type QueueItem = {
  resolve(): void
}

export class Mutex {
  #queue: Record<string, QueueItem[]> = {}
  #locks = new Set<string>()

  aqquire(name: string) {
    let release: Release

    return {
      promise: new Promise<void>((resolve) => {
        release = () => {
          this.#locks.delete(name)
          const next = this.#queue[name]?.shift()
          if (!next) {
            return
          }

          next.resolve()
        }

        if (this.#locks.has(name)) {
          if (!this.#queue[name]) {
            this.#queue[name] = []
          }

          this.#queue[name].push({
            resolve: () => {
              this.#locks.add(name)
              resolve()
            },
          })
        } else {
          this.#locks.add(name)
          resolve()
        }
      }),
      [Symbol.dispose]() {
        release()
      },
    }
  }
}
