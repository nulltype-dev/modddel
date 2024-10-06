import { beforeEach, describe, expect, it } from 'vitest'
import { Mutex } from '../src/Mutex.js'

describe('Mutex', () => {
  let mutex: Mutex

  beforeEach(() => {
    mutex = new Mutex()
  })

  it('runs function one by one', async () => {
    let counter = 1
    const run = async () => {
      using lock = mutex.aqquire('test1')
      await lock.promise
      const currentCounter = counter
      await Promise.resolve()

      counter = currentCounter + 1
    }

    await Promise.all([run(), run(), run(), run(), run()])

    expect(counter).toBe(6)
  })
})
