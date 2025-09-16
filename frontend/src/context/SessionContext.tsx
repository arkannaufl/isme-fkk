import { createContext, useContext, useState, ReactNode } from 'react';

interface SessionContextType {
  isSessionExpired: boolean;
  setSessionExpired: (value: boolean) => void;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [isSessionExpired, setSessionExpired] = useState(false);

  return (
    <SessionContext.Provider value={{ isSessionExpired, setSessionExpired }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
} 
