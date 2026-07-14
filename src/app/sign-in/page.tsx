import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";

// AuthForm reads useSearchParams() (the `next` redirect target) - Next
// requires a Suspense boundary around any component that does, even in a
// fully client-rendered page like this one.
export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <AuthForm />
    </Suspense>
  );
}
