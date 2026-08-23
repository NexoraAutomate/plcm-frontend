'use client';

import { useCallback, useState } from 'react';
import { toPng } from 'html-to-image';
import { Panel, useReactFlow, getNodesBounds, getViewportForBounds } from '@xyflow/react';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

const IMAGE_WIDTH = 1920;
const IMAGE_HEIGHT = 1080;

/**
 * Download flow as PNG (https://reactflow.dev/examples/misc/download-image).
 */
export function ConfigTreeDownloadButton() {
  const { getNodes } = useReactFlow();
  const [busy, setBusy] = useState(false);

  const onClick = useCallback(async () => {
    setBusy(true);
    try {
      const nodes = getNodes();
      if (nodes.length === 0) {
        toast.error('Nothing to export');
        return;
      }

      const nodesBounds = getNodesBounds(nodes);
      const viewport = getViewportForBounds(
        nodesBounds,
        IMAGE_WIDTH,
        IMAGE_HEIGHT,
        0.5,
        2,
        0.2
      );

      const viewportEl = document.querySelector(
        '.react-flow__viewport'
      ) as HTMLElement | null;
      if (!viewportEl) {
        toast.error('Could not find flow viewport');
        return;
      }

      const dataUrl = await toPng(viewportEl, {
        backgroundColor: '#ffffff',
        width: IMAGE_WIDTH,
        height: IMAGE_HEIGHT,
        style: {
          width: `${IMAGE_WIDTH}px`,
          height: `${IMAGE_HEIGHT}px`,
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
        },
      });

      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `hierarchy-config-${Date.now()}.png`;
      a.click();
      toast.success('Image downloaded');
    } catch (err) {
      console.error(err);
      toast.error('Failed to export image');
    } finally {
      setBusy(false);
    }
  }, [getNodes]);

  return (
    <Panel position="bottom-right">
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="h-8 shadow"
        disabled={busy}
        onClick={() => void onClick()}
      >
        <Download className="mr-1.5 h-3.5 w-3.5" />
        {busy ? 'Exporting…' : 'Download image'}
      </Button>
    </Panel>
  );
}
