import { loadAggregate, popRecordedEvents } from './aggregateData.js'
import type {
  AggregateDefinition,
  AggregateEvent,
  AggregateInstance,
  IAggregateEvent,
  ISnapshot,
  MethodsRecord,
} from './types.js'

const assert = async (assertion: Assertion, customErrorMessage?: string) => {
  const { result, message, error } = await assertion

  if (!result) {
    if (error) {
      error.message = `${customErrorMessage ?? message}\n\n${error.message}`
      throw error
    } else {
      throw new Error(customErrorMessage ?? message, {
        cause: error,
      })
    }
  }
}

const loadAggregateWithEventHistory = <
  StateT,
  ActionsT extends MethodsRecord,
  EventsT,
>(
  aggregateDefinition: AggregateDefinition<StateT, ActionsT, EventsT>,
  id: string,
  events: HistoryEvent<EventsT>[],
  snapshot?: ISnapshot<StateT>,
) => {
  const firstEventDate = Date.now() - 10000 * events.length
  const aggregateEvents: AggregateEvent<EventsT>[] = events.map(
    ([name, payload], index) =>
      ({
        name,
        payload,
        version: (snapshot?.version ?? 0) + index + 1,
        occuredAt: firstEventDate + 1000 * index,
      } satisfies IAggregateEvent<EventsT, keyof EventsT>),
  )

  return loadAggregate<AggregateDefinition<StateT, ActionsT, EventsT>>(
    aggregateDefinition.name(),
    id,
    aggregateEvents,
    snapshot,
  )
}

type AssertResult = Promise<boolean> | boolean

type Assertion = Promise<{
  result: boolean
  message: string
  error?: Error | null
}>

const executionApi = <StateT, ActionsT extends MethodsRecord, EventsT>(
  instance: AggregateInstance<StateT, ActionsT, EventsT>,
  execution: Promise<void>,
) => {
  return {
    async toThrow(
      expected: string | RegExp | ((error: Error) => AssertResult),
    ): Assertion {
      let catchedError: Error | null = null

      try {
        await execution
      } catch (error) {
        catchedError =
          error instanceof Error
            ? error
            : new Error(undefined, {
                cause: error,
              })
      }

      if (typeof expected === 'function') {
        return {
          result: Boolean(catchedError && (await expected(catchedError))),
          message: 'Did not throw expected result.',
          error: catchedError,
        }
      } else if (expected instanceof RegExp) {
        return {
          result: Boolean(
            catchedError &&
              expected.test(catchedError.message ?? String(catchedError.cause)),
          ),
          message: `Did not throw error matching RegExp ${expected}.`,
          error: catchedError,
        }
      }

      return {
        result:
          expected === (catchedError?.message ?? String(catchedError?.cause)),
        message: `Did not throw error "${expected}".`,
        error: catchedError,
      }
    },
    async toRecordEvents(
      events:
        | (keyof EventsT)[]
        | ((events: Readonly<AggregateEvent<EventsT>[]>) => AssertResult),
    ): Assertion {
      try {
        await execution
      } catch (error) {
        return {
          result: false,
          message: 'Error occured during execution.',
          error:
            error instanceof Error
              ? error
              : new Error(undefined, {
                  cause: error,
                }),
        }
      }

      const recordedEvents = popRecordedEvents(instance)
      if (typeof events === 'function') {
        return {
          result: await events(recordedEvents),
          message: 'Invalid recorded events.',
        }
      }

      if (recordedEvents.length !== events.length) {
        return {
          result: false,
          message: 'Expected different amount of events.',
        }
      }

      for (let i = 0; i < recordedEvents.length; i += 1) {
        if (events[i] !== recordedEvents[i].name) {
          return {
            result: false,
            message: `Expected event number ${i + 1} to be "${String(
              events[i],
            )}" but "${String(
              recordedEvents[i].name,
            )}" happened instead. \n\nExpected: [${events.join(
              ', ',
            )}]\nActual: [${recordedEvents.map((re) => re.name).join(', ')}]`,
          }
        }
      }

      return {
        result: true,
        message: '',
      }
    },
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isThenable = <T>(value: any): value is Promise<T> =>
  typeof value?.then === 'function'

const instanceApi = <StateT, ActionsT extends MethodsRecord, EventsT>(
  instance: AggregateInstance<StateT, ActionsT, EventsT>,
) => {
  return {
    expect(
      callback: (
        instance: AggregateInstance<StateT, ActionsT, EventsT>,
      ) => Promise<void> | void,
    ) {
      const execution = new Promise<void>((resolve, reject) => {
        try {
          const result = callback(instance)
          if (isThenable(result)) {
            result.then(resolve).catch(reject)
          } else {
            resolve()
          }
        } catch (error) {
          reject(error)
        }
      })

      return executionApi(instance, execution)
    },
  }
}

type HistoryEvent<EventsT> = {
  [key in keyof EventsT]: [key, EventsT[key]]
}[keyof EventsT]

const GivenAggregate = <StateT, ActionsT extends MethodsRecord, EventsT>(
  aggregateDefinition: AggregateDefinition<StateT, ActionsT, EventsT>,
) => {
  return {
    withNewInstance(id: string) {
      return instanceApi(aggregateDefinition.create(id))
    },
    withInstanceHistory(
      id: string,
      events: HistoryEvent<EventsT>[],
      snapshot?: ISnapshot<StateT>,
    ) {
      return instanceApi(
        loadAggregateWithEventHistory(
          aggregateDefinition,
          id,
          events,
          snapshot,
        ),
      )
    },
  }
}

export { assert, GivenAggregate }
