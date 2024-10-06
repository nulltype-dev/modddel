import { describe, expect, it } from 'vitest'
import { isSnapshotStore, Repository } from '../src/Repository.js'
import { defineAggregateRoot } from '../src/aggregate.js'
import type {
  GetAggregateEvents,
  GetAggregateState,
  IEvent,
  IEventStore,
  ISnapshot,
  ISnapshotStore,
  IStreamEvent,
} from '../src/types.js'
import { EventSorter } from '../src/utils.js'

type Options = {
  withSnapshot?: boolean
}
const createRepository = (options: Options = {}) => {
  const { withSnapshot = false } = options

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const snapshots: Record<string, Record<string, ISnapshot<any>>> = {}
  const events: IStreamEvent[] = []

  const eventStore: IEventStore = {
    getAggregateVersion(definition, id) {
      return Math.max(
        events
          .filter(
            (event) =>
              event.aggregateType === definition.name() &&
              event.aggregateId === id,
          )
          .at(-1)?.version ?? 0,
        snapshots[definition.name()]?.[id]?.version ?? 0,
      )
    },
    loadHistory(definition, id, sinceVersion) {
      return events
        .filter(
          (event) =>
            event.aggregateType === definition.name() &&
            event.aggregateId === id &&
            event.version >= sinceVersion,
        )
        .toSorted(EventSorter.byVersion)
    },
    saveEvents(newEvents) {
      events.push(...newEvents)
    },
  }

  const store = withSnapshot
    ? {
        ...eventStore,
        ...({
          loadSnapshot(aggregateDefinition, id) {
            return snapshots[aggregateDefinition.name()]?.[id] ?? null
          },
          saveSnapshot(aggregateDefinition, id, snapshot) {
            snapshots[aggregateDefinition.name()] ??= {}
            snapshots[aggregateDefinition.name()][id] = snapshot
          },
        } satisfies ISnapshotStore),
      }
    : eventStore

  const repository = new Repository(store)

  return {
    repository,
    store,
    events,
    snapshots,
  }
}

const defineAggregate = () => {
  type ItemPayload = { id: string; quantity: number }

  const ShoppingCart = defineAggregateRoot({
    name: 'ShoppingCart',
    initialState() {
      return {
        items: {} as Record<string, number>,
      }
    },
    events: {
      ItemAdded(event: IEvent<ItemPayload>) {
        const { id, quantity } = event.payload
        if (!this.state.items[id]) {
          this.state.items[id] = 0
        }

        this.state.items[id] += quantity
      },
      ItemRemoved(event: IEvent<ItemPayload>) {
        const { id, quantity } = event.payload
        this.state.items[id] -= quantity
        if (this.state.items[id] === 0) {
          delete this.state.items[id]
        }
      },
    },
    actions: {
      addItem(id: string, quantity: number) {
        this.recordThat('ItemAdded', {
          id,
          quantity,
        })
      },
      removeItem(id: string, quantity: number) {
        const { items } = this.state()

        if ((items[id] ?? 0) < quantity) {
          throw new Error('Cannot remove items not present in cart')
        }

        this.recordThat('ItemRemoved', { id, quantity })
      },
    },
  })

  return { ShoppingCart }
}

