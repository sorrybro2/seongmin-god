import { createRoot } from 'react-dom/client';
import App from './App';
import { AskProvider } from './components/ui';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <AskProvider>
    <App />
  </AskProvider>,
);
