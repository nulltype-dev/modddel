type Action<StateT, EventsT, ArgsT extends AnyArgs> = (
  this: ActionThis<StateT, EventsT>,
  ...args: ArgsT
) => void

interface ActionThis<StateT, EventsT> {
  state(): Readonly<StateT>
  recordThat: <NameT extends keyof EventsT>(
    eventName: NameT,
    payload: EventsT[NameT],
  ) => void
}

type AggregateBaseInstance = {
  id: () => string
  aggregateName: () => string
  [Symbol.dispose]: () => void
}

export type AggregateDefinition<
  StateT = {},
  ActionsT extends MethodsRecord = {},
  EventsT = {},
> = {
  name(): string
  create(id: string): AggregateInstance<StateT, ActionsT, EventsT>
}

export type AggregateExposedActions<ActionsT extends MethodsRecord = {}> = {
  [key in keyof ActionsT]: (...args: ActionsT[key]) => void
}

export type AggregateInstance<
  _StateT = {},
  ActionsT extends MethodsRecord = {},
  _EventsT = {},
> = AggregateBaseInstance & AggregateExposedActions<ActionsT>

export interface AggregateOptions<
  StateT = {},
  ActionsT extends MethodsRecord = {},
  EventsT = {},
> {
  name: string
  initialState: () => StateT
  events?: EventsOptions<StateT, EventsT>
  actions?: {
    [key in keyof ActionsT]: Action<StateT, EventsT, ActionsT[key]>
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyArgs = any[]

type EventsOptions<StateT, EventsT> = {
  [k in keyof EventsT]: (
    this: {
      state: StateT
    },
    event: IEvent<EventsT[k]>,
  ) => void
}

export type GetAggregateTypes<AggregateDefinitionT> =
  AggregateDefinitionT extends AggregateDefinition<
    infer StateT,
    infer ActionsT,
    infer EventsT
  >
    ? [StateT, ActionsT, EventsT]
    : [{}, {}, {}]

export type GetAggregateInstance<AggregateDefinitionT> =
  AggregateDefinitionT extends AggregateDefinition<
    infer StateT,
    infer ActionsT,
    infer EventsT
  >
    ? ReturnType<AggregateDefinition<StateT, ActionsT, EventsT>['create']>
    : never

export type GetAggregateState<AggregateDefinitionT> =
  GetAggregateTypes<AggregateDefinitionT>[0]

export type GetAggregateActions<AggregateDefinitionT> =
  GetAggregateTypes<AggregateDefinitionT>[1]

export type GetAggregateEvents<AggregateDefinitionT> =
  GetAggregateTypes<AggregateDefinitionT>[2]

export type GetAggregateEventNames<AggregateDefinitionT> =
  keyof GetAggregateTypes<AggregateDefinitionT>[2]

export type GetAggregateOptions<AggregateDefinitionT> =
  AggregateDefinitionT extends AggregateDefinition<
    infer StateT,
    infer ActionsT,
    infer EventsT
  >
    ? AggregateOptions<StateT, ActionsT, EventsT>
    : never

export interface IAggregateEvent<EventsT, NameT extends keyof EventsT> {
  name: NameT
  payload: EventsT[NameT]
  occuredAt: number
  version: number
}

export type AggregateEvent<EventsT> = {
  [NameT in keyof EventsT]: IAggregateEvent<EventsT, NameT>
}[keyof EventsT]

export type AggregateEventsByDefinition<DefinitionT> = AggregateEvent<
  GetAggregateEvents<DefinitionT>
>

export interface IEvent<PayloadT = unknown> {
  name: string
  payload: PayloadT
}

export interface ISnapshot<StateT> {
  version: number
  state: StateT
}

export type MethodsRecord = {
  [k in string]: AnyArgs
}
