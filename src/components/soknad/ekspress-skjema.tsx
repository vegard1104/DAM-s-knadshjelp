"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TextareaFelt } from "./textarea-felt";
import { TekstFelt } from "./tekst-felt";
import { TallFelt } from "./tall-felt";
import { DatoFelt } from "./dato-felt";
import { ValgFelt } from "./valg-felt";
import { BudsjettFelt, type Budsjett } from "./budsjett-felt";
import { AutoFyllPanel } from "./auto-fyll-panel";
import { ForbedringInline } from "./forbedring-inline";
import { EKSPRESS_FELTER } from "@/types/ekspress-felter";
import type { Forbedring } from "@/types/database";
import type {
  AutoFyllResultatRespons,
  LagreKladdInput,
  LagreKladdResultat,
} from "@/app/(app)/soknader/ny/ekspress/actions";
import type { VurderResultat } from "@/app/(app)/soknader/[id]/actions";

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
  modus = "ny",
  forbedringer = [],
  lagreAction,
  autoFyllAction,
  vurderAction,
}: {
  initielleVerdier?: EkspressFelterVerdier;
  initiellSoknadssum?: number | null;
  initiellOppstart?: string | null;
  initiellAvslutt?: string | null;
  /**
   * "ny" — oppretter en ny søknad ved lagring (returnerer ny ID).
   * "rediger" — oppdaterer eksisterende søknad. Vurder-knappen blir
   * "Vurder på nytt" og viser forbedringsforslag inline.
   */
  modus?: "ny" | "rediger";
  /** Forbedringsforslag fra siste vurdering (kun i rediger-modus) */
  forbedringer?: Forbedring[];
  lagreAction: (data: LagreKladdInput) => Promise<LagreKladdResultat>;
  autoFyllAction: (tekst: string) => Promise<AutoFyllResultatRespons>;
  vurderAction: (soknadId: string) => Promise<VurderResultat>;
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
  const [vurderer, startVurdering] = useTransition();
  const [vurderingStatus, setVurderingStatus] = useState<string | null>(null);
  const [feilmelding, setFeilmelding] = useState<string | null>(null);
  const [sukkesmelding, setSuksessmelding] = useState<string | null>(null);

  /** Felt-id-er som agenten ikke kunne fylle ut — markeres med advarsel */
  const [manglendeFelter, setManglendeFelter] = useState<Set<string>>(
    new Set(),
  );

  function settFelt(id: string, verdi: unknown) {
    setVerdier((forrige) => ({ ...forrige, [id]: verdi }));
  }

  function getFelt<T>(id: string, fallback: T): T {
    return (verdier[id] as T) ?? fallback;
  }

  /**
   * Tar imot Claudes auto-fyll-respons og fyller inn skjema-state.
   * Vi merger inn over eksisterende verdier slik at hvis brukeren har
   * skrevet noe selv blir det IKKE overskrevet av et tomt agent-svar.
   */
  function handleAutoFyllResultat(
    data: NonNullable<
      Extract<AutoFyllResultatRespons, { ok: true }>["data"]
    >,
  ) {
    setVerdier((forrige) => {
      const sammenslaatte: EkspressFelterVerdier = { ...forrige };

      // Sett tittel hvis returnert
      if (data.tittel) {
        sammenslaatte["prosjektnavn"] = data.tittel;
      }

      // Slå sammen felter — kun overskriv hvis agenten har en verdi
      for (const [id, verdi] of Object.entries(data.felter)) {
        if (verdi === null || verdi === "" || verdi === undefined) continue;
        if (Array.isArray(verdi) && verdi.length === 0) continue;
        sammenslaatte[id] = verdi;
      }

      // Budsjett: hvis agenten fant rader, bruk dem (overskriver tom rad)
      if (data.budsjett_rader.length > 0) {
        sammenslaatte["3.3_budsjett"] = { rader: data.budsjett_rader };
      }

      return sammenslaatte;
    });

    // Top-level felt
    if (data.soknadssum_kr !== null) setSoknadssum(data.soknadssum_kr);
    if (data.oppstart_dato) setOppstart(data.oppstart_dato);
    if (data.avslutt_dato) setAvslutt(data.avslutt_dato);

    setManglendeFelter(new Set(data.manglende_felter));
  }

  const budsjett = getFelt<Budsjett>("3.3_budsjett", TOM_BUDSJETT);
  const totalbudsjett = budsjett.rader
    .filter((r) => r.type === "utgift")
    .reduce((sum, r) => sum + (r.belop ?? 0), 0);

  /** Bygg en LagreKladdInput basert på dagens skjema-state. */
  function byggLagreInput(): LagreKladdInput | { feil: string } {
    const tittel = (getFelt("prosjektnavn", "") as string).trim();
    if (!tittel) {
      return { feil: "Prosjektnavn må fylles inn først." };
    }

    const sammenslaatte = {
      ...verdier,
      "3.1_oppstart": oppstart,
      "3.1_avslutt": avslutt,
      soknadssum_kr: soknadssum,
    };

    return {
      tittel,
      felter: sammenslaatte,
      soknadssum_kr: soknadssum,
      totalbudsjett_kr: totalbudsjett > 0 ? totalbudsjett : null,
      oppstart_dato: oppstart,
      avslutt_dato: avslutt,
    };
  }

  function handleLagreKladd() {
    setFeilmelding(null);
    setSuksessmelding(null);

    const input = byggLagreInput();
    if ("feil" in input) {
      setFeilmelding(input.feil);
      return;
    }

    startLagring(async () => {
      const resultat = await lagreAction(input);
      if (!resultat.ok) {
        setFeilmelding(resultat.feil);
        return;
      }

      if (modus === "rediger") {
        // Bli på siden så brukeren kan fortsette å redigere
        setSuksessmelding("Endringer lagret.");
        router.refresh();
      } else {
        setSuksessmelding("Kladden er lagret.");
        router.push(`/soknader/${resultat.soknadId}`);
      }
    });
  }

  /**
   * Lagre + vurder + redirect. Vi gjør det i to API-kall slik at
   * brukeren ser fremdrift ("Lagrer …" → "Vurderer …") i stedet for
   * å sitte foran en stille knapp i 15 sekunder.
   */
  function handleVurderSoknad() {
    setFeilmelding(null);
    setSuksessmelding(null);
    setVurderingStatus(null);

    const input = byggLagreInput();
    if ("feil" in input) {
      setFeilmelding(input.feil);
      return;
    }

    startVurdering(async () => {
      // Steg 1: lagre kladd
      setVurderingStatus("Lagrer søknaden …");
      const lagret = await lagreAction(input);
      if (!lagret.ok) {
        setFeilmelding(lagret.feil);
        setVurderingStatus(null);
        return;
      }

      // Steg 2: vurder
      setVurderingStatus("Claude vurderer søknaden — dette kan ta 10–20 sekunder …");
      const vurdert = await vurderAction(lagret.soknadId);
      if (!vurdert.ok) {
        setFeilmelding(vurdert.feil);
        setVurderingStatus(null);
        return;
      }

      // Steg 3: redirect til vurderings-siden
      router.push(`/soknader/${vurdert.soknadId}/vurdering`);
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
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        handleLagreKladd();
      }}
    >
      {/* Auto-fyll panel øverst */}
      <AutoFyllPanel
        autoFyllAction={autoFyllAction}
        onResultat={handleAutoFyllResultat}
      />

      {/* Status hvis agenten markerte felt som manglende */}
      {manglendeFelter.size > 0 && (
        <div className="rounded-md border border-warning-soft bg-warning-soft/40 px-4 py-3 text-[12.5px] text-ink-2 leading-relaxed">
          <span className="font-semibold">Auto-fyll fullført.</span>{" "}
          Agenten kunne ikke fylle ut {manglendeFelter.size} felt — disse
          er markert med &laquo;Mangler&raquo;-tag og må fylles ut manuelt.
        </div>
      )}

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
            const erManglende = manglendeFelter.has(f.id);
            // Spesialtilfelle: oppstart/avslutt har egne kolonner
            let innhold: React.ReactNode = null;
            if (f.id === "3.1_oppstart") {
              innhold = (
                <DatoFelt
                  feltId={f.id}
                  navn={f.navn}
                  hjelpetekst={f.hjelpetekst}
                  pakrevd={f.pakrevd}
                  verdi={oppstart}
                  onChange={setOppstart}
                />
              );
            } else if (f.id === "3.1_avslutt") {
              innhold = (
                <DatoFelt
                  feltId={f.id}
                  navn={f.navn}
                  hjelpetekst={f.hjelpetekst}
                  pakrevd={f.pakrevd}
                  verdi={avslutt}
                  onChange={setAvslutt}
                  min={oppstart ?? undefined}
                />
              );
            } else if (f.id === "3.3_budsjett") {
              innhold = (
                <BudsjettFelt
                  feltId={f.id}
                  hjelpetekst={f.hjelpetekst}
                  budsjett={budsjett}
                  soknadssum={soknadssum}
                  onBudsjettChange={(b) => settFelt("3.3_budsjett", b)}
                  onSoknadssumChange={setSoknadssum}
                />
              );
            } else {
              switch (f.type) {
                case "kort_tekst":
                  innhold = (
                    <TekstFelt
                      feltId={f.id === "prosjektnavn" ? "" : f.id}
                      navn={f.navn}
                      hjelpetekst={f.hjelpetekst}
                      tegngrense={f.tegngrense}
                      pakrevd={f.pakrevd}
                      verdi={getFelt(f.id, "")}
                      onChange={(v) => settFelt(f.id, v)}
                    />
                  );
                  break;
                case "tekst":
                  innhold = (
                    <TextareaFelt
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
                  break;
                case "tall":
                  innhold = (
                    <TallFelt
                      feltId={f.id}
                      navn={f.navn}
                      hjelpetekst={f.hjelpetekst}
                      pakrevd={f.pakrevd}
                      verdi={getFelt(f.id, null)}
                      onChange={(v) => settFelt(f.id, v)}
                    />
                  );
                  break;
                case "valg_flere":
                  innhold = (
                    <ValgFelt
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
                  break;
                default:
                  innhold = null;
              }
            }

            // Finn eventuelt forbedringsforslag for dette feltet (rediger-modus)
            const forbedring = forbedringer.find((fb) => fb.felt === f.id);

            return (
              <div key={f.id} className="relative">
                {erManglende && (
                  <span className="absolute -top-1 right-0 inline-flex items-center gap-1 rounded-full bg-warning-soft text-warning text-[10px] font-bold uppercase tracking-[0.06em] px-2 py-0.5 z-10">
                    Mangler
                  </span>
                )}
                {innhold}
                {forbedring && f.type === "tekst" && (
                  <ForbedringInline
                    forbedring={forbedring}
                    tegngrense={f.tegngrense}
                    onBruk={() => settFelt(f.id, forbedring.forslag)}
                  />
                )}
                {forbedring && f.type === "kort_tekst" && (
                  <ForbedringInline
                    forbedring={forbedring}
                    tegngrense={f.tegngrense}
                    onBruk={() => settFelt(f.id, forbedring.forslag)}
                  />
                )}
              </div>
            );
          })}
        </section>
      ))}

      {/* Footer med knapper og meldinger */}
      <div className="sticky bottom-4 z-10">
        <div className="rounded-[10px] border border-line-1 bg-bg-card shadow-cp-md p-4 flex items-center justify-between gap-4">
          <div className="text-[12.5px] text-ink-4 min-w-0">
            {feilmelding && (
              <span className="text-cp-red font-medium">{feilmelding}</span>
            )}
            {!feilmelding && vurderingStatus && (
              <span className="text-cp-blue font-medium">
                {vurderingStatus}
              </span>
            )}
            {!feilmelding && !vurderingStatus && sukkesmelding && (
              <span className="text-good font-medium">{sukkesmelding}</span>
            )}
            {!feilmelding && !vurderingStatus && !sukkesmelding && (
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
              disabled={lagrer || vurderer}
              onClick={handleLagreKladd}
            >
              <Save className="h-4 w-4" />
              {lagrer
                ? "Lagrer …"
                : modus === "rediger"
                  ? "Lagre endringer"
                  : "Lagre kladd"}
            </Button>
            <Button
              type="button"
              variant="primary"
              size="md"
              disabled={lagrer || vurderer}
              onClick={handleVurderSoknad}
              title="Lagrer og vurderer søknaden mot DAMs kriterier"
            >
              <Sparkles
                className={cn("h-4 w-4", vurderer && "animate-pulse")}
              />
              {vurderer
                ? "Vurderer …"
                : modus === "rediger"
                  ? "Vurder på nytt"
                  : "Vurder søknad"}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
