/* Native modules that have no JS implementation under Jest. Each is mocked so
   importing a screen that uses it renders in the test environment. */

// AsyncStorage v3 ships no jest mock — a tiny in-memory store is enough for the
// wizard's offline queue, which only get/set/removes one JSON key.
jest.mock('@react-native-async-storage/async-storage', () => {
  let store = {}
  return {
    getItem: jest.fn((k) => Promise.resolve(k in store ? store[k] : null)),
    setItem: jest.fn((k, v) => { store[k] = v; return Promise.resolve() }),
    removeItem: jest.fn((k) => { delete store[k]; return Promise.resolve() }),
    clear: jest.fn(() => { store = {}; return Promise.resolve() }),
  }
})

// NetInfo ships an official mock.
jest.mock('@react-native-community/netinfo', () =>
  require('@react-native-community/netinfo/jest/netinfo-mock.js'),
)

// The Razorpay SDK is only require()d inside a pay handler, but stub it so any
// eager resolution in a test cannot fail on the unlinked native module.
jest.mock('react-native-razorpay', () => ({ default: { open: jest.fn(() => Promise.resolve({})) } }), { virtual: true })
