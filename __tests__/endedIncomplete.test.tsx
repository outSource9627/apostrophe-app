/**
 * 6.3 — a session that ended below the completion threshold waits for an admin. The Ended screen says so:
 * it must not tell the student their paid interview "still stands" (the credit is spent) or offer a booking
 * that needs a credit they do not have; and once an admin has decided, it hands over to the interview screen.
 */
import React from 'react'
import { Text } from 'react-native'
import ReactTestRenderer, { act } from 'react-test-renderer'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { EndedScreen } from '../src/screens/room/EndedScreen'

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))
const mockGet = jest.fn()
jest.mock('../src/lib/api/interviews', () => ({ getInterview: () => mockGet() }))

async function render(iv: Record<string, unknown>) {
  mockGet.mockResolvedValue({ id: 'iv1', ...iv })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const onDetail = jest.fn()
  let tree!: ReactTestRenderer.ReactTestRenderer
  await act(async () => {
    tree = ReactTestRenderer.create(
      <QueryClientProvider client={client}>
        <EndedScreen id="iv1" onBack={jest.fn()} onDetail={onDetail} />
      </QueryClientProvider>,
    )
  })
  for (let i = 0; i < 20 && tree.root.findAllByType(Text).length === 0; i++) {
    await act(async () => { await new Promise<void>((r) => setTimeout(() => r(), 10)) })
  }
  return { texts: tree.root.findAllByType(Text).map((t) => [t.props.children].flat().join('')), onDetail }
}

describe('EndedScreen after a session below the completion threshold', () => {
  it('INCOMPLETE: says it is under review, promises nothing it cannot give, and offers no booking', async () => {
    const { texts, onDetail } = await render({ status: 'INCOMPLETE' })
    expect(texts).toContain('Your interview is under review.')
    const all = texts.join(' ')
    expect(all).toMatch(/reviewing what happened/)
    expect(all).not.toMatch(/still stands/)
    expect(texts).not.toContain('Book the rest of it')
    expect(texts).toContain('Back to my interviews')
    expect(onDetail).not.toHaveBeenCalled()
  })

  it('once an admin has decided, it hands over to the interview screen, which tells the story and what is owed', async () => {
    const { onDetail } = await render({ status: 'INTERVIEWER_NO_SHOW', reviewedAs: 'INTERVIEWER_NO_SHOW' })
    expect(onDetail).toHaveBeenCalled()
  })

  it('COMPLETED is unchanged', async () => {
    const { texts } = await render({ status: 'COMPLETED' })
    expect(texts).toContain('Your video is being made.')
  })
})
