"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        // Oversett vanlige Supabase-feilmeldinger til norsk
        if (error.message === "Invalid login credentials") {
          setError("Feil e-post eller passord.");
        } else if (error.message.includes("Email not confirmed")) {
          setError("E-posten er ikke bekreftet. Sjekk innboksen din.");
        } else {
          setError(error.message);
        }
        return;
      }

      router.push("/dashboard");
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <label className="block mb-5">
        <span className="block text-[12.5px] font-medium text-ink-2 mb-1.5">
          E-post
        </span>
        <Input
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isPending}
        />
      </label>

      <label className="block mb-2">
        <span className="flex items-center justify-between text-[12.5px] font-medium text-ink-2 mb-1.5">
          Passord
          <a
            href="#"
            className="text-cp-blue text-[12px] font-normal hover:underline"
          >
            Glemt?
          </a>
        </span>
        <Input
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isPending}
        />
      </label>

      {error && (
        <div className="mt-3 rounded-md border border-cp-red-soft bg-cp-red-tint px-3 py-2 text-[12.5px] text-cp-red">
          {error}
        </div>
      )}

      <Button
        type="submit"
        size="lg"
        className="mt-4 w-full"
        disabled={isPending || !email || !password}
      >
        {isPending ? "Logger inn …" : "Logg inn"}
        {!isPending && <ArrowRight className="h-4 w-4" />}
      </Button>
    </form>
  );
}
