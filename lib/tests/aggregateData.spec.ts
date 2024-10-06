import { describe, expect, it, vi } from 'vitest'
import {
  aggregateData,
  createInstanceData,
  loadAggregate,
  popRecordedEvents,
  recordEvent,
  registerAggregate,
} from '../src/aggregateData.js'
import type {
  AggregateEventsByDefinition,
  AggregateInstance,
  GetAggregateEvents,
  IAggregateEvent,
  IEvent,
} from '../src/types.js'
import { defineAggregateRoot } from '../src/aggregate.js'

const createFakeInstance = (id: string) =>
  ({
    id: () => id,
    aggregateName: () => 'fake-agg',
    [Symbol.dispose]() {},
  }) satisfies AggregateInstance

describe('Aggregate data internal functions', () => {
  describe('loadAggregate', () => {
    it('throws error when aggregate is not defined while loading', () => {
      expect(() => {
        loadAggregate('The aggregate', 'agg-1')
      }).toThrow(/not defined/)
    })

    it('throws error when trying to load aggregate with no event handlers defined', () => {
      const Agg = defineAggregateRoot({
        name: 'agg',
        initialState: () => {},
      })

      expect(() => {
        loadAggregate(Agg.name(), 'id-1', [
          {
            version: 1,
            name: 'fake-event',
            occuredAt: Date.now(),
            payload: {},
          },
        ])
      }).toThrow(/cannot load aggregate.* none are defined/i)
    })

    it('throws error when trying to load aggregate with missing event handler definition', () => {
      const Agg = defineAggregateRoot({
        name: 'agg',
        initialState: () => ({
          fake: true,
        }),
        events: {
          'not-a-fake'() {
            this.state.fake = false
          },
        },
      })

      expect(() => {
        loadAggregate(Agg.name(), 'id-1', [
          {
            version: 1,
            name: 'fake-event',
            occuredAt: Date.now(),
            payload: {},
          },
        ])
      }).toThrow(/not defined for aggregate/i)
    })

    it('loads instance with given events and sets version to event one', () => {
      const Agg = defineAggregateRoot({
        name: 'agg',
        initialState: () => ({
          fake: true,
        }),
        events: {
          'not-a-fake'() {
            this.state.fake = false
          },
        },
      })

      using instance = loadAggregate(Agg.name(), 'id-1', [
        {
          version: 1,
          name: 'not-a-fake',
          occuredAt: Date.now(),
          payload: undefined,
        },
      ])

      const data = aggregateData(instance)
      expect(data.version).toBe(1)
      expect(data.state).toStrictEqual({
        fake: false,
      })
    })

    it('loads instance from snapshot', () => {
      const Agg = defineAggregateRoot({
        name: 'agg',
        initialState: () => ({
          fake: true,
          someNumber: 1,
        }),
        events: {
          'not-a-fake'() {
            this.state.fake = false
          },
        },
      })

      using instance = loadAggregate<typeof Agg>(Agg.name(), 'id-1', [], {
        version: 7,
        state: {
          fake: false,
          someNumber: 424,
        },
      })

      const data = aggregateData(instance)
      const { someNumber } = data.state
      const { version } = data
      expect(someNumber).toBe(424)
      expect(version).toBe(7)
    })

    it('ignores events with lower or equal version while loading with snapshot', () => {
      const Agg = defineAggregateRoot({
        name: 'agg',
        initialState: () => ({
          fake: true,
          someNumber: 1,
        }),
        events: {
          'not-a-fake'() {
            this.state.fake = false
          },
          num(event: IEvent<number>) {
            this.state.someNumber += event.payload
          },
        },
      })

      using instance = loadAggregate<typeof Agg>(
        Agg.name(),
        'id-1',
        [
          {
            name: 'not-a-fake',
            occuredAt: Date.now() - 200,
            version: 1,
            payload: {},
          },
          ...Array(10)
            .fill(null)
            .map(
              (_, i) =>
                ({
                  name: 'num',
                  occuredAt: Date.now() - (10 - i) * 10,
                  version: 2 + i,
                  payload: 1,
                }) satisfies IAggregateEvent<
                  GetAggregateEvents<typeof Agg>,
                  'num'
                >,
            ),
        ],
        {
          version: 7,
          state: {
            fake: false,
            someNumber: 424,
          },
        },
      )
      const data = aggregateData(instance)
      const { someNumber } = data.state
      const { version } = data
      expect(someNumber).toBe(428)
      expect(version).toBe(11)
    })

    it('ignores events with lower or equal version while loading with snapshot event if this will result in no new events', () => {
      const Agg = defineAggregateRoot({
        name: 'agg',
        initialState: () => ({
          fake: true,
          someNumber: 1,
        }),
        events: {
          'not-a-fake'() {
            this.state.fake = false
          },
          num(event: IEvent<number>) {
            this.state.someNumber += event.payload
          },
        },
      })

      using instance = loadAggregate<typeof Agg>(
        Agg.name(),
        'id-1',
        [
          {
            name: 'not-a-fake',
            occuredAt: Date.now() - 200,
            version: 1,
            payload: {},
          },
          ...Array(2)
            .fill(null)
            .map(
              (_, i) =>
                ({
                  name: 'num',
                  occuredAt: Date.now() - (10 - i) * 10,
                  version: 2 + i,
                  payload: 1,
                }) satisfies IAggregateEvent<
                  GetAggregateEvents<typeof Agg>,
                  'num'
                >,
            ),
        ],
        {
          version: 7,
          state: {
            fake: false,
            someNumber: 424,
          },
        },
      )
      const data = aggregateData(instance)
      const { someNumber } = data.state
      const { version } = data
      expect(someNumber).toBe(424)
      expect(version).toBe(7)
    })

    it('throws error when provided events are not continous', () => {
      const Agg = defineAggregateRoot({
        name: 'agg',
        initialState: () => ({
          fake: true,
          someNumber: 1,
        }),
        events: {
          'not-a-fake'() {
            this.state.fake = false
          },
          num(event: IEvent<number>) {
            this.state.someNumber += event.payload
          },
        },
      })

      const now = Date.now()
      const events: AggregateEventsByDefinition<typeof Agg>[] = [
        {
          name: 'not-a-fake',
          occuredAt: now - 100,
          version: 1,
          payload: undefined,
        },
        {
          name: 'num',
          occuredAt: now - 90,
          version: 2,
          payload: 2,
        },
        {
          name: 'not-a-fake',
          occuredAt: now - 80,
          version: 4,
          payload: 4,
        },
      ]

      expect(() => {
        loadAggregate<typeof Agg>(Agg.name(), 'agg-1', events)
      }).toThrowError(/loaded events are not continous/i)
    })

    it('throws error when provided events are not starting from 1 (without snapshot)', () => {
      const Agg = defineAggregateRoot({
        name: 'agg',
        initialState: () => ({
          fake: true,
          someNumber: 1,
        }),
        events: {
          'not-a-fake'() {
            this.state.fake = false
          },
          num(event: IEvent<number>) {
            this.state.someNumber += event.payload
          },
        },
      })

      const now = Date.now()
      const events: AggregateEventsByDefinition<typeof Agg>[] = [
        {
          name: 'not-a-fake',
          occuredAt: now - 100,
          version: 2,
          payload: undefined,
        },
        {
          name: 'num',
          occuredAt: now - 90,
          version: 3,
          payload: 2,
        },
        {
          name: 'not-a-fake',
          occuredAt: now - 80,
          version: 4,
          payload: 4,
        },
      ]

      expect(() => {
        loadAggregate<typeof Agg>(Agg.name(), 'agg-1', events)
      }).toThrowError(/loaded events doesn't start right after snapshot/i)
    })
  })

  it('throws error when provided events are not starting from n + 1 where n is snapshot version', () => {
    const Agg = defineAggregateRoot({
      name: 'agg',
      initialState: () => ({
        fake: true,
        someNumber: 1,
      }),
      events: {
        'not-a-fake'() {
          this.state.fake = false
        },
        num(event: IEvent<number>) {
          this.state.someNumber += event.payload
        },
      },
    })

    const now = Date.now()
    const events: AggregateEventsByDefinition<typeof Agg>[] = [
      {
        name: 'not-a-fake',
        occuredAt: now - 100,
        version: 9,
        payload: undefined,
      },
      {
        name: 'num',
        occuredAt: now - 90,
        version: 10,
        payload: 2,
      },
      {
        name: 'not-a-fake',
        occuredAt: now - 80,
        version: 11,
        payload: 4,
      },
    ]

    expect(() => {
      loadAggregate<typeof Agg>(Agg.name(), 'agg-1', events, {
        version: 7,
        state: {
          fake: false,
          someNumber: 424,
        },
      })
    }).toThrowError(/loaded events doesn't start right after snapshot/i)
  })

  describe('registerAggregate', () => {
    it('registers aggregate defnition', () => {
      const homeMadeDefinition = {
        name: () => 'home made definition',
        create(_id: string) {
          let instance: AggregateInstance | null = {
            id: () => 'fake',
            aggregateName: () => 'fake-agg',
            [Symbol.dispose]() {
              instance = null
            },
          }
          createInstanceData(instance, {})
          return instance
        },
      }

      const options = {
        initialState: () => ({}),
        name: 'home made definition',
      }

      registerAggregate(homeMadeDefinition, options)

      using instance = loadAggregate('home made definition', 'whatever')
      expect(instance.id()).toBe('fake')
    })
  })

  describe('createInstanceData/aggregateData', () => {
    it('initializes instance data with version 0', () => {
      using instance = createFakeInstance('id-1')
      createInstanceData(instance, {})

      const data = aggregateData(instance)
      expect(data.version).toBe(0)
    })

    it('initializes instance data with empty recorded events', () => {
      using instance = createFakeInstance('id-1')
      createInstanceData(instance, {})

      const data = aggregateData(instance)
      expect(data.recordedEvents).toStrictEqual([])
    })

    it('initializes instance data with given state', () => {
      using instance = createFakeInstance('id-1')
      createInstanceData(instance, {
        a: 20,
      })

      const data = aggregateData(instance)
      expect(data.state).toStrictEqual({
        a: 20,
      })
    })

    it('throws an error when getting data on not created instance', () => {
      using instance = createFakeInstance('id-1')

      expect(() => {
        aggregateData(instance)
      }).toThrow(/disposed/)
    })
  })

  describe('recordingEvents', () => {
    describe('throwing errors', () => {
      it('throws error on recording event for instance with no data instance created', () => {
        using instance = createFakeInstance('id-666')
        expect(() => {
          recordEvent<
            {},
            {},
            {
              'some event': {
                x: number
              }
            },
            'some event'
          >(instance, {
            name: 'some event',
            payload: {
              x: 7,
            },
          })
        }).toThrow(/does not exist/)
      })

      it('throws an error when trying to pop events from instance not created with data', () => {
        using instance = createFakeInstance('id-666')

        expect(() => {
          popRecordedEvents(instance)
        }).toThrowError(/does not exist/)
      })
    })

    describe('processing recorded events', () => {
      const createValidInstance = (id: string) => {
        const instance = createFakeInstance(id) as AggregateInstance<
          {},
          {},
          {
            'some event': {
              x: number
            }
          }
        >
        createInstanceData(instance, {})

        return instance
      }

      it('pushes first event on instance', () => {
        vi.useFakeTimers()
        const now = Date.now()
        using instance = createValidInstance('id-667')
        recordEvent(instance, {
          name: 'some event',
          payload: {
            x: 7,
          },
        })
        vi.useRealTimers()
        const events = popRecordedEvents(instance)
        expect(events).toStrictEqual([
          {
            name: 'some event',
            occuredAt: now,
            payload: {
              x: 7,
            },
            version: 1,
          },
        ])
      })

      it('popRecordedEvents returns empty array if there were no events recorded between previous popRecorded events', () => {
        using instance = createValidInstance('id-667')
        recordEvent(instance, {
          name: 'some event',
          payload: {
            x: 7,
          },
        })

        const events = popRecordedEvents(instance)
        expect(events.length).toBe(1)
        expect(popRecordedEvents(instance).length).toBe(0)
      })
    })
  })
})
