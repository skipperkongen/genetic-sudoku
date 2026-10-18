// Generates puzzles off the main thread; hard puzzles can take a second or two to find.
import { generateLevel } from './difficulty.js';

self.onmessage = ({ data }) => {
  self.postMessage({ id: data.id, ...generateLevel(data.level) });
};
