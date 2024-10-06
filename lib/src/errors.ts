export class ModddelError extends Error {}

export class InstanceDoesNotExistError extends ModddelError {
  constructor() {
    super(
      'Instance does not exist. It was disposed or not created in a proper way.',
    )
  }
}

export class ConcurrencyError extends ModddelError {
  constructor() {
    super('Concurrency error')
  }
}
