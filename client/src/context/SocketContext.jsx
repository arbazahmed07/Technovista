import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext();

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (user && isAuthenticated) {
      const token = localStorage.getItem('token');
      if (token) {
        console.log('Attempting to connect with token:', token ? 'Token present' : 'No token');
        
        const newSocket = io('http://localhost:5000', {
          auth: {
            token
          },
          withCredentials: true,
          transports: ['websocket', 'polling'],
          timeout: 20000,
          forceNew: true
        });

        newSocket.on('connect', () => {
          console.log('Successfully connected to server');
          setIsConnected(true);
        });

        newSocket.on('disconnect', (reason) => {
          console.log('Disconnected from server:', reason);
          setIsConnected(false);
        });

        newSocket.on('connect_error', (error) => {
          console.error('Connection error:', error.message);
          setIsConnected(false);
          
          // If authentication error, try to refresh the user
          if (error.message.includes('Authentication error')) {
            console.log('Authentication error detected, token might be invalid');
          }
        });

        newSocket.on('reconnect', (attemptNumber) => {
          console.log('Reconnected after', attemptNumber, 'attempts');
        });

        newSocket.on('reconnect_error', (error) => {
          console.error('Reconnection error:', error.message);
        });

        setSocket(newSocket);

        return () => {
          console.log('Cleaning up socket connection');
          newSocket.close();
        };
      } else {
        console.log('No token found, cannot connect to socket');
      }
    } else {
      if (socket) {
        console.log('User not authenticated, closing socket connection');
        socket.close();
        setSocket(null);
        setIsConnected(false);
      }
    }
  }, [user, isAuthenticated]);

  const value = {
    socket,
    isConnected
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};