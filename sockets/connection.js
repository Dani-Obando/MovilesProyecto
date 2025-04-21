let socket = null;

export function getSocket() {
  if (!socket || socket.readyState === 3) {
    socket = new WebSocket("ws://192.168.100.5:5000");
  }
  return socket;
}
