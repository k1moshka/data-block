import getPath from 'lodash/get'

import { Block } from '../block'
import { createFieldReducer } from '../createFieldReducer'
import { createHandler } from '../handler'
import { value } from '../reducers'
import composeHandlers from '../composeHandlers'

describe('Block rendering', () => {
  test('do values setups immediately while processing new value from scheme', () => {
    const fn = jest.fn(() => { return 1 })
    const block = Block({
      a: {
        b: value([]),
        c: value(fn)
      }
    })
    const instance = block()
    const result = instance()

    expect(fn.mock.calls[0][0]).toEqual({
      a: expect.objectContaining({ b: [] })
    })
    expect(result).toEqual({ a: { b: [], c: 1 } })
  })

  test('Block renders properly', () => {
    const block = Block({
      a: 1,
      b: () => 'static_result',
      c: {
        d: true
      },
      e: value('initial')
    })

    const initialValue = block()()
    expect(initialValue).toEqual({
      a: 1,
      b: 'static_result',
      c: {
        d: true
      },
      e: 'initial'
    })
  })

  test('Block initial value renders properly', () => {
    const result = Block({ a: value(1) })({ a: 2 })()
    expect(result).toEqual({ a: 2 })
  })
})

describe('reducing new value with arrays', () => {
  test('should override reference values', () => {
    const block = Block({
      a: value(),
    })
    const instance = block()

    instance({ a: [1, 2, 3, 4] })
    const result = instance({ a: [77] })


    expect(result).toEqual({ a: [77] })
  })

  test('should override reference values in nested objects', () => {
    const block = Block({
      a: {
        b: value()
      },
    })
    const instance = block()

    instance({ a: { b: [1, 2, 3, 4] } })
    const result = instance({ a: { b: [77] } })

    expect(result).toEqual({ a: { b: [77] } })
  })

  test('should override reference values in nested blocks', () => {
    const block = Block({
      a: Block({
        b: value()
      })
    })
    const instance = block()

    instance({ a: { b: [1, 2, 3] } })
    const result = instance({ a: { b: [44] } })

    expect(result).toEqual({ a: { b: [44] }})
  })
})

describe('Block updating', () => {
  test('Block update works properly', () => {
    const reducerFn = jest.fn((value, oldValue, path) => getPath(value, path))
    const block = Block({ a: createFieldReducer(reducerFn) })

    const instance = block()
    let result = instance()
    expect(result).toEqual({ a: undefined })

    result = instance({ a: 16 })
    expect(result).toEqual({ a: 16 })
    expect(reducerFn.mock.calls[1][0]).toEqual({ a: 16 }) // newValue
    expect(reducerFn.mock.calls[1][1]).toEqual({ a: undefined }) // oldValue
    expect(reducerFn.mock.calls[1][2]).toBe('a') // path
  })

  test('Block update nested data-blocks properly', () => {
    const block = Block({ a: Block({ b: value(1) }) })
    const instance = block()
    const initial = instance()
    const result = instance({ a: { b: 2 } })

    expect(initial).toEqual({ a: { b: 1 } })
    expect(result).toEqual({ a: { b: 2 } })
  })

  test('Block update nested blocks properly', () => {
    const block = Block({ a: Block({ b: value(1) }) })
    const instance = block()
    const initial = instance()
    const result = instance({ a: { b: 2 } })

    expect(initial).toEqual({ a: { b: 1 } })
    expect(result).toEqual({ a: { b: 2 } })
  })
})

describe('Block instance options', () => {
  test('Block handleUpdate works well', () => {
    const block = Block({
      a: value(1),
      b: value(2)
    })

    const fn = jest.fn(() => {})
    const instance = block(undefined, {
      handleUpdate: fn
    })

    instance()
    expect(fn.mock.calls.length).toBe(0)

    instance({ a: 2 })
    expect(fn.mock.calls.length).toBe(1)
    expect(fn.mock.calls[0][0]).toEqual({ a: 2, b: 2 })

    instance({ a: 2 })
    expect(fn.mock.calls.length).toBe(2)
    expect(fn.mock.calls[0][0]).toEqual({ a: 2, b: 2 })
  })
})

