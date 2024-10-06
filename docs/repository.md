# Repository

In this guide, we will cover how to implement and use the `Repository` class in the Modddel framework. The repository pattern helps separate the domain logic from the persistence mechanism, ensuring clean and maintainable code. It is also crucial for managing aggregates, events, and snapshots in a Domain-Driven Design (DDD) environment.

## Overview

A repository in this framework serves as the interface to load and save aggregate roots. It abstracts away the underlying event store and optional snapshot store, providing a consistent API to manage the lifecycle of aggregates. The repository handles:

- Storing events emitted by aggregates.
- Loading aggregate state either from history (event sourcing) or from a snapshot.
- Publishing domain events when they are recorded and saved.

### Key Concepts

- **Event Store**: Stores the history of domain events for aggregates.
- **Snapshot Store**: Optionally stores snapshots of aggregates to optimize loading by reducing the need to replay events.
- **Concurrency Handling**: Ensures that concurrent modifications of the same aggregate are managed correctly.
- **Subscriptions**: Allows you to listen for events when they are recorded and published.

---

## Setting Up the Repository

The repository can be created with or without snapshot support. Here's how to configure a repository:

### Creating a Repository

The repository can be created by providing an event store. Optionally, you can enable snapshots to improve performance by reducing the need to replay all events when loading an aggregate.

In the repository, an event store is responsible for saving and loading events. Here's a basic implementation:

```ts
class EventStore implements IEventStore {
  getAggregateVersion(definition, id) {
    // Returns the latest version of an aggregate by checking events and snapshots
  },
  loadHistory(definition, id, sinceVersion) {
    // Loads the history of events for the aggregate from the event store
  },
  saveEvents(newEvents) {
    // Saves new events to the event store
  },
};
```

The snapshot store allows to load and save snapshots. The interface contains two additional methods :

```ts
class EventStore implements IEventStore, ISnapshotStore {
  // ...

  loadSnapshot(aggregateDefinition, id) {
    // Loads a snapshot if available for the given aggregate
  },
  saveSnapshot(aggregateDefinition, id, snapshot) {
    // Saves a snapshot of the aggregate
  },
};
```

::: tip
You can also use the repository as snapshot only repository. To do this leave the saveEvents method empty, and return empty array in the loadHistory. The getAggregateVersion must return valid version (it can be based on the snapshot).
:::

:::tip
If you are using event store then you don't have to write snapshot on every save. Check conditions you want in saveSnapshot. For example, we can check if `snapshot.version % 100 === 0` is true and then persist in the database.
:::

## Loading and Saving Aggregates

### Loading an Aggregate

The repository can load an aggregate from either the event store or from a snapshot, if available. If the snapshot is not up to date, the repository will load additional events from the event store to update the aggregate's state.

```ts
const cart = await repository.load(ShoppingCart, "cart-1");
```

### Saving an Aggregate

Once an aggregate has recorded events through its actions, those events need to be saved using the repository. When saving, the repository handles event persistence and emits the events to any listeners.

## Event Streaming

Repositories allow subscribing to events emitted by aggregates. You can subscribe to two types of events:

- `eventsRecorded`: Fired when an event is recorded by an aggregate **before** saving to the event store.
- `eventsPublished`: Fired when an event is successfully saved to the event store and persisted.

### Differences Between `eventRecorded` and `eventPublished`

- **`eventRecorded`**: This event is emitted immediately after the aggregate records an event but **before** any events are persisted. It's ideal for listeners that **must be executed prior to saving**, such as validation checks or pre-persistence logic.

  - **Important:** If an exception is thrown in any of the listeners subscribed to `eventRecorded`, the events and any associated snapshots will **not be saved**. This ensures that no invalid or incomplete state changes are persisted if there's an issue with the event listeners.

  This makes `eventRecorded` perfect for actions where the listeners need to guarantee execution **before** saving or where the application must guarantee that no events are saved unless all listeners execute successfully.

- **`eventPublished`**: This event is emitted **after** the events have been successfully saved to the event store. It is best suited for listeners where it's acceptable for the listeners to fail or not execute without affecting the persistence of the aggregate’s state (e.g., sending notifications or logging). Since the aggregate's state has already been persisted, any error that occurs in `eventPublished` listeners will **not affect the saved state**.

  `eventPublished` is useful for side effects or tasks that can happen optionally, where it's fine for them to fail or be skipped due to errors, because the changes to events in this listeners won't be persisted.

### Example: Listening for Recorded and Published Events

You can subscribe to event streams using the repository’s `subscribe` method:

```ts
repository.subscribe("eventsRecorded", (events) => {
  console.log(`Events recorded: ${events.map((event) => event.name)}`);
  // Perform critical tasks here (e.g., validation)
});

repository.subscribe("eventsPublished", (events) => {
  console.log(`Event published: ${events.map((event) => event.name)}`);
  // Perform non-critical tasks here (e.g., notifications)
});
```

## Concurrency Handling

The repository enforces concurrency control by ensuring that no two instances of the same aggregate can be modified at the same time without conflict. This prevents data inconsistency in cases where two processes attempt to modify the same aggregate concurrently.

### Handling Concurrency Errors

If two newly created aggregates with the same ID are saved concurrently, the repository will throw a concurrency error:

```ts
try {
  await Promise.all([repository.save(cart1), repository.save(cart2)]);
} catch (error) {
  console.error("Concurrency error:", error);
}
```

In this example, both cart1 and cart2 represent the same aggregate (cart-1). Attempting to save both concurrently will result in an error, as the aggregate's version will have changed during the first save, causing the second save to fail.

## Conclusion

The Repository class in the Modddel framework is a crucial component for managing aggregates, events, and snapshots in a clean and efficient way. By abstracting the event and snapshot stores, it provides a consistent API for handling the persistence of aggregates and ensures that domain events are correctly recorded and published.

The repository pattern simplifies aggregate management while supporting event sourcing and snapshotting for optimized performance, making it an essential part of building scalable DDD applications.
