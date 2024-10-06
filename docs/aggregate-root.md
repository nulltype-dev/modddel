# Aggregate root

## Aggregate Definition

To define an aggregate root, use the `defineAggregateRoot` function, which configures the aggregate’s name, events, operations, and initial state.

```ts
const MyAggregate = defineAggregateRoot({
  name: "My aggregate",
  events: {
    NumbersAdded(event: IEvent<{ a: number; b: number }>) {
      const { a, b } = event.payload;
      this.state.total += a + b;
    },
  },
  actions: {
    addSumToTotal(a: number, b: number) {
      const { total } = this.state();
      // total cannot be greater than the sum
      if (total > a + b) {
        throw new Error("total is greater than a + b");
      }
      this.recordThat("NumbersAdded", { a, b });
    },
  },
  initialState: () => ({
    total: 1,
  }),
});
```

::: warning
Functions in actions and events should **not** be arrow functions, as `this` must be properly bound to the aggregate's API. Always use function expressions to access the correct context.
:::

### Breakdown:

- Name: The aggregate is named `"My aggregate"`.
- Events: An event `NumbersAdded` modifies the state based on payload values.
- Actions: The `addSumToTotal` operation validates state with an invariant and records the event `NumbersAdded`.
- Initial State: The state starts with `total = 1`.

## Aggregate Creation

Aggregates are created with a unique identifier. The creation process initializes the aggregate with its defined state. This is not an business action and you should define such in actions and call it after creation. To give a context and an proper history event.

```ts
const MyAggregate = defineAggregateRoot({
  name: 'MyAggregate',
  initialState: () => {},
})
using instance = MyAggregate.create('agg-1')

console.log(instance.id()) // Output: 'agg-1'
```

::: warning
When working with aggregate instances, the framework encourages the use of `using` instead of `const` or `let` for handling instances, as it automatically manages resource disposal and ensures proper lifecycle management. If for some reason you cannot use `using` then remember to call dispose function manually: `instance[Symbol.dispose]()`
:::

## Agregate Actions

Actions represent the business logic performed on an aggregate. Within each action, invariants are checked to ensure that certain conditions are met before proceeding. Actions are responsible for enforcing these rules and should always result in recording events, reflecting changes in the system. It's important to note that the state within actions is read-only and cannot be modified directly.

### Api inside actions

You have access to api providing some useful functions. The api is bound to `this`. This is why you cannot use arrow function to define actions (same reason is for events). Api in actions provides the following functions:

- `this.state()`: readonly state, this is copy of current state, action cannot change the state of aggtegate, this is done by event handlers.
- `this.recordThat('EventName', payload)`: if the invariants are fullfiled you should record an event what informes what has changed from the business perspective. The state will be updated by your event handlers.

### Exposing Actions

Aggregates expose defined actions as callable methods on the aggregate instance.

```ts
using instance = MyAggregate.create('agg-1')
instance.addSumToTotal(1, 2)
```

## Aggregate Events (event handlers)

In the aggregate definition, the events section defines how state changes are applied. Each event handler function is responsible for updating the aggregate's state in response to a recorded event. These functions are executed when events are replayed or processed, ensuring that the aggregate’s state evolves according to the recorded history. While actions cannot directly modify the state (as it's read-only), events provide the mechanism to apply these changes, reflecting the outcomes of business logic.

### Api inside event handlers

In handlers you also have access to api. This one is different from the one in actions. It provides:

- `this.state` (note that this is not a function). You can operate directly on the state.

## Shopping Cart example

### Aggregate Definition: Shopping Cart

In this example, the `ShoppingCart` aggregate will manage the following actions:

- Add Item: Adds an item to the cart.
- Remove Item: Removes an item from the cart.
- Checkout: Finalizes the purchase.

```ts
const ShoppingCart = defineAggregateRoot({
  name: "ShoppingCart",
  events: {
    ItemAdded(event: IEvent<{ itemId: string; quantity: number }>) {
      const { itemId, quantity } = event.payload;
      this.state.items[itemId] = (this.state.items[itemId] || 0) + quantity;
    },
    ItemRemoved(event: IEvent<{ itemId: string }>) {
      const { itemId } = event.payload;
      delete this.state.items[itemId];
    },
    CheckoutCompleted(event: IEvent<{}>) {
      this.state.checkedOut = true;
    },
  },
  actions: {
    addItem(itemId: string, quantity: number) {
      if (this.state.checkedOut) {
        throw new Error("Cannot add items to a checked-out cart");
      }
      this.recordThat("ItemAdded", { itemId, quantity });
    },
    removeItem(itemId: string) {
      if (this.state.checkedOut) {
        throw new Error("Cannot remove items to a checked-out cart");
      }

      if (!this.state.items[itemId]) {
        throw new Error(`Item with ID ${itemId} not in the cart`);
      }
      this.recordThat("ItemRemoved", { itemId });
    },

    checkout() {
      if (Object.keys(this.state.items).length === 0) {
        throw new Error("Cannot checkout an empty cart");
      }
      this.recordThat("CheckoutCompleted", {});
    },
  },
  initialState: () => ({
    items: {},
    checkedOut: false,
  }),
});
```

### 1. Adding Items to the cart

```ts
using cart = ShoppingCart.create('cart-1')

cart.addItem('item-123', 2)
cart.addItem('item-456', 1)
```

#### Explanation

- We defined an operation `addItem` that adds items to the cart.
- It records the event `ItemAdded` with the item ID and quantity.
- The state (`items`) is updated accordingly.

### 2. Removing Items from the Cart

```ts
cart.removeItem("item-123");
```

#### Explanation

- `removeItem` removes an item from the cart if it exists.
- If the item is not in the cart, an error is thrown.

### 3. Checkout

```ts
cart.checkout();
```

#### Explanation

- The `checkout` operation ensures that the cart is not empty before finalizing the order.
- It records the `CheckoutCompleted` event and sets the cart's `checkedOut` state to `true`.

## Separation of Actions and Event handlers

In our framework, we emphasize a clear distinction between **actions** and **events**. This separation is essential for maintaining a clean architecture and ensuring that your application adheres to best practices in Domain-Driven Design (DDD) and event sourcing.

### Key Benefits of Separation:

1. **Focused Responsibilities**:

   - **Actions** manage the business logic and validate rules for modifying an aggregate's state.
   - **Events** document the outcomes of actions, serving as a historical record of changes.

2. **Support for Event Sourcing**:

   - Allows for **loading from history** by replaying events to reconstruct an aggregate's state.
   - Enables actions to **record multiple events**, reflecting various changes that occur as a result of a single operation.

3. **Enhanced Testability**:

   - Isolate business logic testing for actions without coupling to event representations.
   - Simplifies modifications to event structures without altering core business logic.

4. **Improved Flexibility**:
   - Facilitates adjustments to business processes by clearly defining how changes are applied and recorded.

### Conclusion

By separating actions and events, our framework promotes a robust architecture that is easier to understand, test, and maintain. This approach allows developers to focus on implementing business rules while ensuring that all state changes are accurately captured and managed.