describe('Aggregate repository', () => {
  describe('Event stream', () => {
    it('publishes events recoreded by aggregate before saving', async () => {
      const { repository } = createRepository()
      const { ShoppingCart } = defineAggregate()

      const eventNames: string[] = []
      repository.subscribe('eventsRecorded', (events) => {
        eventNames.push(...events.map((event) => event.name))
      })

      using cart = ShoppingCart.create('cart-1')

      cart.addItem('item-1', 2)
      cart.addItem('item-1', 1)
      cart.removeItem('item-1', 3)

      await repository.save(cart)

      expect(eventNames).toStrictEqual([
        'ItemAdded',
        'ItemAdded',
        'ItemRemoved',
      ])
    })

    it('publishes events recoreded by aggregate after saving', async () => {
      const { repository } = createRepository()
      const { ShoppingCart } = defineAggregate()

      const eventNames: string[] = []
      repository.subscribe('eventsPublished', (events) => {
        eventNames.push(...events.map((event) => event.name))
      })

      using cart = ShoppingCart.create('cart-1')
      cart.addItem('item-1', 2)
      cart.addItem('item-1', 1)
      cart.removeItem('item-1', 3)

      await repository.save(cart)

      expect(eventNames).toStrictEqual([
        'ItemAdded',
        'ItemAdded',
        'ItemRemoved',
      ])
    })

    it('does not emit eventRecorded on created aggregate that had no actions called', async () => {
      const { repository } = createRepository()
      const { ShoppingCart } = defineAggregate()

      using cart1 = ShoppingCart.create('cart-1')
      let counter = 0
      repository.subscribe('eventsRecorded', () => {
        counter += 1
      })
      await repository.save(cart1)

      expect(counter).toBe(0)
    })
  })

  describe('Event store', () => {
    it('throws an concurency error when trying to save two newly created aggregates with same id', async () => {
      const { repository } = createRepository()
      const { ShoppingCart } = defineAggregate()

      using cart1 = ShoppingCart.create('cart-1')
      cart1.addItem('item-1', 1)

      using cart2 = ShoppingCart.create('cart-1')
      cart2.addItem('item-2', 1)

      expect(async () => {
        await Promise.all([repository.save(cart1), repository.save(cart2)])
      }).rejects.toThrow(/concurrency error/i)
    })
  })

  describe('Aggregate snapshot', () => {
    it('sets the proper version on snapshot', async () => {
      const { repository, store } = createRepository({
        withSnapshot: true,
      })
      const { ShoppingCart } = defineAggregate()

      using cart = ShoppingCart.create('cart-1')
      cart.addItem('item-1', 1)
      cart.addItem('item-2', 1)
      cart.addItem('item-1', 1)

      await repository.save(cart)

      if (isSnapshotStore(store)) {
        const snapshot = await store.loadSnapshot(ShoppingCart, 'cart-1')
        expect(snapshot?.version).toBe(3)
      } else {
        throw new Error('Use store with snapshot support')
      }
    })

    it('loads aggregate from snapshot', async () => {
      const { repository, snapshots } = createRepository({
        withSnapshot: true,
      })
      const { ShoppingCart } = defineAggregate()

      snapshots[ShoppingCart.name()] = {}
      snapshots[ShoppingCart.name()]['cart-1'] = {
        version: 4,
        state: {
          items: {
            'item-1': 3,
            'item-2': 4,
          },
        },
      } satisfies ISnapshot<GetAggregateState<typeof ShoppingCart>>

      const cart = await repository.load(ShoppingCart, 'cart-1')
      cart.addItem('item-3', 1)
      cart.addItem('item-1', 2)

      await repository.save(cart)

      expect(snapshots[ShoppingCart.name()]['cart-1']).toStrictEqual({
        version: 6,
        state: {
          items: {
            'item-1': 5,
            'item-2': 4,
            'item-3': 1,
          },
        },
      })
    })

    it('loads aggregate from history', async () => {
      const { repository, events, snapshots } = createRepository({
        withSnapshot: true,
      })
      const { ShoppingCart } = defineAggregate()
      type EventsT = GetAggregateEvents<typeof ShoppingCart>

      const event = <NameT extends keyof EventsT>(
        version: number,
        name: NameT,
        payload: EventsT[NameT],
      ): IStreamEvent => ({
        name,
        aggregateId: 'cart-1',
        aggregateType: ShoppingCart.name(),
        occuredAt: Date.now(),
        payload,
        version,
      })

      const history: IStreamEvent[] = [
        event(1, 'ItemAdded', { id: 'item-1', quantity: 1 }),
        event(2, 'ItemAdded', { id: 'item-1', quantity: 2 }),
        event(3, 'ItemAdded', { id: 'item-2', quantity: 2 }),
        event(4, 'ItemAdded', { id: 'item-2', quantity: 2 }),
      ]
      events.push(...history)

      const cart = await repository.load(ShoppingCart, 'cart-1')
      cart.addItem('item-3', 1)
      cart.addItem('item-1', 2)

      await repository.save(cart)

      expect(snapshots[ShoppingCart.name()]['cart-1']).toStrictEqual({
        version: 6,
        state: {
          items: {
            'item-1': 5,
            'item-2': 4,
            'item-3': 1,
          },
        },
      })
    })
  })
})
