"use client";

import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  onConfirm: () => void;
  destructive?: boolean;
  /** When set (with optional acceptedValues), user must type a matching value instead of a random code. */
  confirmValue?: string;
  /** Alternate values that also count as a match (e.g. any serial on a multi-unit item). */
  acceptedValues?: string[];
  confirmPrompt?: string;
  confirmInputLabel?: string;
  confirmPlaceholder?: string;
}

function generateDeleteCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function normalizeConfirmInput(value: string): string {
  return value.trim();
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  destructive = true,
  confirmValue,
  acceptedValues,
  confirmPrompt,
  confirmInputLabel,
  confirmPlaceholder,
}: ConfirmDialogProps) {
  const [confirmationCode, setConfirmationCode] = useState("");
  const [userInput, setUserInput] = useState("");

  const expectedValues = (acceptedValues?.length
    ? acceptedValues
    : confirmValue
      ? [confirmValue]
      : []
  )
    .map(normalizeConfirmInput)
    .filter(Boolean);

  const usesValueConfirm = expectedValues.length > 0;

  useEffect(() => {
    if (open && destructive) {
      if (!usesValueConfirm) {
        setConfirmationCode(generateDeleteCode());
      }
      setUserInput("");
    }
  }, [open, destructive, usesValueConfirm]);

  const codeMatches = userInput === confirmationCode;
  const valueMatches = expectedValues.some(
    (value) => normalizeConfirmInput(userInput) === value
  );
  const canConfirm = usesValueConfirm ? valueMatches : codeMatches;

  const handleConfirm = () => {
    if (destructive && !canConfirm) return;
    onConfirm();
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-foreground">{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {destructive && (
          <div className="space-y-2">
            {usesValueConfirm ? (
              <>
                <p className="text-sm text-muted-foreground">
                  {confirmPrompt ??
                    (expectedValues.length > 1
                      ? "To confirm deletion, type one of the serial numbers for this item:"
                      : "To confirm deletion, type the serial number:")}
                </p>
                {expectedValues.length === 1 && (
                  <p className="text-center text-lg font-mono font-semibold tracking-wide break-all">
                    {expectedValues[0]}
                  </p>
                )}
                {expectedValues.length > 1 && (
                  <ul className="max-h-32 overflow-y-auto rounded-md border px-3 py-2 text-sm font-mono space-y-1">
                    {expectedValues.map((serial) => (
                      <li key={serial}>{serial}</li>
                    ))}
                  </ul>
                )}
                <div className="space-y-1">
                  <Label htmlFor="delete-confirmation-value">
                    {confirmInputLabel ?? "Serial number"}
                  </Label>
                  <Input
                    id="delete-confirmation-value"
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    placeholder={confirmPlaceholder ?? "Enter serial number"}
                    autoComplete="off"
                  />
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  To confirm deletion, type the following code:
                </p>
                <p className="text-center text-2xl font-mono font-bold tracking-widest">
                  {confirmationCode}
                </p>
                <div className="space-y-1">
                  <Label htmlFor="delete-confirmation-code">Confirmation code</Label>
                  <Input
                    id="delete-confirmation-code"
                    value={userInput}
                    onChange={(e) =>
                      setUserInput(e.target.value.replace(/\D/g, "").slice(0, 4))
                    }
                    placeholder="Enter the 4-digit code"
                    inputMode="numeric"
                    autoComplete="off"
                  />
                </div>
              </>
            )}
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button
            variant={destructive ? "destructive" : "default"}
            disabled={destructive && !canConfirm}
            onClick={handleConfirm}
            className={
              destructive ? "bg-destructive text-emerald-50 hover:bg-destructive/90" : ""
            }
          >
            {destructive ? "Delete" : "Confirm"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
