import { describe, it, expect } from 'vitest'
import { defineAggregateRoot } from '../src/aggregate.js'
import type { GetAggregateInstance, IEvent } from '../src/types.js'
import {
  aggregateData,
  loadAggregate,
  popRecordedEvents,
} from '../src/aggregateData.js'

const createAggregateDefinition = () => {
  const MyAggregate = defineAggregateRoot({
    name: 'My aggregate',
    events: {
      NumbersAdded(event: IEvent<{ a: number; b: number }>) {
        const { a, b } = event.payload
        this.state.total += a + b
      },
    },
    actions: {
      'Add number'(a: number, b: number) {
        const { total } = this.state()
        if (total > a + b) {
          throw new Error('a in state is greater than a + b in args')
        }
        this.recordThat('NumbersAdded', {
          a,
          b,
        })
      },
    },
    initialState: () => ({
      total: 1,
    }),
  })

  return {
    MyAggregate,
  }
}

describe('Defining aggregate root', () => {
  describe('Aggregate creation', () => {
    it('Create aggregate instance with provided id', () => {
      const MyAggregate = defineAggregateRoot({
        name: 'MyAggregate',
        initialState: () => {},
      })

      using my = MyAggregate.create('agg-1')

      expect(my.id()).toBe('agg-1')
    })
  })

  describe('Aggregate operations', () => {
    it('exposes defined operation', () => {
      const { MyAggregate } = createAggregateDefinition()

      using my = MyAggregate.create('agg-1')
      expect(my['Add number']).toBeInstanceOf(Function)
    })

    it('records event in operation', () => {
      const { MyAggregate } = createAggregateDefinition()
      using my = MyAggregate.create('agg-2')
      my['Add number'](1, 2)

      expect(popRecordedEvents(my)).toStrictEqual([
        expect.objectContaining({
          payload: {
            a: 1,
            b: 2,
          },
        }),
      ])
    })

    it('does not record events when no are defined', () => {
      const OtherAggregate = defineAggregateRoot({
        name: 'Other aggregate',
        initialState: () => {},
        actions: {
          op1() {
            // @ts-expect-error testing non existing event
            this.recordThat('MyEvent', {})
          },
        },
      })

      using instance = OtherAggregate.create('other-1')
      instance.op1()

      expect(popRecordedEvents(instance)).toStrictEqual([])
    })

    it('does not get recorded events in operation on a cloned instance', () => {
      const { MyAggregate } = createAggregateDefinition()
      using my = MyAggregate.create('agg-2')
      my['Add number'](1, 2)

      expect(() => {
        popRecordedEvents({
          ...my,
        })
      }).toThrow(/disposed/)
    })

    it('aggregate data is gc with the instance', () => {
      const { MyAggregate } = createAggregateDefinition()
      let x: GetAggregateInstance<typeof MyAggregate>

      {
        using instance = MyAggregate.create('agg-3')
        x = instance
      }

      expect(() => {
        x['Add number'](1, 2)
      }).toThrow(/disposed/)
    })

    // @TODO: needs implementing cloning state
    //   it('does not modify the state in actions', () => {
    //     const Agg = defineAggregateRoot({
    //       name: 'Agg',
    //       initialState: () => ({
    //         test: 1,
    //       }),
    //       events: {
    //         EvilHasHappened(_event: IEvent<{ x: number }>) {
    //           expect(this.state.test).toBe(1)
    //         },
    //       },
    //       actions: {
    //         evilAction(x: number) {
    //           // @ts-expect-error evil test
    //           this.state().test += x
    //           this.recordThat('EvilHasHappened', {
    //             x,
    //           })
    //         },
    //       },
    //     })

    //     using agg = Agg.create('aaaa')
    //     agg.evilAction(666)
    //   })
  })

  describe('Loading aggregate', () => {
    it('aggregate data is gc with the instance loaded by loadAggregate function', () => {
      const { MyAggregate } = createAggregateDefinition()
      let x: GetAggregateInstance<typeof MyAggregate>

      {
        using instance = loadAggregate<typeof MyAggregate>(
          MyAggregate.name(),
          'agg-1',
          [
            {
              version: 1,
              name: 'NumbersAdded',
              occuredAt: Date.now(),
              payload: {
                a: 1,
                b: 2,
              },
            },
          ],
        )
        x = instance
      }

      expect(() => {
        x['Add number'](1, 2)
      }).toThrow(/disposed/)
    })

    it('aggregate data is gc with the instance loaded by loadAggregate function', () => {
      const { MyAggregate } = createAggregateDefinition()

      using instance = loadAggregate<typeof MyAggregate>(
        MyAggregate.name(),
        'agg-1',
        [
          {
            version: 1,
            name: 'NumbersAdded',
            occuredAt: Date.now() - 10,
            payload: {
              a: 1,
              b: 2,
            },
          },
          {
            version: 2,
            name: 'NumbersAdded',
            occuredAt: Date.now(),
            payload: {
              a: 1,
              b: 1,
            },
          },
        ],
      )

      // initial total = 1
      // version 1: total = 1 + (1 + 2) = 4
      // version 2: total = 4 + (1 + 1) = 6
      const state = aggregateData(instance).state

      expect(state.total).toBe(6)
    })
  })
})
