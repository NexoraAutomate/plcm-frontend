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
}

function generateDeleteCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  destructive = true,
}: ConfirmDialogProps) {
  const [confirmationCode, setConfirmationCode] = useState("");
  const [userInput, setUserInput] = useState("");

  useEffect(() => {
    if (open && destructive) {
      setConfirmationCode(generateDeleteCode());
      setUserInput("");
    }
  }, [open, destructive]);

  const codeMatches = userInput === confirmationCode;

  const handleConfirm = () => {
    if (destructive && !codeMatches) return;
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
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button
            variant={destructive ? "destructive" : "default"}
            disabled={destructive && !codeMatches}
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
