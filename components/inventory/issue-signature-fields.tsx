'use client';

import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SignaturePad } from '@/components/inventory/signature-pad';

export type SignatureKind = 'DIGITAL' | 'HARD_COPY';

type Props = {
  signatureType: SignatureKind;
  onSignatureTypeChange: (value: SignatureKind) => void;
  digitalPayload: string;
  onDigitalPayloadChange: (value: string) => void;
  hardCopyAck: boolean;
  onHardCopyAckChange: (value: boolean) => void;
  disabled?: boolean;
};

export function IssueSignatureFields({
  signatureType,
  onSignatureTypeChange,
  digitalPayload,
  onDigitalPayloadChange,
  hardCopyAck,
  onHardCopyAckChange,
  disabled,
}: Props) {
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>Signature</Label>
        <Select
          value={signatureType}
          onValueChange={(value) => onSignatureTypeChange(value as SignatureKind)}
          disabled={disabled}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="DIGITAL">Digital signature</SelectItem>
            <SelectItem value="HARD_COPY">Hard copy confirmed</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {signatureType === 'DIGITAL' ? (
        <SignaturePad
          value={digitalPayload}
          onChange={onDigitalPayloadChange}
          disabled={disabled}
        />
      ) : (
        <label className="flex items-start gap-2 text-sm">
          <Checkbox
            checked={hardCopyAck}
            onCheckedChange={(checked) => onHardCopyAckChange(checked === true)}
            disabled={disabled}
          />
          <span>I confirm a signed hard-copy issue sheet is on file.</span>
        </label>
      )}
    </div>
  );
}

export function useIssueSignature() {
  const [signatureType, setSignatureType] = useState<SignatureKind>('DIGITAL');
  const [digitalPayload, setDigitalPayload] = useState('');
  const [hardCopyAck, setHardCopyAck] = useState(false);

  function reset() {
    setSignatureType('DIGITAL');
    setDigitalPayload('');
    setHardCopyAck(false);
  }

  function payload(): { signature_type: SignatureKind; signature_payload: string } | null {
    if (signatureType === 'DIGITAL') {
      if (!digitalPayload) return null;
      return { signature_type: 'DIGITAL', signature_payload: digitalPayload };
    }
    if (!hardCopyAck) return null;
    return { signature_type: 'HARD_COPY', signature_payload: 'HARD_COPY_CONFIRMED' };
  }

  return {
    signatureType,
    setSignatureType,
    digitalPayload,
    setDigitalPayload,
    hardCopyAck,
    setHardCopyAck,
    reset,
    payload,
  };
}
