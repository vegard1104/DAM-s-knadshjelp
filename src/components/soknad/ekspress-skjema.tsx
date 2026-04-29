"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TextareaFelt } from "./textarea-felt";
import { TekstFelt } from "./tekst-felt";
import { TallFelt } from "./tall-felt";
import { DatoFelt } from "./dato-felt";
import { ValgFelt } from "./valg-felt";
import { BudsjettFelt, type Budsjett } from "./budsjett-felt";
import { EKSPRESS_FELTER } from "@/types/ekspress-felter";

/**
 * Hele Ekspress-skjemaet. Setter sammen alle felt-komponentene og
 * holder skjema-state. Lagring skjer via Server Action.
 */

export type EkspressFelterVerdier = Record<string, unknown>;

const TOM_BUDSJETT: Budsjett = {
  rader: [{ type: "utgift", post: "", belop: null }],
};

export function EkspressSkjema({
  initielleVerdier,
  initiellSoknadssum,
  initiellOppstart,
  initiellAvslutt,
  lagreKladdAction,
}: {
  initielleVerdier?: EkspressFelterVerdier;
  initiellSoknadssum?: number | null;
  initiellOppstart?: string | null;
  initiellAvslutt?: string | null;
  lagreKladdAction: (data: {
    tittel: string;
    felter: EkspressFelterVerdier;
    soknadssum_kr: number | null;
    totalbudsjett_kr: number | null;
    oppstart_dato: string | null;
    avslutt_dato: string | null;
  }) => Promise<{ ok: true; soknadId: string } | { ok: false; feil: string }>;
}) {
  const router = useRouter();
  const [verdier, setVerdier] = useState<EkspressFelterVerdier>(
    initielleVerdier ?? {},
  );
  const [soknadssum, setSoknadssum] = useState<number | null>(
    initiellSoknadssum ?? null,
  );
  const [oppstart, setOppstart] = useState<string | null>(
    initiellOppstart ?? null,
  );
  const [avslutt, setAvslutt] = useState<string | null>(
    initiellAvslutt ?? null,
  );
  const [lagrer, startLagring] = useTransition();
  const [feilmelding, setFeilmelding] = useState<string | null>(null);
  const [sukkesmelding, setSuksessmelding] = useState<string | null>(null);

  function settFelt(id: string, verdi: unknown) {
    setVerdier((forrige) => ({ ...forrige, [id]: verdi }));
  }

  function getFelt<T>(id: string, fallback: T): T {
    return (verdier[id] as T) ?? fallback;
  }

  const budsjett = getFelt<Budsjett>("3.3_budsjett", TOM_BUDSJETT);
  const totalbudsjett = budsjett.rader
    .filter((r) => r.type === "utgift")
    .reduce((sum, r) => sum + (r.belop ?? 0), 0);

  function handleLagreKladd() {
    setFeilmelding(null);
    setSuksessmelding(null);

    const tittel = (getFelt("prosjektnavn", "") as string).trim();
    if (!tittel) {
      setFeilmelding("Prosjektnavn må fylles inn før kladd kan lagres.");
      return;
    }

    // Synkroniser de utvalgte filter-feltene
    settFelt("3.1_oppstart", oppstart);
    settFelt("3.1_avslutt", avslutt);

    const sammenslaatte = {
      ...verdier,
      "3.1_oppstart": oppstart,
      "3.1_avslutt": avslutt,
      soknadssum_kr: soknadssum,
    };

    startLagring(async () => {
      const resultat = await lagreKladdAction({
        tittel,
        felter: sammenslaatte,
        soknadssum_kr: soknadssum,
        totalbudsjett_kr: totalbudsjett > 0 ? totalbudsjett : null,
        oppstart_dato: oppstart,
        avslutt_dato: avslutt,
      });

      if (!resultat.ok) {
        setFeilmelding(resultat.feil);
        return;
      }

      setSuksessmelding("Kladden er lagret.");
      router.push(`/soknader/${resultat.soknadId}`);
    });
  }

  // Grupper felt etter seksjon
  const seksjonsmap = new Map<string, typeof EKSPRESS_FELTER>();
  for (const felt of EKSPRESS_FELTER) {
    const eksisterende = seksjonsmap.get(felt.seksjon) ?? [];
    eksisterende.push(felt);
    seksjonsmap.set(felt.seksjon, eksisterende);
  }

  return (
    <form
      className="space-y-8"
      onSubmit={(e) => {
        e.preventDefault();
        handleLagreKladd();
      }}
    >
      {/* Hver seksjon */}
      {Array.from(seksjonsmap.entries()).map(([seksjon, felt]) => (
        <section
          key={seksjon}
          className="rounded-[10px] border border-line-1 bg-bg-card p-6 space-y-5"
        >
          <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-ink-1 border-b border-line-2 pb-3">
            {seksjon}
          </h2>

          {felt.map((f) => {
            // Spesialtilfelle: oppstart/avslutt har egne kolonner
            if (f.id === "3.1_oppstart") {
              return (
                <DatoFelt
                  key={f.id}
                  feltId={f.id}
                  navn={f.navn}
                  hjelpetekst={f.hjelpetekst}
                  pakrevd={f.pakrevd}
                  verdi={oppstart}
                  onChange={setOppstart}
                />
              );
            }
            if (f.id === "3.1_avslutt") {
              return (
                <DatoFelt
                  key={f.id}
                  feltId={f.id}
                  navn={f.navn}
                  hjelpetekst={f.hjelpetekst}
                  pakrevd={f.pakrevd}
                  verdi={avslutt}
                  onChange={setAvslutt}
                  min={oppstart ?? undefined}
                />
              );
            }
            if (f.id === "3.3_budsjett") {
              return (
                <BudsjettFelt
                  key={f.id}
                  feltId={f.id}
                  hjelpetekst={f.hjelpetekst}
                  budsjett={budsjett}
                  soknadssum={soknadssum}
                  onBudsjettChange={(b) => settFelt("3.3_budsjett", b)}
                  onSoknadssumChange={setSoknadssum}
                />
              );
            }

            // Generisk dispatcher per type
            switch (f.type) {
              case "kort_tekst":
                return (
                  <TekstFelt
                    key={f.id}
                    feltId={f.id === "prosjektnavn" ? "" : f.id}
                    navn={f.navn}
                    hjelpetekst={f.hjelpetekst}
                    tegngrense={f.tegngrense}
                    pakrevd={f.pakrevd}
                    verdi={getFelt(f.id, "")}
                    onChange={(v) => settFelt(f.id, v)}
                  />
                );
              case "tekst":
                return (
                  <TextareaFelt
                    key={f.id}
                    feltId={f.id}
                    navn={f.navn}
                    hjelpetekst={f.hjelpetekst}
                    tegngrense={f.tegngrense ?? 1000}
                    pakrevd={f.pakrevd}
                    verdi={getFelt(f.id, "")}
                    onChange={(v) => settFelt(f.id, v)}
                    rader={f.tegngrense && f.tegngrense > 500 ? 6 : 3}
                  />
                );
              case "tall":
                return (
                  <TallFelt
                    key={f.id}
                    feltId={f.id}
                    navn={f.navn}
                    hjelpetekst={f.hjelpetekst}
                    pakrevd={f.pakrevd}
                    verdi={getFelt(f.id, null)}
                    onChange={(v) => settFelt(f.id, v)}
                  />
                );
              case "valg_flere":
                return (
                  <ValgFelt
                    key={f.id}
                    feltId={f.id}
                    navn={f.navn}
                    hjelpetekst={f.hjelpetekst}
                    pakrevd={f.pakrevd}
                    valgteKoder={getFelt<string[]>(f.id, [])}
                    valg={f.valg ?? []}
                    maksValg={f.maksValg}
                    onChange={(v) => settFelt(f.id, v)}
                  />
                );
              default:
                return null;
            }
          })}
        </section>
      ))}

      {/* Footer med knapper og meldinger */}
      <div className="sticky bottom-4 z-10">
        <div className="rounded-[10px] border border-line-1 bg-bg-card shadow-cp-md p-4 flex items-center justify-between gap-4">
          <div className="text-[12.5px] text-ink-4">
            {feilmelding && (
              <span className="text-cp-red font-medium">{feilmelding}</span>
            )}
            {sukkesmelding && (
              <span className="text-good font-medium">{sukkesmelding}</span>
            )}
            {!feilmelding && !sukkesmelding && (
              <span>
                Endringer lagres ikke automatisk — klikk &laquo;Lagre kladd&raquo;
                når du vil ta vare på det du har skrevet.
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="secondary"
              size="md"
              disabled={lagrer}
              onClick={handleLagreKladd}
            >
              <Save className="h-4 w-4" />
              {lagrer ? "Lagrer …" : "Lagre kladd"}
            </Button>
            <Button
              type="button"
              variant="primary"
              size="md"
              disabled
              title="Vurdering kommer i neste runde"
            >
              <Sparkles className="h-4 w-4" />
              Vurder søknad
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
