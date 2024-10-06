/* eslint-disable @typescript-eslint/no-explicit-any */
import { InstanceDoesNotExistError } from './errors.js'
import type {
  AggregateDefinition,
  AggregateInstance,
  AggregateOptions,
  GetAggregateInstance,
  GetAggregateOptions,
  GetAggregateState,
  AggregateEventsByDefinition,
  IEvent,
  ISnapshot,
  MethodsRecord,
  AggregateEvent,
} from './types.js'
import { areEventsContinous, EventSorter } from './utils.js'

interface AggregateData<StateT, EventsT> {
  state: StateT
  version: number
  recordedEvents: AggregateEvent<EventsT>[]
}

const aggregateDefinitions = new Map<
  string,
  {
    definition: AggregateDefinition<any, any, any>
    options: AggregateOptions<any, any, any>
  }
>()

const aggregatesData = new WeakMap<AggregateInstance, AggregateData<any, any>>()

export const getAggregateDefinition = <DefinitionT>(name: string) => {
  const config = aggregateDefinitions.get(name)
  if (!config) {
    throw new Error(`Aggregate "${name}" not defined`)
  }

  return config as {
    definition: DefinitionT
    options: GetAggregateOptions<DefinitionT>
  }
}

export const registerAggregate = <
  StateT,
  ActionsT extends MethodsRecord,
  EventsT,
>(
  definition: AggregateDefinition<StateT, ActionsT, EventsT>,
  options: AggregateOptions<StateT, ActionsT, EventsT>,
) => {
  aggregateDefinitions.set(definition.name(), {
    definition,
    options,
  })
}

export const createInstanceData = <
  StateT,
  ActionsT extends MethodsRecord,
  EventsT,
>(
  instance: AggregateInstance<StateT, ActionsT, EventsT>,
  state: StateT,
) => {
  aggregatesData.set(instance, {
    state,
    version: 0,
    recordedEvents: [],
  } satisfies AggregateData<StateT, EventsT>)
}

export const aggregateData = <StateT, ActionsT extends MethodsRecord, EventsT>(
  instance: AggregateInstance<StateT, ActionsT, EventsT> | null,
) => {
  const data = instance && aggregatesData.get(instance)
  if (!data) {
    throw new InstanceDoesNotExistError()
  }

  return data as AggregateData<StateT, EventsT>
}

export const recordEvent = <
  StateT,
  ActionsT extends MethodsRecord,
  EventsT,
  NameT extends keyof EventsT,
>(
  instance: AggregateInstance<StateT, ActionsT, EventsT> | null,
  event: IEvent<EventsT[NameT]>,
): void => {
  const data = instance && aggregatesData.get(instance)
  if (!data) {
    throw new InstanceDoesNotExistError()
  }

  data.version += 1
  data.recordedEvents.push({
    name: event.name,
    payload: event.payload,
    occuredAt: Date.now(),
    version: data.version,
  })
}

export const popRecordedEvents = <
  StateT,
  ActionsT extends MethodsRecord,
  EventsT,
>(
  instance: AggregateInstance<StateT, ActionsT, EventsT>,
) => {
  const data = aggregatesData.get(instance) as AggregateData<StateT, EventsT>
  if (!data) {
    throw new InstanceDoesNotExistError()
  }

  const events = data.recordedEvents
  data.recordedEvents = []

  return events
}

export const loadAggregate = <
  DefinitionT extends AggregateDefinition<any, any, any>,
>(
  aggregateName: string,
  id: string,
  events: AggregateEventsByDefinition<DefinitionT>[] = [],
  snapshot: ISnapshot<GetAggregateState<DefinitionT>> | null = null,
) => {
  const { definition: Aggregate, options } =
    getAggregateDefinition<DefinitionT>(aggregateName)
  const instance = Aggregate.create(id) as GetAggregateInstance<DefinitionT>
  const data = aggregateData(instance)

  if (snapshot) {
    data.version = snapshot.version
    // TODO: clone the state
    data.state = snapshot.state
  }

  if (!events.length) {
    return instance
  }

  if (!options.events) {
    throw new Error(
      'Cannot load aggregate by events when none are defined for aggregate "${options.name}".',
    )
  }

  const newEvents = (
    snapshot
      ? events.filter((event) => event.version > snapshot.version)
      : events
  ).toSorted(EventSorter.byVersion)

  if (!newEvents.length) {
    return instance
  }

  if (newEvents[0].version !== (snapshot?.version ?? 0) + 1) {
    throw new Error("Loaded events doesn't start right after snapshot.")
  }

  if (!areEventsContinous(newEvents)) {
    throw new Error('Loaded events are not continous.')
  }

  for (const event of newEvents) {
    const handler = options.events?.[event.name]

    if (!handler) {
      throw new Error(
        `Handler for event "${String(event.name)}" not defined for aggregate "${
          options.name
        }".`,
      )
    }

    handler.call(
      {
        state: data.state,
      },
      {
        name: String(event.name),
        payload: event.payload,
      },
    )

    data.version = event.version
  }

  return instance
}
