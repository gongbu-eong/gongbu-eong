"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "../home.api";
import type { CurrentUserDto } from "../home.dto";
import { HomeMain } from "./HomeMain";

export function HomeEntry() {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUserDto | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    let mounted = true;

    getCurrentUser()
      .then((response) => {
        if (!mounted) return;

        const requiresSignupAgreements =
          response.user?.status === "pending_signup" ||
          response.user?.signupCompletedAt === null;

        if (response.authenticated && requiresSignupAgreements) {
          router.replace("/signup/agreements?next=/");
          return;
        }

        setUser(response.authenticated ? response.user : null);
        setIsChecking(false);
      })
      .catch(() => {
        if (!mounted) return;
        setUser(null);
        setIsChecking(false);
      });

    return () => {
      mounted = false;
    };
  }, [router]);

  if (isChecking) {
    return null;
  }

  return <HomeMain initialUser={user} authResolved />;
}
