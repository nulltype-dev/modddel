import {
  aggregateData,
  createInstanceData,
  recordEvent,
  registerAggregate,
} from './aggregateData.js'
import type {
  AggregateDefinition,
  AggregateExposedActions,
  AggregateInstance,
  AggregateOptions,
  IEvent,
  MethodsRecord,
} from './types.js'

export function defineAggregateRoot<
  StateT,
  ActionsT extends MethodsRecord,
  EventsT,
>(
  options: AggregateOptions<StateT, ActionsT, EventsT>,
): AggregateDefinition<StateT, ActionsT, EventsT> {
  const definition = {
    name: () => options.name,
    create(id: string) {
      const state = () => aggregateData(instance).state
      // TODO: implement possibility to clone the state
      const stateCopy = (): StateT => state()

      const actions = Object.fromEntries(
        Object.entries(options.actions ?? {}).map(([name, action]) => [
          name,
          action.bind({
            state: () => stateCopy(),
            recordThat: <NameT extends keyof EventsT>(
              name: NameT,
              payload: EventsT[NameT],
            ) => {
              const event: IEvent<EventsT[NameT]> = {
                name: String(name),
                payload,
              }

              if (!options.events?.[name]) {
                return
              }

              recordEvent(instance, event)
              options.events[name].call(
                {
                  state: state(),
                },
                event,
              )
            },
          }),
        ]),
      ) as AggregateExposedActions<ActionsT>

      let instance: AggregateInstance<StateT, ActionsT, EventsT> | null = {
        ...actions,
        id() {
          return id
        },
        aggregateName() {
          return options.name
        },
        [Symbol.dispose]() {
          instance = null
        },
      }
      createInstanceData(instance, options.initialState())
      return instance
    },
  }

  registerAggregate(definition, options)

  return definition
}
