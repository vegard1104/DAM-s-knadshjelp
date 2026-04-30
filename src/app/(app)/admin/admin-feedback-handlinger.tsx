"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Eye, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { oppdaterFeedbackStatusAction } from "@/app/(app)/soknader/[id]/feedback-actions";
import type { FeedbackAdminStatus } from "@/types/database";

export function AdminFeedbackHandlinger({
  feedbackId,
  naverende,
  notat,
}: {
  feedbackId: string;
  naverende: FeedbackAdminStatus;
  notat: string | null;
}) {
  const router = useRouter();
  const [arbeider, startArbeid] = useTransition();
  const [feil, setFeil] = useState<string | null>(null);
  const [redigerNotat, setRedigerNotat] = useState(false);
  const [notatTekst, setNotatTekst] = useState(notat ?? "");

  function settStatus(status: FeedbackAdminStatus) {
    setFeil(null);
    startArbeid(async () => {
      const r = await oppdaterFeedbackStatusAction({
        feedbackId,
        nyStatus: status,
        notat: notatTekst || undefined,
      });
      if (!r.ok) {
        setFeil(r.feil);
        return;
      }
      setRedigerNotat(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      {redigerNotat ? (
        <div className="space-y-2">
          <textarea
            rows={2}
            value={notatTekst}
            onChange={(e) => setNotatTekst(e.target.value)}
            placeholder="Notat (valgfritt) — f.eks. «implementert i ekspress-system-v3»"
            className="w-full rounded-md border border-line-1 bg-white px-2.5 py-1.5 text-[12px] focus:outline-none focus:ring-[3px] focus:ring-cp-blue/15 focus:border-cp-blue"
            autoFocus
          />
          <div className="flex gap-1.5 justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setRedigerNotat(false)}
              disabled={arbeider}
            >
              Avbryt
            </Button>
          </div>
        </div>
      ) : notat ? (
        <div className="rounded-md bg-warning-soft/40 border border-warning/20 px-3 py-2 text-[12px] text-ink-3 italic">
          <span className="font-semibold not-italic text-ink-2">Notat: </span>
          {notat}
          <button
            type="button"
            onClick={() => setRedigerNotat(true)}
            className="ml-2 text-cp-blue hover:underline not-italic font-medium"
          >
            endre
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setRedigerNotat(true)}
          className="inline-flex items-center gap-1 text-[11.5px] text-ink-4 hover:text-ink-1"
        >
          <MessageSquare className="h-3 w-3" />
          Legg til notat
        </button>
      )}

      <div className="flex items-center justify-end gap-2 pt-2 border-t border-line-2">
        {feil && (
          <span className="text-[11.5px] text-cp-red font-medium mr-auto">
            {feil}
          </span>
        )}

        {naverende !== "behandlet" && naverende !== "implementert" && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => settStatus("behandlet")}
            disabled={arbeider}
          >
            <Eye className="h-3.5 w-3.5" />
            Marker behandlet
          </Button>
        )}

        {naverende !== "avvist" && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => settStatus("avvist")}
            disabled={arbeider}
          >
            <X className="h-3.5 w-3.5" />
            Avvis
          </Button>
        )}

        {naverende !== "implementert" && (
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => settStatus("implementert")}
            disabled={arbeider}
          >
            <Check className="h-3.5 w-3.5" />
            Implementer
          </Button>
        )}

        {naverende === "implementert" && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => settStatus("ny")}
            disabled={arbeider}
          >
            Tilbake til kø
          </Button>
        )}
      </div>
    </div>
  );
}
