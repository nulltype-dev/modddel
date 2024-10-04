import { describe, it } from 'vitest'
import { defineAggregateRoot } from '../src/aggregate.js'
import { assert, GivenAggregate } from '../src/test-utils.js'
import type { IEvent } from '../src/types.js'

describe('Test utils', () => {
  describe('Loading aggregate', () => {
    it('loads aggregate instance with initial state', async () => {
      const Agg = defineAggregateRoot({
        name: 'agg1',
        initialState: () => ({
          test: 3,
        }),
        actions: {
          throwOnThree() {
            const { test } = this.state()

            if (test === 3) {
              throw new Error('Test is 3')
            }
          },
        },
      })

      await assert(
        GivenAggregate(Agg)
          .withNewInstance('agg-1')
          .expect((instance) => {
            instance.throwOnThree()
          })
          .toThrow(/test is 3/i),
      )
    })

    it('loads aggregate instance with simplified event history', async () => {
      type Evt = IEvent<number>

      const Agg = defineAggregateRoot({
        name: 'agg2',
        initialState: (): {
          test: (number | string)[]
        } => ({
          test: [],
        }),
        events: {
          Evt1(event: Evt) {
            this.state.test.push(event.payload)
          },
          Evt2(event: Evt) {
            this.state.test.push(event.payload)
          },
          Evt3(event: Evt) {
            this.state.test.push(event.payload)
          },
          EvtStr(event: IEvent<string>) {
            this.state.test.push(event.payload)
          },
        },
        actions: {
          invalidAction() {
            throw new Error(
              `current state contains: [${this.state().test.join(', ')}]`,
            )
          },
        },
      })

      await assert(
        GivenAggregate(Agg)
          .withInstanceHistory('agg2-1', [
            ['Evt1', 1],
            ['Evt2', 2],
            ['Evt3', 3],
            ['EvtStr', 'a'],
            ['Evt1', 5],
          ])
          .expect((instance) => {
            instance.invalidAction()
          })
          .toThrow('current state contains: [1, 2, 3, a, 5]'),
      )
    })

    it('loads aggregate instance with simplified event history and provided snapshot', async () => {
      type Evt = IEvent<number>

      const Agg = defineAggregateRoot({
        name: 'agg2',
        initialState: (): {
          test: number[]
        } => ({
          test: [],
        }),
        events: {
          Evt1(event: Evt) {
            this.state.test.push(event.payload)
          },
          Evt2(event: Evt) {
            this.state.test.push(event.payload)
          },
          Evt3(event: Evt) {
            this.state.test.push(event.payload)
          },
          Evt4(event: Evt) {
            this.state.test.push(event.payload)
          },
        },
        actions: {
          invalidAction() {
            throw new Error(
              `current state contains: [${this.state().test.join(', ')}]`,
            )
          },
        },
      })

      await assert(
        GivenAggregate(Agg)
          .withInstanceHistory(
            'agg2-1',
            [
              ['Evt1', 1],
              ['Evt2', 2],
              ['Evt3', 3],
              ['Evt4', 4],
              ['Evt1', 5],
            ],
            {
              version: 5,
              state: {
                test: [-2, -1, 0],
              },
            },
          )
          .expect((instance) => {
            instance.invalidAction()
          })
          .toThrow((error) => /-2, -1, 0, 1, 2, 3, 4, 5/.test(error.message)),
        'Does not count from -2 to 5.',
      )
    })

    it('asserts that something has happened', async () => {
      type Evt = IEvent<number>
      const Agg = defineAggregateRoot({
        name: 'agg2',
        initialState: (): {
          test: number[]
        } => ({
          test: [],
        }),
        events: {
          HappenedSomething(event: Evt) {
            this.state.test.push(event.payload)
          },
          HappenedSomethingElse(event: Evt) {
            this.state.test.push(event.payload)
          },
        },
        actions: {
          happenSomething() {
            this.recordThat('HappenedSomething', 1)
          },
        },
      })

      await assert(
        GivenAggregate(Agg)
          .withNewInstance('agg2-3')
          .expect(async (instance) => {
            instance.happenSomething()
          })
          .toRecordEvents(['HappenedSomething']),
      )
    })
  })
})
