import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-bg-app">
      {/* Venstre: branded panel */}
      <div className="relative overflow-hidden bg-cp-blue-dark text-white p-10 lg:p-16 flex flex-col justify-between">
        {/* Dekorative blobs */}
        <div
          className="absolute -top-48 -right-48 h-[600px] w-[600px] rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(255,255,255,0.10), transparent 70%)",
          }}
        />
        <div
          className="absolute -bottom-36 -left-24 h-[400px] w-[400px] rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(255,255,255,0.10), transparent 70%)",
          }}
        />

        <div className="relative flex items-center gap-3">
          <div className="h-9 px-3 inline-flex items-center justify-center rounded bg-white text-cp-blue-dark font-bold tracking-tight text-sm">
            CP-foreningen
          </div>
        </div>

        <div className="relative">
          <h1 className="font-display italic font-light text-5xl lg:text-6xl leading-[1.05] tracking-tight max-w-[12ch]">
            Sterkere søknader,{" "}
            <span className="not-italic font-sans font-medium text-cp-blue-soft">
              før de sendes inn.
            </span>
          </h1>
          <p className="mt-7 text-[13px] text-white/70 max-w-[40ch] leading-relaxed">
            Internt arbeidsverktøy for sekretariatet i CP-foreningen. Vurder,
            forbedre og følg opp søknader til Stiftelsen Dam.
          </p>
        </div>

        <div className="relative flex gap-6 text-[13px] text-white/60">
          <span>v0.1 · intern beta</span>
          <span>·</span>
          <span>cp.no</span>
        </div>
      </div>

      {/* Høyre: skjema */}
      <div className="flex items-center justify-center p-10 lg:p-16">
        <div className="w-full max-w-[360px]">
          <div className="mb-8">
            <h2 className="text-2xl font-bold tracking-tight text-ink-1">
              Logg inn
            </h2>
            <p className="text-[13.5px] text-ink-4 mt-1.5">
              Bruk kontoen din i CP-foreningen.
            </p>
          </div>

          <LoginForm />

          <p className="text-[11.5px] text-ink-4 text-center mt-7 leading-relaxed">
            Ved pålogging godtar du retningslinjene for personvern.
          </p>
        </div>
      </div>
    </div>
  );
}
