import { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './useAuth';
import { getUserFromStorage } from '../utils/auth.utils';

const SESSION_TIMEOUT_MS = 60 * 60 * 1000; // 60 minute în milisecunde

/**
 * Hook pentru gestionarea timeout-ului de sesiune
 * Deloghează automat utilizatorul după 60 de minute de inactivitate
 */
export const useSessionTimeout = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  // Funcție pentru resetarea timer-ului
  const resetTimer = useCallback(() => {
    // Șterge timer-ul existent
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Verifică dacă utilizatorul este logat
    const user = getUserFromStorage();
    if (!user) {
      return; // Nu face nimic dacă nu e logat
    }

    // Actualizează ultima activitate
    lastActivityRef.current = Date.now();

    // Setează un nou timer
    timeoutRef.current = setTimeout(async () => {
      const timeSinceLastActivity = Date.now() - lastActivityRef.current;
      
      // Verifică din nou dacă utilizatorul este încă logat
      const currentUser = getUserFromStorage();
      if (!currentUser) {
        return; // Utilizatorul s-a delogat deja
      }

      // Verifică dacă a trecut suficient timp (60 minute)
      if (timeSinceLastActivity >= SESSION_TIMEOUT_MS) {
        console.log('⏰ Sesiunea a expirat din cauza inactivității (60 minute)');
        
        try {
          await logout();
          navigate('/', { replace: true });
          
          // Opțional: afișează un mesaj utilizatorului
          alert('Sesiunea a expirat din cauza inactivității. Te rugăm să te autentifici din nou.');
        } catch (error) {
          console.error('Eroare la delogare automată:', error);
          // Navighează oricum către login chiar dacă logout-ul eșuează
          navigate('/', { replace: true });
        }
      }
    }, SESSION_TIMEOUT_MS);
  }, [logout, navigate]);

  // Funcție pentru gestionarea activității utilizatorului
  const handleActivity = useCallback(() => {
    resetTimer();
  }, [resetTimer]);

  // Setează event listeners pentru activitatea utilizatorului
  useEffect(() => {
    // Verifică dacă utilizatorul este logat
    const user = getUserFromStorage();
    if (!user) {
      return; // Nu setează timer dacă nu e logat
    }

    // Resetează timer-ul la mount
    resetTimer();

    // Evenimente care indică activitate
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    // Adaugă event listeners
    events.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    // Cleanup
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      events.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
    };
  }, [resetTimer, handleActivity]);

  // Verifică periodic dacă sesiunea a expirat (pentru cazurile în care timer-ul nu funcționează corect)
  useEffect(() => {
    const user = getUserFromStorage();
    if (!user) {
      return;
    }

    const checkInterval = setInterval(() => {
      const timeSinceLastActivity = Date.now() - lastActivityRef.current;
      const currentUser = getUserFromStorage();
      
      if (currentUser && timeSinceLastActivity >= SESSION_TIMEOUT_MS) {
        console.log('⏰ Sesiunea a expirat - verificare periodică');
        clearInterval(checkInterval);
        logout().then(() => {
          navigate('/', { replace: true });
          alert('Sesiunea a expirat din cauza inactivității. Te rugăm să te autentifici din nou.');
        }).catch(() => {
          navigate('/', { replace: true });
        });
      }
    }, 60000); // Verifică la fiecare minut

    return () => {
      clearInterval(checkInterval);
    };
  }, [logout, navigate]);
};

