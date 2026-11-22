// Test double for the minimal supabase query-builder surface the data layer uses. No network.

export type Op = 'select' | 'insert' | 'update' | 'delete' | 'upsert'
export type Filter = [method: string, column: string, value: unknown]

/** The user every fake session belongs to. */
export const FAKE_USER_ID = 'user-1'

export interface Call {
  table: string
  op: Op
  payload?: unknown
  options?: unknown
  columns?: string
  filters: Filter[]
  /** Value of the `owner_id` equality filter, kept apart from `filters` so tests state only what they add; undefined when the query is not scoped. */
  ownerId?: unknown
  orders: { column: string; ascending: boolean }[]
  limit?: number
  range?: [from: number, to: number]
  mode: 'many' | 'single' | 'maybeSingle'
}

export interface FakeResult {
  data?: unknown
  error?: { message: string; code: string } | null
}

type Handler = (call: Call) => FakeResult | undefined

class FakeBuilder implements PromiseLike<{ data: unknown; error: unknown }> {
  private readonly call: Call

  constructor(
    table: string,
    private readonly log: Call[],
    private readonly handler: Handler,
  ) {
    this.call = { table, op: 'select', filters: [], orders: [], mode: 'many' }
  }

  select(columns = '*', options?: unknown) {
    // select() after a write only picks the returned columns.
    if (this.call.op === 'select') this.call.options = options
    this.call.columns = columns
    return this
  }

  insert(payload: unknown) {
    return this.write('insert', payload)
  }

  update(payload: unknown) {
    return this.write('update', payload)
  }

  upsert(payload: unknown, options?: unknown) {
    this.call.options = options
    return this.write('upsert', payload)
  }

  delete() {
    return this.write('delete')
  }

  eq(column: string, value: unknown) {
    if (column === 'owner_id') {
      this.call.ownerId = value
      return this
    }
    return this.filter('eq', column, value)
  }

  neq(column: string, value: unknown) {
    return this.filter('neq', column, value)
  }

  in(column: string, value: unknown[]) {
    return this.filter('in', column, value)
  }

  gte(column: string, value: unknown) {
    return this.filter('gte', column, value)
  }

  lte(column: string, value: unknown) {
    return this.filter('lte', column, value)
  }

  is(column: string, value: unknown) {
    return this.filter('is', column, value)
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.call.orders.push({ column, ascending: options?.ascending ?? true })
    return this
  }

  limit(count: number) {
    this.call.limit = count
    return this
  }

  range(from: number, to: number) {
    this.call.range = [from, to]
    return this
  }

  single() {
    this.call.mode = 'single'
    return this
  }

  maybeSingle() {
    this.call.mode = 'maybeSingle'
    return this
  }

  then<A, B>(
    onFulfilled?: ((value: { data: unknown; error: unknown }) => A | PromiseLike<A>) | null,
    onRejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    this.log.push(this.call)
    const result = this.handler(this.call) ?? {}
    return Promise.resolve({ data: result.data ?? null, error: result.error ?? null }).then(onFulfilled, onRejected)
  }

  private write(op: Op, payload?: unknown) {
    this.call.op = op
    this.call.payload = payload
    return this
  }

  private filter(method: string, column: string, value: unknown) {
    this.call.filters.push([method, column, value])
    return this
  }
}

/** Shared fake client: tests call `reset(handler)` in `beforeEach` and inspect `calls`. */
export const fakeSupabase = {
  calls: [] as Call[],
  handler: (() => undefined) as Handler,
  /** Who is signed in; null makes `auth.getSession` report no session. */
  userId: FAKE_USER_ID as string | null,
  sessionError: null as { message: string; code?: string } | null,

  reset(handler: Handler = () => undefined) {
    this.calls = []
    this.handler = handler
    this.userId = FAKE_USER_ID
    this.sessionError = null
  },

  auth: {
    async getSession() {
      const { userId, sessionError } = fakeSupabase
      if (sessionError) return { data: { session: null }, error: sessionError }
      return { data: { session: userId ? { user: { id: userId } } : null }, error: null }
    },
  },

  from(table: string) {
    return new FakeBuilder(table, this.calls, (call) => this.handler(call))
  },
}
