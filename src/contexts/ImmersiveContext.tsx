import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface ImmersiveContextType {
  isImmersive: boolean;
  toggleImmersive: () => void;
}

const ImmersiveContext = createContext<ImmersiveContextType | undefined>(undefined);

export function ImmersiveProvider({ children }: { children: ReactNode }) {
  const [isImmersive, setIsImmersive] = useState(() => {
    return true;
  });

  useEffect(() => {
    localStorage.setItem('immersiveMode', String(isImmersive));
  }, [isImmersive]);

  const toggleImmersive = () => {
    setIsImmersive(prev => !prev);
  };

  return (
    <ImmersiveContext.Provider value={{ isImmersive, toggleImmersive }}>
      {children}
    </ImmersiveContext.Provider>
  );
}

export function useImmersive() {
  const context = useContext(ImmersiveContext);
  if (!context) {
    throw new Error('useImmersive must be used within ImmersiveProvider');
  }
  return context;
}
