# Test Utilities Guide

This guide provides an overview of the test utilities available for testing aggregates, verifying recorded events, and handling exceptions during aggregate actions.

## Overview

The `test-utils` module is designed to make it easier to test aggregate behavior by providing methods for loading aggregate instances with histories, asserting events, and handling exceptions thrown during aggregate operations.

```ts
import { assert, GivenAggregateRoot } from "@nulltype/modddel/test-utils";
```

## Available Functions

- `assert`: Asserts that a condition or result is met.
- `GivenAggregate`: Initializes an aggregate with either a new instance or an existing event history for testing.

## Assertions

The `assert` function provides a way to verify that specific conditions are met during the execution of aggregate operations. If an assertion fails, an error is thrown with a detailed message.

```ts
await assert(
  GivenAggregate(ShoppingCart)
    .withNewInstance("cart-1")
    .expect((instance) => {
      instance.addItem("item-1", 1);
    })
    .toRecordEvents(["ItemAdded"])
);
```

## `GivenAggregate`

The `GivenAggregate` is a factory function that allows you to either create a new instance of an aggregate or load an existing one from event history and/or snapshots. This utility ensures that your aggregate tests start from a known state, whether that state is new or reconstructed from historical events.

```ts
GivenAggregate(MyAggregateDefinition).withNewInstance("my-aggregate-id");

// or

GivenAggregate(MyAggregateDefinition).withHitory(
  "my-aggregate-id",
  eventHistory
);
```

### Methods

- `withNewInstance(id: string)`: Creates a new aggregate instance with the specified id. This method is useful when testing commands on a fresh aggregate.
- `withHistory(id: string, events: HistoryEvent[], snapshot?: ISnapshot)`: Loads an aggregate instance with a specified event history, and optionally a snapshot. This is particularly useful when you want to test an aggregate that has a non-trivial past and validate its behavior in that context.

::: info
The `HistoryEvent` is a minimalistic representation of an event. It's a "tuple", an array with two elements. The first is the event name. The second is event payload. The utils will convert it to proper events.

```ts
GivenAggregate(MyAggregateDefinition).withInstanceHistory("aggregate-id", [
  ["Event1", { data: "value" }],
  ["Event2", { data: "other value" }],
]);
```

:::

Both methods—whether you're creating a new instance or loading an instance from history—return an API that includes the `expect` method. The `expect` method allows you to define actions that you want to test and provides the instance as an argument in the callback. From there, you can chain various assertions, such as verifying that certain events were recorded or checking for errors.

## `expect`

Both `withNewInstance` and `withHistory` return an API that exposes the expect method. This method allows you to perform actions on the aggregate instance (passed as an argument) and then chain assertions.

The signature of the expect method looks like this:

```ts
expect(callback: (instance: AggregateInstance<StateT, ActionsT, EventsT>) => Promise<void> | void);
```

- **Callback Argument**: The callback receives the aggregate instance, allowing you to perform actions on it (like calling actions).
- **Return Value**: After defining actions, you can chain methods like `toRecordEvents` or `toThrow` to verify expected outcomes.

Example:

```ts
GivenAggregate(ShoppingCart)
  .withNewInstance("cart-1")
  .expect((instance) => {
    instance.addItem("item-1", 1);
  });
```

# Assertion Methods: `toThrow` and `toRecordEvents`

When testing event-sourced aggregates using the `GivenAggregate` utility, two key assertion methods—`toThrow` and `toRecordEvents`—allow you to verify the outcomes of commands executed on an aggregate. These methods are chained after the `expect` method and help ensure your domain logic behaves as expected.

## `toThrow`: Verifying Error Handling

The `toThrow` method is used to assert that a action executed on an aggregate instance throws an expected error. This is particularly useful for testing invalid actions, ensuring that the aggregate enforces its business rules and constraints properly.

### Usage

The `toThrow` method can handle various types of expectations for errors:

1. **Exact Error Message**: You can assert that a specific error message is thrown.
2. **Regular Expression**: Use a regular expression to assert that the error message matches a specific pattern.
3. **Custom Function**: Define a custom function to check for a specific condition in the thrown error. This function must return true if the thrown error is what we expected or false otherwise.

### Method Signature

```ts
toThrow(expected: string | RegExp | ((error: Error) => AssertResult)): Assertion
```

### Example: Asserting Exact Error Message

```ts
await assert(
  GivenAggregate(ShoppingCart)
    .withNewInstance("cart-1")
    .expect((instance) => {
      instance.removeItem("nonexistent-item", 1);
    })
    .toThrow("Cannot remove items not present in cart")
);
```

In this example:

- The command `removeItem` is expected to throw an error because the item doesn't exist in the cart.
- The assertion verifies that the error message matches `"Cannot remove items not present in cart"` exactly.

### Example: Using a Regular Expression

```ts
await assert(
  GivenAggregate(ShoppingCart)
    .withNewInstance("cart-1")
    .expect((instance) => {
      instance.removeItem("nonexistent-item", 1);
    })
    .toThrow(/not present in cart/i)
);
```

Here, the `toThrow` method checks if the error message contains the phrase `"not present in cart"`, using a regular expression.

### Example: Custom Function for Error Validation

```ts
await assert(
  GivenAggregate(ShoppingCart)
    .withNewInstance("cart-1")
    .expect((instance) => {
      instance.removeItem("nonexistent-item", 1);
    })
    .toThrow((error) => error.message.includes('not present'));
);
```

This example uses a custom function to validate that the error message includes the word "not present". This approach offers flexibility for complex validation logic.

## `toRecordEvents`: Verifying Recorded Events

The `toRecordEvents` method is used to assert that specific events were recorded by the aggregate after executing a command. This method ensures that the aggregate's event-sourcing logic is working correctly and that the right events are emitted as a result of domain actions.

### Usage

`toRecordEvents` can be used in two ways:

- **Exact Event Names**: Assert that the events recorded match a specific list of event names.
- **Custom Function**: Provide a function to validate the recorded events based on more complex logic (e.g., checking event payloads).

### Method signature

```ts
toRecordEvents(events: (keyof EventsT)[] | ((events: Readonly<AggregateEvent<EventsT>[]>) => AssertResult)): Assertion
```

- `events`: The expected events, which can be:
  - An array of event names (matching the names of the expected events).
  - A function that receives the recorded events and returns true the events is exactly what we want.

```ts
await assert(
  GivenAggregate(ShoppingCart)
    .withNewInstance("cart-1")
    .expect((instance) => {
      instance.addItem("item-1", 1);
    })
    .toRecordEvents((events) => {
      return events.length === 1 && events[0].payload.id === "item-1";
    })
);
```

## Conclusion

The `test-utils` module provides a rich set of utilities to test the behavior of aggregates, manage event histories, and verify event sourcing workflows. By combining the `GivenAggregate`, `expect`, `toThrow`, `toRecordEvents`, you can build robust tests that simulate real-world scenarios, ensuring that your aggregates behave as expected.
