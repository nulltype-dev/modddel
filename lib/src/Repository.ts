import { has } from '@nulltype/object-helper'
import { EventEmitter } from '@nulltype/event-emitter'
import type {
  AggregateDefinition,
  AggregateEvent,
  AggregateInstance,
  IEventStore,
  ISnapshot,
  ISnapshotStore,
  IStreamEvent,
  MethodsRecord,
} from './types.js'
import {
  aggregateData,
  getAggregateDefinition,
  loadAggregate,
  popRecordedEvents,
} from './aggregateData.js'

import { ConcurrencyError } from './errors.js'
import { Mutex } from './Mutex.js'

type RepositoryEvents = {
  eventsRecorded: [event: IStreamEvent[]]
  eventsPublished: [event: IStreamEvent[]]
}

const aggregateEventToStreamEvent = <EventsT>(
  id: string,
  aggregateName: string,
  event: AggregateEvent<EventsT>,
) => ({
  aggregateId: id,
  aggregateType: aggregateName,
  name: String(event.name),
  occuredAt: event.occuredAt,
  payload: event.payload,
  version: event.version,
})

export const isSnapshotStore = (store: unknown): store is ISnapshotStore =>
  has(store, 'loadSnapshot') && has(store, 'saveSnapshot')

export class Repository {
  #mutex = new Mutex()

  constructor(private store: IEventStore) {}

  private emitter = new EventEmitter<RepositoryEvents>()

  subscribe<NameT extends keyof RepositoryEvents>(
    name: NameT,
    listener: (...args: RepositoryEvents[NameT]) => Promise<void> | void,
  ) {
    return this.emitter.subscribe(name, listener)
  }

  async save<StateT, ActionsT extends MethodsRecord, EventsT>(
    aggregate: AggregateInstance<StateT, ActionsT, EventsT>,
  ) {
    using lock = this.#mutex.aqquire(
      `${aggregate.aggregateName()}:${aggregate.id}`,
    )
    await lock.promise
    const recordedEvents = popRecordedEvents(aggregate)
    const { definition } = getAggregateDefinition<
      AggregateDefinition<StateT, ActionsT, EventsT>
    >(aggregate.aggregateName())

    if (!recordedEvents.length) {
      return
    }

    const streamEvents = recordedEvents.map((event) =>
      aggregateEventToStreamEvent<EventsT>(
        aggregate.id(),
        aggregate.aggregateName(),
        event,
      ),
    )

    await this.emitter.emit('eventsRecorded', streamEvents)

    const currentVersion = await this.store.getAggregateVersion(
      definition,
      aggregate.id(),
    )

    if (currentVersion !== recordedEvents[0].version - 1) {
      throw new ConcurrencyError()
    }

    await this.store.saveEvents(streamEvents)

    if (isSnapshotStore(this.store)) {
      this.store.saveSnapshot(definition, aggregate.id(), {
        version: recordedEvents.at(-1)!.version,
        state: aggregateData(aggregate).state,
      })
    }

    this.emitter.emit('eventsPublished', streamEvents)
  }

  async load<StateT, ActionsT extends MethodsRecord, EventsT>(
    aggregateDefinition: AggregateDefinition<StateT, ActionsT, EventsT>,
    id: string,
  ) {
    using lock = this.#mutex.aqquire(`${aggregateDefinition.name()}:${id}`)
    await lock.promise

    let snapshot: ISnapshot<StateT> | null = null
    if (isSnapshotStore(this.store)) {
      snapshot = await this.store.loadSnapshot(aggregateDefinition, id)
    }

    const events = (
      await this.store.loadHistory(
        aggregateDefinition,
        id,
        snapshot?.version ?? 0,
      )
    ).map(
      (event) =>
        ({
          name: event.name,
          occuredAt: event.occuredAt,
          payload: event.payload,
          version: event.version,
        }) as AggregateEvent<EventsT>,
    )

    return loadAggregate<typeof aggregateDefinition>(
      aggregateDefinition.name(),
      id,
      events,
      snapshot,
    )
  }
}
