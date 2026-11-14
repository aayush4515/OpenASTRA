import { useEffect, useRef, useState } from 'react';
import { Camera as CameraIcon, CameraOff, ScanFace, ShieldCheck } from 'lucide-react';
import type { FaceLandmarker, NormalizedLandmark } from '@mediapipe/tasks-vision';
import type { FacialCapture } from '../services/types';
import { Badge, ErrorBox } from '../components/UI';
type Sample = { features: Record<string, number>; quality: Record<string, number> };
const dist = (a: NormalizedLandmark, b: NormalizedLandmark) => Math.hypot(a.x - b.x, a.y - b.y);
export function extractFeatures(p: NormalizedLandmark[]): Record<string, number> {
  const width = dist(p[234], p[454]);
  return {
    left_eye: (dist(p[159], p[145]) + dist(p[158], p[153])) / (2 * dist(p[33], p[133])),
    right_eye: (dist(p[386], p[374]) + dist(p[385], p[380])) / (2 * dist(p[362], p[263])),
    mouth_tilt: (p[291].y - p[61].y) / width,
    brow_height: (dist(p[105], p[159]) + dist(p[334], p[386])) / (2 * width),
    asymmetry: Math.abs(dist(p[1], p[234]) - dist(p[1], p[454])) / width,
  };
}
export function qualityOK(q: Record<string, number>) {
  return (
    q.brightness >= 50 &&
    q.brightness <= 220 &&
    Math.abs(q.yaw) <= 0.13 &&
    Math.abs(q.roll) <= 0.12 &&
    q.face_size >= 0.22 &&
    q.face_size <= 0.72 &&
    q.stability <= 0.045 &&
    q.frames >= 8
  );
}
export default function Camera({
  onCapture,
  onSkip,
}: {
  onCapture: (c: FacialCapture) => void;
  onSkip?: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const stream = useRef<MediaStream>();
  const model = useRef<FaceLandmarker>();
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const generation = useRef(0);
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('Camera is off. Your identity will be confirmed manually.');
  const [consent, setConsent] = useState(false);
  const [capture, setCapture] = useState<Sample>();
  const stop = () => {
    generation.current++;
    clearTimeout(timer.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = undefined;
    model.current?.close();
    model.current = undefined;
    if (video.current) video.current.srcObject = null;
    setRunning(false);
    setBusy(false);
    setCapture(undefined);
    setStatus('Camera stopped. No images were saved.');
  };
  useEffect(
    () => () => {
      generation.current++;
      clearTimeout(timer.current);
      stream.current?.getTracks().forEach((t) => t.stop());
      model.current?.close();
    },
    [],
  );
  async function start() {
    stop();
    const token = ++generation.current;
    setError('');
    setBusy(true);
    setStatus('Loading local face model…');
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error(
          'Webcam access is unavailable. Use localhost or HTTPS, or continue without camera.',
        );
      const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
      const vision = await FilesetResolver.forVisionTasks('/wasm');
      const detector = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: '/models/face_landmarker.task', delegate: 'CPU' },
        runningMode: 'VIDEO',
        numFaces: 2,
        minFaceDetectionConfidence: 0.65,
        minFacePresenceConfidence: 0.65,
        minTrackingConfidence: 0.65,
      });
      if (token !== generation.current) {
        detector.close();
        return;
      }
      model.current = detector;
      const media = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false,
      });
      if (token !== generation.current) {
        media.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = media;
      const v = video.current!;
      v.srcObject = media;
      await v.play();
      if (token !== generation.current) return;
      setRunning(true);
      setBusy(false);
      const samples: Sample[] = [];
      let lastVideo = -1;
      const process = () => {
        if (token !== generation.current) return;
        try {
          if (v.readyState >= 2 && v.currentTime !== lastVideo) {
            lastVideo = v.currentTime;
            const result = detector.detectForVideo(v, performance.now());
            const ctx = canvas.current?.getContext('2d');
            if (ctx) {
              canvas.current!.width = v.videoWidth;
              canvas.current!.height = v.videoHeight;
              ctx.clearRect(0, 0, v.videoWidth, v.videoHeight);
            }
            if (result.faceLandmarks.length !== 1) {
              samples.length = 0;
              setCapture(undefined);
              setStatus(
                result.faceLandmarks.length
                  ? 'More than one face detected. Use the station alone.'
                  : 'No face detected. Face the camera in even lighting.',
              );
            } else {
              const p = result.faceLandmarks[0];
              const features = extractFeatures(p);
              const tiny = document.createElement('canvas');
              tiny.width = 32;
              tiny.height = 32;
              const tc = tiny.getContext('2d')!;
              tc.drawImage(v, 0, 0, 32, 32);
              const pixels = tc.getImageData(0, 0, 32, 32).data;
              let sum = 0;
              for (let i = 0; i < pixels.length; i += 4)
                sum += (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
              const width = dist(p[234], p[454]);
              const q = {
                brightness: sum / 1024,
                yaw: (p[1].x - (p[234].x + p[454].x) / 2) / width,
                roll: (p[263].y - p[33].y) / dist(p[33], p[263]),
                face_size: width,
                stability: 0,
                frames: 1,
              };
              samples.push({ features, quality: q });
              if (samples.length > 10) samples.shift();
              const averaged: Sample = { features: {}, quality: { ...q, frames: samples.length } };
              for (const key of Object.keys(features))
                averaged.features[key] =
                  samples.reduce((s, x) => s + x.features[key], 0) / samples.length;
              averaged.quality.stability =
                Math.max(...samples.map((s) => s.features.left_eye)) -
                Math.min(...samples.map((s) => s.features.left_eye));
              setCapture(averaged);
              setStatus(
                qualityOK(averaged.quality)
                  ? 'One face detected · capture quality accepted'
                  : 'Hold still, face forward and adjust lighting or camera distance.',
              );
              if (ctx) {
                ctx.fillStyle = '#76f6db';
                for (let i = 0; i < p.length; i += 3) {
                  ctx.beginPath();
                  ctx.arc(p[i].x * v.videoWidth, p[i].y * v.videoHeight, 1.5, 0, Math.PI * 2);
                  ctx.fill();
                }
              }
            }
          }
          timer.current = setTimeout(process, 120);
        } catch (e) {
          stop();
          setError(e instanceof Error ? e.message : 'Local camera processing failed');
        }
      };
      process();
    } catch (e) {
      if (token === generation.current) {
        stop();
        const message = e instanceof Error ? e.message : String(e);
        setError(
          message.includes('Permission') || message.includes('denied')
            ? 'Camera permission was denied. You can continue with manual identity confirmation.'
            : message + ' Camera analysis is optional; confirm identity manually to continue.',
        );
      }
    }
  }
  return (
    <div className="camera-module">
      <div className="camera-viewport">
        <video ref={video} playsInline muted />
        <canvas ref={canvas} />
        {!running && (
          <div className="camera-placeholder">
            <ScanFace size={42} />
            <span>Local optical assessment</span>
            <small>Images never leave this browser</small>
          </div>
        )}
        <div className="camera-corners" />
        <Badge tone={capture && qualityOK(capture.quality) ? 'green' : 'neutral'}>
          {running ? 'LIVE CAMERA' : 'CAMERA OFF'}
        </Badge>
      </div>
      <p role="status" className="camera-status">
        {status}
      </p>
      {error && <ErrorBox message={error} />}
      <div className="button-row">
        {!running ? (
          <button onClick={start} disabled={busy} className="button secondary">
            <CameraIcon size={16} />
            {busy ? 'Preparing camera…' : 'Enable camera'}
          </button>
        ) : (
          <button onClick={stop} className="button secondary">
            <CameraOff size={16} />
            Stop camera
          </button>
        )}
        {onSkip && (
          <button
            onClick={() => {
              stop();
              onSkip();
            }}
            className="button quiet"
          >
            Continue without camera
          </button>
        )}
      </div>
      {capture && (
        <div className="capture-values">
          <span>
            Left eye <b>{capture.features.left_eye.toFixed(3)}</b>
          </span>
          <span>
            Right eye <b>{capture.features.right_eye.toFixed(3)}</b>
          </span>
          <span>
            Frames <b>{capture.quality.frames}</b>
          </span>
          <span>
            Lighting <b>{capture.quality.brightness.toFixed(0)}/255</b>
          </span>
        </div>
      )}
      <label className="consent">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>
          I consent to storing landmark-derived measurements locally. No raw images or face identity
          template will be saved.
        </span>
      </label>
      <button
        className="button primary full"
        disabled={!capture || !qualityOK(capture.quality) || !consent}
        onClick={() => {
          const data: FacialCapture = { ...capture!, source: 'live_camera', consent: true };
          stop();
          onCapture(data);
        }}
      >
        <ShieldCheck size={16} /> Save facial measurements
      </button>
      <small className="camera-limit">
        Face detection does not verify identity. Geometry can change with pose, expression and
        lighting; it cannot diagnose a condition.
      </small>
    </div>
  );
}
