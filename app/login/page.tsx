"use client";

import { LoginFormAPI } from "@/components/auth/login-form-api";
import { Header } from "@/components/header";
import { AuthShell } from "@/components/auth/auth-shell";

export default function LoginPage() {
  return (
    <div className="app-shell">
      <Header user={null} />
      <AuthShell mode="login"><LoginFormAPI /></AuthShell>
    </div>
  );
}
