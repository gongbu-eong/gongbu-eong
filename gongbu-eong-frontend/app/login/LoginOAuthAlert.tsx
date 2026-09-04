"use client";

import { useEffect } from "react";

type LoginOAuthAlertProps = {
  alertMessage: string;
};

export function LoginOAuthAlert({ alertMessage }: LoginOAuthAlertProps) {
  useEffect(() => {
    window.alert(alertMessage);
  }, [alertMessage]);

  return null;
}