describe('Block handler', () => {
  test('Block handler works properly', () => {
    const fn = jest.fn(() => {})
    const block = Block({
      a: value(1),
      b: value(2)
    }, createHandler(fn))

    const instance = block()
    expect(fn.mock.calls.length).toBe(0)

    instance()
    expect(fn.mock.calls.length).toBe(1)

    instance()
    expect(fn.mock.calls.length).toBe(2)


    instance({ a: 3 })
    expect(fn.mock.calls.length).toBe(3)
    expect(fn.mock.calls[2][0]).toEqual({ a: 3, b: 2 }) // newValue
    expect(fn.mock.calls[2][2]).toEqual({ a: 1, b: 2 }) // oldValue
  })

  test('Block handler sync update works properly', () => {
    const block = Block({
      a: value(1),
      b: value(2)
    }, createHandler(({ a }, update) => {
      if (a === 3) {
        update({ a: 4, b: 100 })
      }
    }))

    const fn = jest.fn(() => { })
    const instance = block(undefined, { handleUpdate: fn })
    instance()

    const result = instance({ a: 3 }) // will update immediately and return new value
    expect(result).toEqual({ a: 4, b: 100 })
    expect(fn.mock.calls[0][0]).toEqual({ a: 4, b: 100 })

    const result2 = instance({ a: 5 })
    expect(result2).toEqual({ a: 5, b: 100 })
  })


  test('Block handler async update works properly', async () => {
    await new Promise((resolve) => {
      let updated = false
      const block = Block({
        a: value(1),
        b: value(2)
      }, createHandler(({ a }, update) => {
        if (a === 3) {
          setTimeout(() => { updated = true; update({ a: 4, b: 100 }) }, 1000)
        }
      }))

      const fn = jest.fn(({ a }) => { if (a === 4 && updated) { resolve() } })
      const instance = block(undefined, { handleUpdate: fn })
      instance()

      const result = instance({ a: 3 }) // here we run async update in handler
      expect(result).toEqual({ a: 3, b: 2 })
      expect(fn.mock.calls[0][0]).toEqual({ a: 3, b: 2 })

      const result2 = instance({ a: 5 })
      expect(result2).toEqual({ a: 5, b: 2 })
    })
  })

  test('does async update pass valid values to handlers', () => {
    return new Promise(resolve => {
      const fn = jest.fn(async (value, update) => {
        if (value.a === 1 && !value.l) {
          const state1 = update({ l: true })
          expect(state1).toEqual({ a: 1, l: true })

          const a = await new Promise(r => {
            setTimeout(() => {
              r(2)
            }, 100)
          })

          const state2 = update({ a })
          expect(state2).toEqual({ a: 2, l: true })

          const a2 = await new Promise(r => {
            setTimeout(() => {
              r(3)
            }, 100)
          })

          const state3 = update({ a: a2 })
          expect(state3).toEqual({ a: 3, l: true })
        }

        if (value.a === 3) {
          expect(fn.mock.calls.length).toBe(4)
          expect(fn.mock.calls[0][0]).toEqual({ a: 1, l: false }) // value
          expect(fn.mock.calls[0][2]).toBe(undefined) // oldValue


          expect(fn.mock.calls[1][0]).toEqual({ a: 1, l: true })
          expect(fn.mock.calls[1][2]).toEqual({ a: 1, l: false })


          expect(fn.mock.calls[2][0]).toEqual({ a: 2, l: true })
          expect(fn.mock.calls[2][2]).toEqual({ a: 1, l: true })


          expect(fn.mock.calls[3][0]).toEqual({ a: 3, l: true })
          expect(fn.mock.calls[3][2]).toEqual({ a: 2, l: true })

          resolve()
        }
      })
      const block = Block({
        a: value(1),
        l: value(false)
      }, composeHandlers(fn)
      )

      const instance = block()
      instance()
    })
  })


  test('Nested block handler works properly', () => {
    const fn = jest.fn(() => {})
    const ctxBlock = Block({
      a: value(1),
      b: value(2)
    }, createHandler(fn))
    const block = Block({
      ctx: ctxBlock
    })

    const instance = block()
    expect(fn.mock.calls.length).toBe(0)

    instance()
    expect(fn.mock.calls.length).toBe(1)

    instance()
    expect(fn.mock.calls.length).toBe(2)


    const result = instance({ ctx: { a: 3 } })
    expect(result).toEqual({ ctx: { a: 3, b: 2 } })
    expect(fn.mock.calls.length).toBe(3)
    expect(fn.mock.calls[2][0]).toEqual({ a: 3, b: 2 }) // newValue
    expect(fn.mock.calls[2][2]).toEqual({ a: 1, b: 2 }) // oldValue
  })

  test('Nested block handler can update the whole block', () => {
    const ctxBlock = Block({
      a: value(1),
      b: value(2)
    }, createHandler(({ a }, update) => {
      if (a === 3) {
        update({ a: 4, b: 100 })
      }
    }))

    const block = Block({
      ctx: ctxBlock
    })

    const instance = block()
    instance()
    instance({ ctx: { a: 2 } })
    const result = instance({ ctx: { a: 3 } })

    expect(result).toEqual({ ctx: { a: 4, b: 100 } })
  })

  // TODO: implement it
  // test('Really deep nested blocks with updates', () => {
  // })

})
