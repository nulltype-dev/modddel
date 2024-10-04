import { describe, expect, it } from 'vitest'
import { Repository } from '../src/Repository.js'
import { defineAggregateRoot } from '../src/aggregate.js'
import type { IEvent } from '../src/types.js'

const createRepository = () => {
  const repository = new Repository()

  return {
    repository,
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
    it('publishes events recoreded by aggregate before saving', () => {
      const { repository } = createRepository()
      const { ShoppingCart } = defineAggregate()

      const eventNames: string[] = []
      repository.subscribe('eventRecorded', (event) => {
        eventNames.push(event.name)
      })

      using cart = ShoppingCart.create('cart-1')
      cart.addItem('item-1', 2)
      cart.addItem('item-1', 1)
      cart.removeItem('item-1', 3)

      repository.save(cart)

      expect(eventNames).toStrictEqual(['ItemAdded', 'ItemAdded', 'ItemRemoved'])
    })

    it('publishes events recoreded by aggregate after saving', () => {
      const { repository } = createRepository()
      const { ShoppingCart } = defineAggregate()

      const eventNames: string[] = []
      repository.subscribe('eventPublished', (event) => {
        eventNames.push(event.name)
      })

      using cart = ShoppingCart.create('cart-1')
      cart.addItem('item-1', 2)
      cart.addItem('item-1', 1)
      cart.removeItem('item-1', 3)

      repository.save(cart)

      expect(eventNames).toStrictEqual(['ItemAdded', 'ItemAdded', 'ItemRemoved'])
    })
  })
})
