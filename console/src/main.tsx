import { render } from 'preact';
import './styles.css';

export const CONSOLE_VERSION = '0.1.0';

function App() {
  return <div className="p-8 text-slate-900">Tidio Remake Console v{CONSOLE_VERSION}</div>;
}

const root = document.getElementById('app');
if (root) render(<App />, root);
