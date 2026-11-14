import { mkdir, cp, writeFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = path.join(root, 'frontend/public/models/face_landmarker.task');
await mkdir(path.dirname(target), { recursive: true });
await cp(
  path.join(root, 'frontend/node_modules/@mediapipe/tasks-vision/wasm'),
  path.join(root, 'frontend/public/wasm'),
  { recursive: true },
);
try {
  if ((await stat(target)).size > 1000000) {
    console.log('Local face model and WASM ready.');
    process.exit(0);
  }
} catch {}
const url =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const response = await fetch(url);
if (!response.ok) throw new Error(`Model download failed: ${response.status}`);
await writeFile(target, Buffer.from(await response.arrayBuffer()));
console.log('Downloaded the official MediaPipe face landmarker model. All inference is local.');
