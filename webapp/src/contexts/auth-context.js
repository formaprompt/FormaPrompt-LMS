import { createContext } from 'react';

export const AuthContext = createContext({
  user: null,
  role: null,
  loading: true,
  sessionExpired: false,
  signOut: async () => {},
});
