import { redirect } from "next/navigation";

export default function RootPage() {
  // Middleware sender ulogget bruker til /login. Ellers går vi til dashboard.
  redirect("/dashboard");
}
