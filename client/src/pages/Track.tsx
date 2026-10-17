import { useState, type FormEvent } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { SButton, SField, SInput, errorText } from "@/components/store";

export default function Track() {
  const [, navigate] = useLocation();
  const [number, setNumber] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const find = trpc.store.findOrder.useMutation({
    onSuccess: ({ token }) => navigate(`/order/${token}`),
    onError: (err) => setError(errorText(err, "Check your order number and email.")),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!number.trim() || !email.trim()) {
      setError("Enter your order number and email.");
      return;
    }
    find.mutate({ number, email: email.trim() });
  };

  return (
    <div className="wrap grid items-center gap-12 pt-10 sm:pt-16 lg:grid-cols-[1fr_auto]">
      <div className="max-w-[520px]">
        <h1 className="serif-xl text-[clamp(3.2rem,8vw,5.6rem)]">Track your order</h1>
        <p className="mt-5 text-[19px] text-navy-2">Enter the order number from your confirmation email and the email you used at checkout.</p>
        <form onSubmit={submit} noValidate className="mt-9 space-y-4">
          <SField label="Order number">
            <SInput placeholder="PT-10001" value={number} onChange={(e) => setNumber(e.target.value)} autoCapitalize="characters" />
          </SField>
          <SField label="Email">
            <SInput type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </SField>
          {error && (
            <p role="alert" className="text-[15px] text-cherry">
              {error}
            </p>
          )}
          <SButton type="submit" size="lg" className="w-full" loading={find.isPending}>
            Find my order
          </SButton>
        </form>
      </div>
      <img src="/brand/delivery.webp" alt="" className="mx-auto hidden w-[320px] rounded-[32px] lg:block" />
    </div>
  );
}
