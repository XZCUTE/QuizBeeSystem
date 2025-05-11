import { createContext, useContext } from "react"
// Removing actual socket.io client import
// import { io } from "socket.io-client"

// Create a mock socket object that doesn't attempt to connect
const createMockSocket = () => {
  // Create a mock socket with all the methods but no actual connection
  return {
    // Basic socket.io client methods
    connect: () => console.log("Mock socket connect called"),
    disconnect: () => console.log("Mock socket disconnect called"),
    emit: (event, ...args) => console.log(`Mock socket emit: ${event}`, args),
    on: (event, callback) => console.log(`Mock socket registered event: ${event}`),
    off: (event) => console.log(`Mock socket unregistered event: ${event}`),
    once: (event, callback) => console.log(`Mock socket registered once event: ${event}`),
    // Add any other socket methods your app is using
    id: "mock-socket-id",
    connected: false
  }
}

// Use the mock socket instead of a real connection
export const socket = createMockSocket()

export const SocketContext = createContext(socket)

export const SocketContextProvider = ({ children }) => {
  return (
    <SocketContext.Provider value={{ socket }}>
      {children}
    </SocketContext.Provider>
  )
}

export function useSocketContext() {
  const context = useContext(SocketContext)
  if (!context) {
    throw new Error("useSocketContext must be used within a SocketContextProvider")
  }
  return context
}
