import './style.css';
import { GameManager } from './core/GameManager';

const container = document.getElementById('app')!;
const gm = new GameManager(container);
gm.start();
