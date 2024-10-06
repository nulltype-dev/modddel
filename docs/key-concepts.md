# Key concepts

This is simple framework designed to support implementation of the DDD principles and provide structured approach for building robust and maintainable applications. Below is an introduction to the key concepts and components of our DDD Model Framework.

Version 2 is a complete rewrite, offering a more JavaScript-friendly experience with a simplified API.

## Overview

This framework helps implement Domain-Driven Design (DDD) principles with a structured approach for building robust and maintainable applications. Aggregates are the primary building blocks within this framework, encapsulating business logic, state, and events.

### Key Concepts

- **Aggregates**: Aggregate roots manage and enforce consistency within the boundary of an aggregate. Each aggregate can have multiple actions and event-handling mechanisms.
- **Events**: Actions within the aggregate record domain events, capturing changes in the system state.
- **Actions**: Aggregates define actions that enforce business rules using invariants and record events when those rules are satisfied.
- **Initial State**: Aggregates can define an initial state, which serves as the baseline for actions and event handling.

## Installation

```bash
npm i @nulltype/modddel@^2.0
```
