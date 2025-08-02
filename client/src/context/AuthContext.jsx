import React, { createContext, useContext, useReducer, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

// Helper function to set auth token
const setAuthToken = (token) => {
  if (token) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    localStorage.setItem('token', token);
  } else {
    delete axios.defaults.headers.common['Authorization'];
    localStorage.removeItem('token');
  }
};

const authReducer = (state, action) => {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: true };
    case 'USER_LOADED':
      return {
        ...state,
        isAuthenticated: true,
        loading: false,
        user: action.payload,
      };
    case 'LOGIN_SUCCESS':
    case 'SIGNUP_SUCCESS':
      return {
        ...state,
        isAuthenticated: true,
        loading: false,
        user: action.payload.user,
        token: action.payload.token,
      };
    case 'LOGIN_FAIL':
    case 'LOGOUT':
    case 'AUTH_ERROR':
      localStorage.removeItem('token');
      setAuthToken(null);
      return {
        ...state,
        token: null,
        isAuthenticated: false,
        loading: false,
        user: null,
      };
    default:
      return state;
  }
};

export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, {
    token: localStorage.getItem('token'),
    isAuthenticated: false,
    loading: true,
    user: null,
  });

  // Load user from token on app start
  const loadUser = async () => {
    const token = localStorage.getItem('token');
    
    if (token) {
      setAuthToken(token);
      
      try {
        const res = await axios.get('https://technovista.onrender.com/api/auth/me');
        
        dispatch({
          type: 'USER_LOADED',
          payload: res.data.user,
        });
      } catch (err) {
        console.error('Load user error:', err);
        dispatch({ type: 'AUTH_ERROR' });
      }
    } else {
      dispatch({ type: 'AUTH_ERROR' });
    }
  };

  // Login
  const login = async (email, password) => {
    dispatch({ type: 'SET_LOADING' });
    
    try {
      const res = await axios.post('https://technovista.onrender.com/api/auth/login', {
        email,
        password,
      });

      if (res.data.success) {
        dispatch({
          type: 'LOGIN_SUCCESS',
          payload: res.data,
        });

        setAuthToken(res.data.token);
        
        return { success: true };
      } else {
        throw new Error('Login failed');
      }
    } catch (err) {
      console.error('Login error:', err);
      
      dispatch({ type: 'LOGIN_FAIL' });
      
      return { 
        success: false, 
        message: err.response?.data?.message || 'Login failed. Please check your credentials.' 
      };
    }
  };

  // Signup
  const signup = async (name, email, password) => {
    dispatch({ type: 'SET_LOADING' });
    
    try {
      const res = await axios.post('https://technovista.onrender.com/api/auth/signup', {
        name,
        email,
        password,
      });

      dispatch({
        type: 'SIGNUP_SUCCESS',
        payload: res.data,
      });

      setAuthToken(res.data.token);
      
      return { success: true };
    } catch (err) {
      dispatch({ type: 'LOGIN_FAIL' });
      return { 
        success: false, 
        message: err.response?.data?.message || 'Signup failed' 
      };
    }
  };

  // Logout
  const logout = () => {
    dispatch({ type: 'LOGOUT' });
  };

  useEffect(() => {
    loadUser();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        token: state.token,
        isAuthenticated: state.isAuthenticated,
        loading: state.loading,
        user: state.user,
        login,
        signup,
        logout,
        loadUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
