import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

/**
 * Este ficheiro inicializa a aplicação React.
 * Ele importa o componente principal './App.jsx' e renderiza-o no HTML.
 * Certifique-se de que o ficheiro App.jsx está na mesma pasta 'src'.
 */

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}