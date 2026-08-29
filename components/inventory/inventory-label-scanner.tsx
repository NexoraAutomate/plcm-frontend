'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Camera, Keyboard, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface DetectedCode {
  rawValue?: string;
}

interface Detector {
  detect(source: HTMLVideoElement): Promise<DetectedCode[]>;
}

interface DetectorConstructor {
  new (options?: { formats?: string[] }): Detector;
  getSupportedFormats?: () => Promise<string[]>;
}

interface ScannerProps {
  onDetected: (payload: string) => void;
}

export function InventoryLabelScanner({ onDetected }: ScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const [manualPayload, setManualPayload] = useState('');
  const [cameraState, setCameraState] = useState<'idle' | 'starting' | 'ready' | 'unsupported' | 'denied'>('idle');

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function startCamera() {
    const DetectorClass = (window as unknown as { BarcodeDetector?: DetectorConstructor }).BarcodeDetector;
    if (!DetectorClass || !navigator.mediaDevices?.getUserMedia) {
      setCameraState('unsupported');
      return;
    }
    setCameraState('starting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setCameraState('ready');
      const detector = new DetectorClass({
        formats: ['qr_code', 'code_128', 'code_39', 'code_93', 'data_matrix'],
      });
      const detect = async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) {
          frameRef.current = requestAnimationFrame(() => void detect());
          return;
        }
        try {
          const results = await detector.detect(videoRef.current);
          const payload = results[0]?.rawValue?.trim();
          if (payload) {
            onDetected(payload);
            streamRef.current?.getTracks().forEach((track) => track.stop());
            return;
          }
        } catch {
          // Camera can briefly fail while focus/exposure changes.
        }
        frameRef.current = requestAnimationFrame(() => void detect());
      };
      frameRef.current = requestAnimationFrame(() => void detect());
    } catch {
      setCameraState('denied');
    }
  }

  function submitManual(event: FormEvent) {
    event.preventDefault();
    const payload = manualPayload.trim();
    if (payload) onDetected(payload);
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-lg border bg-black">
        <video ref={videoRef} className="aspect-video w-full object-cover" muted playsInline />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => void startCamera()} disabled={cameraState === 'starting' || cameraState === 'ready'}>
          {cameraState === 'starting' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
          {cameraState === 'ready' ? 'Camera active' : 'Use camera'}
        </Button>
        {cameraState === 'unsupported' ? (
          <span className="text-sm text-muted-foreground">This browser does not support camera barcode detection. Enter the code manually.</span>
        ) : null}
        {cameraState === 'denied' ? (
          <span className="text-sm text-destructive">Camera permission was denied. Enter the code manually or enable camera access.</span>
        ) : null}
      </div>
      <form onSubmit={submitManual} className="space-y-2">
        <Label htmlFor="label-payload">
          <Keyboard className="mr-1 inline h-3.5 w-3.5" />
          Label payload
        </Label>
        <div className="flex gap-2">
          <Input
            id="label-payload"
            value={manualPayload}
            onChange={(event) => setManualPayload(event.target.value)}
            placeholder="PLCM1.…"
            autoComplete="off"
          />
          <Button type="submit">Resolve</Button>
        </div>
      </form>
    </div>
  );
}
