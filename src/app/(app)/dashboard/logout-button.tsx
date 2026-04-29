"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleLogout = () => {
    startTransition(async () => {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/login");
      router.refresh();
    });
  };

  return (
    <Button
      variant="secondary"
      size="md"
      onClick={handleLogout}
      disabled={isPending}
    >
      <LogOut className="h-4 w-4" />
      {isPending ? "Logger ut …" : "Logg ut"}
    </Button>
  );
}
