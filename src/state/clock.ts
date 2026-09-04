// Les passages échus doivent rejoindre l’historique même si l’écran reste ouvert.
import { useEffect, useState } from 'react';

export function useNow(): Date {
    const [now, setNow] = useState(() => new Date());
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 30_000);
        return () => clearInterval(timer);
    }, []);
    return now;
}
