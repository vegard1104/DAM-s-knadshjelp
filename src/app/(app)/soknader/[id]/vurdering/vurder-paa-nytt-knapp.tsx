"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { vurderSoknadAction } from "../actions";

export function VurderPaaNyttKnapp({ soknadId }: { soknadId: string }) {
  const router = useRouter();
  const [arbeider, startArbeid] = useTransition();
  const [feil, setFeil] = useState<string | null>(null);

  function utfor() {
    setFeil(null);
    startArbeid(async () => {
      const resultat = await vurderSoknadAction(soknadId);
      if (!resultat.ok) {
        setFeil(resultat.feil);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="primary"
        size="md"
        onClick={utfor}
        disabled={arbeider}
      >
        <Sparkles className={arbeider ? "h-4 w-4 animate-pulse" : "h-4 w-4"} />
        {arbeider ? "Vurderer …" : "Vurder på nytt"}
      </Button>
      {feil && (
        <span className="text-[11.5px] text-cp-red">{feil}</span>
      )}
    </div>
  );
}
