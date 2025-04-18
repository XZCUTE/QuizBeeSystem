import { createContext, useContext } from "react"
import { io } from "socket.io-client"

// You can use environment variables in Vite with import.meta.env
const WEBSOCKET_URL = import.meta.env.VITE_WEBSOCKET_URL || "http://localhost:3001"

export const socket = io(WEBSOCKET_URL, {
  transports: ["websocket"],
})

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
