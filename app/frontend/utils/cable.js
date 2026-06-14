import { createConsumer } from "@rails/actioncable"

// Single shared ActionCable consumer for the whole app. Each hook used to call
// createConsumer("/cable") on its own, opening a separate WebSocket connection
// per hook — a page with match + standings + live-scores hooks held 3 sockets.
// Sharing one consumer means one connection multiplexing all subscriptions.
let consumer = null

export function getConsumer() {
  if (!consumer) consumer = createConsumer("/cable")
  return consumer
}
