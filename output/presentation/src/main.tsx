import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/bricolage-grotesque';
import '@fontsource-variable/figtree';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/600.css';
import './styles.css';
import { Deck } from './Deck.tsx';

const root = document.getElementById('root');
if (!root) throw new Error('Élément racine introuvable.');

createRoot(root).render(
    <StrictMode>
        <Deck />
    </StrictMode>,
);
