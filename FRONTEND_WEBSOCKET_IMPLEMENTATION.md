# Frontend WebSocket Implementation Guide

## Backend WebSocket Setup (Already Done)
The backend is configured with Socket.IO server that emits the following events:
- `client:created` - When a new client is created
- `client:updated` - When a client is updated

Events are sent to counsellor-specific rooms: `counsellor:${counsellorId}`

## Frontend Implementation Steps

### 1. Install Dependencies
```bash
npm install socket.io-client
```

### 2. Create WebSocket Service/Context

Create a file: `src/services/socketService.ts` or `src/contexts/SocketContext.tsx`

**Option A: Service File (Simple)**
```typescript
import { io, Socket } from 'socket.io-client';

class SocketService {
  private socket: Socket | null = null;
  private counsellorId: number | null = null;

  connect(counsellorId: number) {
    if (this.socket?.connected) {
      // Already connected, just join room
      this.socket.emit('join:counsellor', counsellorId);
      this.counsellorId = counsellorId;
      return;
    }

    // Connect to backend WebSocket server
    this.socket = io('http://localhost:5000', {
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });

    this.socket.on('connect', () => {
      console.log('✅ Connected to WebSocket server');
      if (counsellorId) {
        this.socket?.emit('join:counsellor', counsellorId);
        this.counsellorId = counsellorId;
      }
    });

    this.socket.on('disconnect', () => {
      console.log('❌ Disconnected from WebSocket server');
    });

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
    });
  }

  disconnect() {
    if (this.counsellorId) {
      this.socket?.emit('leave:counsellor', this.counsellorId);
    }
    this.socket?.disconnect();
    this.socket = null;
    this.counsellorId = null;
  }

  onClientCreated(callback: (data: any) => void) {
    this.socket?.on('client:created', callback);
  }

  onClientUpdated(callback: (data: any) => void) {
    this.socket?.on('client:updated', callback);
  }

  offClientCreated(callback: (data: any) => void) {
    this.socket?.off('client:created', callback);
  }

  offClientUpdated(callback: (data: any) => void) {
    this.socket?.off('client:updated', callback);
  }

  getSocket() {
    return this.socket;
  }
}

export const socketService = new SocketService();
```

**Option B: React Context (Recommended for React)**
```typescript
// src/contexts/SocketContext.tsx
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  connect: (counsellorId: number) => void;
  disconnect: () => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const connect = (counsellorId: number) => {
    if (socket?.connected) {
      socket.emit('join:counsellor', counsellorId);
      return;
    }

    const newSocket = io('http://localhost:5000', {
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });

    newSocket.on('connect', () => {
      console.log('✅ Connected to WebSocket');
      setIsConnected(true);
      newSocket.emit('join:counsellor', counsellorId);
    });

    newSocket.on('disconnect', () => {
      console.log('❌ Disconnected from WebSocket');
      setIsConnected(false);
    });

    setSocket(newSocket);
  };

  const disconnect = () => {
    if (socket) {
      socket.disconnect();
      setSocket(null);
      setIsConnected(false);
    }
  };

  useEffect(() => {
    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [socket]);

  return (
    <SocketContext.Provider value={{ socket, isConnected, connect, disconnect }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within SocketProvider');
  }
  return context;
};
```

### 3. Integrate with Client List Component

In your client list component (e.g., `Clients.tsx` or `ClientList.tsx`):

```typescript
import { useEffect, useState } from 'react';
import { socketService } from '../services/socketService';
// OR if using Context:
// import { useSocket } from '../contexts/SocketContext';

const ClientsPage = () => {
  const [clients, setClients] = useState([]);
  const counsellorId = /* Get from auth context or props */;

  // Fetch initial clients
  useEffect(() => {
    fetchClients();
  }, []);

  // Setup WebSocket connection and listeners
  useEffect(() => {
    if (!counsellorId) return;

    // Connect to WebSocket
    socketService.connect(counsellorId);

    // Handle new client created
    const handleClientCreated = (data: any) => {
      console.log('New client created:', data);
      // Update clients list with new data
      setClients(data.clients); // Backend sends full updated list
      // OR if you prefer to append:
      // setClients(prev => [...prev, data.client]);

      // Show notification/toast if needed
      // toast.success('New client added!');
    };

    // Handle client updated
    const handleClientUpdated = (data: any) => {
      console.log('Client updated:', data);
      // Update clients list
      setClients(data.clients); // Backend sends full updated list
      // OR if you prefer to update specific client:
      // setClients(prev => prev.map(c =>
      //   c.clientId === data.client.clientId ? data.client : c
      // ));

      // Show notification/toast if needed
      // toast.success('Client updated!');
    };

    // Register event listeners
    socketService.onClientCreated(handleClientCreated);
    socketService.onClientUpdated(handleClientUpdated);

    // Cleanup on unmount
    return () => {
      socketService.offClientCreated(handleClientCreated);
      socketService.offClientUpdated(handleClientUpdated);
      socketService.disconnect();
    };
  }, [counsellorId]);

  const fetchClients = async () => {
    try {
      const response = await fetch('/api/clients/counsellor-clients', {
        credentials: 'include',
      });
      const result = await response.json();
      if (result.success) {
        setClients(result.data);
      }
    } catch (error) {
      console.error('Error fetching clients:', error);
    }
  };

  return (
    <div>
      {/* Your client list UI */}
    </div>
  );
};
```

### 4. Update App.tsx (if using Context)

```typescript
import { SocketProvider } from './contexts/SocketContext';

function App() {
  return (
    <SocketProvider>
      {/* Your app components */}
    </SocketProvider>
  );
}
```

### 5. Environment Configuration

Update your `.env` or config file:
```env
VITE_API_URL=http://localhost:5000
```

Then use in socket connection:
```typescript
const newSocket = io(import.meta.env.VITE_API_URL, {
  withCredentials: true,
  transports: ['websocket', 'polling'],
});
```

## Event Data Structure

When backend emits events, you'll receive:

**client:created / client:updated:**
```typescript
{
  action: "CREATED" | "UPDATED",
  client: {
    clientId: number,
    fullName: string,
    enrollmentDate: string,
    saleTypeId: number,
    leadTypeId: number,
    // ... other client fields
  },
  clients: {
    // Full grouped client list (same format as GET /api/clients/counsellor-clients)
    "2026": {
      "Jan": {
        clients: [...],
        total: 5
      }
    }
  }
}
```

## Important Notes

1. **Connection Management**: Connect when user logs in, disconnect on logout
2. **Room Joining**: Join counsellor room after connection is established
3. **Error Handling**: Handle connection errors gracefully
4. **Reconnection**: Socket.IO handles reconnection automatically
5. **Cleanup**: Always remove event listeners and disconnect on component unmount
6. **CORS**: Backend is configured to allow credentials, ensure frontend sends credentials

## Testing

1. Open two browser windows/tabs
2. Login as the same counsellor in both
3. Create a client in one window
4. The client should appear instantly in the other window without refresh

## Troubleshooting

- **Connection fails**: Check backend is running and CORS is configured
- **Events not received**: Verify counsellorId is correct and room join was successful
- **Multiple connections**: Ensure you disconnect before creating new connection
- **Check browser console**: Look for WebSocket connection logs
