import { useEffect } from "react";
import { useRouter } from "next/router";
import { ROUTES } from "@/config/routes";

// Signup is handled by Google OAuth — redirect to login
export default function Signup() {
  const router = useRouter();
  useEffect(() => { router.replace(ROUTES.login); }, [router]);
  return null;
}