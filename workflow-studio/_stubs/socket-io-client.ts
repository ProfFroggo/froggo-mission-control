/** socket.io-client stub — WebSocket client not used in local mode. */
export interface Socket {
  id: string
  connected: boolean
  on(event: string, callback: (...args: any[]) => void): Socket
  off(event: string, callback?: (...args: any[]) => void): Socket
  emit(event: string, ...args: any[]): Socket
  connect(): Socket
  disconnect(): Socket
}

const noopSocket: Socket = {
  id: '',
  connected: false,
  on() { return noopSocket },
  off() { return noopSocket },
  emit() { return noopSocket },
  connect() { return noopSocket },
  disconnect() { return noopSocket },
}

export function io(_url?: string, _opts?: any): Socket {
  return noopSocket
}

export default io
