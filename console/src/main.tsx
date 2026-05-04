import { render } from 'preact';
import { App } from './App.js';
import './styles.css';

export const CONSOLE_VERSION = '0.1.0';

const root = document.getElementById('app');
if (root) render(<App />, root);
