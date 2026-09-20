"use client";

import { RegisterFormAPI } from "@/components/auth/register-form-api";
import { Header } from "@/components/header";
import { AuthShell } from "@/components/auth/auth-shell";

export default function RegisterPage() {
  return (
    <div className="app-shell">
      <Header user={null} />
      <AuthShell mode="register"><RegisterFormAPI /></AuthShell>
    </div>
  );
}
