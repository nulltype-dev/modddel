import { describe, expect, it } from 'vitest'
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
          .withHistory('agg2-1', [
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
          .withHistory(
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

  describe('assert', () => {
    it('throws custom error when assertion is not met with error', () => {
      expect(
        assert(
          Promise.resolve({
            message: 'Some inner message',
            result: false,
            error: new Error('whatever'),
          }),
          'Something went wrong',
        ),
      ).rejects.toThrow('Something went wrong')
    })

    it('creates error object when assertion did not provided', async () => {
      try {
        await assert(
          Promise.resolve({
            message: 'Some inner message',
            result: false,
          }),
          'Something went wrong',
        )
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
      }
    })

    it('prepends message to original error', async () => {
      try {
        await assert(
          Promise.resolve({
            message: 'Some inner message',
            result: false,
            error: new Error('whatever'),
          }),
        )
      } catch (error) {
        expect((error as Error).message).toBe('Some inner message\n\nwhatever')
      }
    })

    it('uses message as created error object message', async () => {
      try {
        await assert(
          Promise.resolve({
            message: 'Some inner message',
            result: false,
          }),
        )
      } catch (error) {
        expect((error as Error).message).toBe('Some inner message')
      }
    })
  })

  describe('Execution API', () => {
    describe('toThrow', () => {
      it('creates error object with thrown cause if it is not an Error object', async () => {
        const Agg = defineAggregateRoot({
          name: 'agg-1',
          initialState: () => ({}),
        })

        await GivenAggregate(Agg)
          .withNewInstance('1')
          .expect(() => {
            throw 'some cause'
          })
          .toThrow((error) => {
            expect(error.cause).toBe('some cause')
            return true
          })
      })

      it('fails assertion when execution did not throw when expecting', async () => {
        const Agg = defineAggregateRoot({
          name: 'agg-1',
          initialState: () => ({}),
        })

        const assertion = await GivenAggregate(Agg)
          .withNewInstance('1')
          .expect(() => {})
          .toThrow('some other cause')

        expect(assertion.message).toMatch(
          /did not throw error "some other cause"/i,
        )
      })

      it('uses cause when no message is present in error', async () => {
        const Agg = defineAggregateRoot({
          name: 'agg-1',
          initialState: () => ({}),
        })

        const assertion = await GivenAggregate(Agg)
          .withNewInstance('1')
          .expect(() => {
            throw new Error(undefined, {
              cause: 'what happened?',
            })
          })
          .toThrow('some other cause')

        expect(assertion.message).toMatch(
          /did not throw error "some other cause"/i,
        )
      })
    })

    describe('toRecordedEvents', () => {
      it('handles error thrown in execution while testing recorded events', async () => {
        const Agg = defineAggregateRoot({
          name: 'agg-1',
          initialState: () => ({}),
        })

        expect(
          assert(
            GivenAggregate(Agg)
              .withNewInstance('id:1')
              .expect(() => {
                throw new Error('something bad happened')
              })
              .toRecordEvents([]),
          ),
        ).rejects.toThrow(/Error occured during execution/i)
      })

      it('allows to test recorded events by custom function', async () => {
        const Agg = defineAggregateRoot({
          name: 'agg-1',
          initialState: () => ({}),
        })

        expect(
          assert(
            GivenAggregate(Agg)
              .withNewInstance('id:1')
              .expect(() => {})
              .toRecordEvents((events) => {
                return events.length > 2
              }),
          ),
        ).rejects.toThrow(/Invalid recorded events/i)
      })

      it('throws error when event count does not match', () => {
        const Agg = defineAggregateRoot({
          name: 'agg-1',
          initialState: () => ({}),
          events: {
            OneEvent(_event: IEvent<void>) {},
          },
        })

        expect(
          assert(
            GivenAggregate(Agg)
              .withNewInstance('id:1')
              .expect(() => {})
              .toRecordEvents(['OneEvent']),
          ),
        ).rejects.toThrow(/Expected different amount of events/i)
      })

      it('throws error when event count does not match', () => {
        const Agg = defineAggregateRoot({
          name: 'agg-1',
          initialState: () => ({}),
          events: {
            OneEvent(_event: IEvent<void>) {},
            AnotherEvent(_event: IEvent<void>) {},
          },
          actions: {
            oneAction() {
              this.recordThat('OneEvent', undefined)
            },
          },
        })

        expect(
          assert(
            GivenAggregate(Agg)
              .withNewInstance('id:1')
              .expect((instance) => {
                instance.oneAction()
              })
              .toRecordEvents(['AnotherEvent']),
          ),
        ).rejects.toThrow(/Expected event number 1 to be "AnotherEvent"/i)
      })
    })
  })
})
