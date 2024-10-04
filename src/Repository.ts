import { EventEmitter } from '@nulltype/event-emitter'
import type {
  AggregateEvent,
  AggregateInstance,
  MethodsRecord,
} from './types.js'
import { popRecordedEvents } from './aggregateData.js'

interface IStreamEvent {
  name: string
  payload: unknown
  occuredAt: number
  aggregateId: string
  aggregateType: string
  version: number
}

type RepositoryEvents = {
  eventRecorded: [event: IStreamEvent]
  eventPublished: [event: IStreamEvent]
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

export class Repository {
  private emitter = new EventEmitter<RepositoryEvents>()

  subscribe<NameT extends keyof RepositoryEvents>(
    name: NameT,
    listener: (...args: RepositoryEvents[NameT]) => Promise<void> | void,
  ) {
    return this.emitter.subscribe(name, listener)
  }

  save<StateT, ActionsT extends MethodsRecord, EventsT>(
    aggregate: AggregateInstance<StateT, ActionsT, EventsT>,
  ) {
    const recordedEvents = popRecordedEvents(aggregate)

    for (const event of recordedEvents) {
      this.emitter.emit(
        'eventRecorded',
        aggregateEventToStreamEvent<EventsT>(
          aggregate.id(),
          aggregate.aggregateName(),
          event,
        ),
      )
    }

    // todo save events

    for (const event of recordedEvents) {
      this.emitter.emit(
        'eventPublished',
        aggregateEventToStreamEvent<EventsT>(
          aggregate.id(),
          aggregate.aggregateName(),
          event,
        ),
      )
    }
  }
}
