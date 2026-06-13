import { useState, useCallback } from 'react';
import { useEffect } from 'react';
import Particles from './Particles';
import OnboardingScreen from './OnboardingScreen';
import GameScreen from './GameScreen';
import { registerToastHandler, ToastType } from './lib/toast';

interface ToastMsg { id: number; msg: string; type: ToastType; }

export default function App() {
  const [screen, setScreen] = useState<'onboarding' | 'game'>('onboarding');
  const [username, setUsername] = useState('');
  const [toasts, setToasts] = useState<ToastMsg[]>([]);

  const addToast = useCallback((msg: string, type: ToastType) => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3100);
  }, []);

  useEffect(() => { registerToastHandler(addToast); }, [addToast]);

  const onStart = (name: string) => {
    setUsername(name);
    setScreen('game');
  };

  return (
    <>
      <Particles />
      <div id="toasts">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type}`}>{t.msg}</div>
        ))}
      </div>

      {screen === 'onboarding' && (
        <OnboardingScreen onStart={onStart} />
      )}
      {screen === 'game' && (
        <GameScreen
          username={username}
          onBack={() => setScreen('onboarding')}
        />
      )}
    </>
  );
}
