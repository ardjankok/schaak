// Web Worker: de computer denkt hier na, zodat het scherm niet bevriest.
import { handleRequest } from './engine.js';

self.onmessage = (event) => self.postMessage(handleRequest(event.data));
