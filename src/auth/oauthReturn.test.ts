import { expect, test } from 'vitest'
import { oauthRedirectUrl, parseOAuthReturn, withoutOAuthReturn } from './oauthReturn'

const APP = 'https://user.github.io/gym-tracker/'

test('the redirect is the app root on any origin, including a LAN dev server', () => {
  expect(oauthRedirectUrl('https://user.github.io', '/gym-tracker/')).toBe(APP)
  expect(oauthRedirectUrl('http://localhost:5173', '/gym-tracker/')).toBe('http://localhost:5173/gym-tracker/')
  expect(oauthRedirectUrl('http://192.168.1.20:5199', '/gym-tracker/')).toBe('http://192.168.1.20:5199/gym-tracker/')
})

test('a plain page load, with or without a route, is not a return', () => {
  expect(parseOAuthReturn(APP)).toBeNull()
  expect(parseOAuthReturn(`${APP}#/plans/3`)).toBeNull()
  expect(parseOAuthReturn(`${APP}?utm=1#/login`)).toBeNull()
})

test('the PKCE return carries the code and the flow id from the query', () => {
  expect(parseOAuthReturn(`${APP}?sb_flow_id=abc123&code=the-code`)).toEqual({ code: 'the-code', flowId: 'abc123' })
  expect(parseOAuthReturn(`${APP}?code=the-code`)).toEqual({ code: 'the-code', flowId: undefined })
})

test('a refusal is read from the query', () => {
  const href = `${APP}?error=access_denied&error_code=signup_disabled&error_description=Signups+not+allowed+for+this+instance`
  expect(parseOAuthReturn(href)).toEqual({ error: { message: 'Signups not allowed for this instance', code: 'signup_disabled' } })
})

test('a refusal is also read from the hash, which would otherwise be taken for a route', () => {
  const href = `${APP}#error=access_denied&error_code=signup_disabled&error_description=Signups%20not%20allowed`
  expect(parseOAuthReturn(href)).toEqual({ error: { message: 'Signups not allowed', code: 'signup_disabled' } })
})

test('an error without a description falls back to its name', () => {
  expect(parseOAuthReturn(`${APP}?error=server_error`)).toEqual({ error: { message: 'server_error', code: undefined } })
})

test('an error wins over a code', () => {
  expect(parseOAuthReturn(`${APP}?code=x&error=access_denied`)).toMatchObject({ error: { message: 'access_denied' } })
})

test('the return parameters are stripped and the route and other parameters are kept', () => {
  expect(withoutOAuthReturn(`${APP}?sb_flow_id=abc&code=x`)).toBe(APP)
  expect(withoutOAuthReturn(`${APP}?error=access_denied&error_code=c&error_description=d#error=access_denied&x=1`)).toBe(APP)
  expect(withoutOAuthReturn(`${APP}?code=x&utm=1#/plans/3`)).toBe(`${APP}?utm=1#/plans/3`)
})
