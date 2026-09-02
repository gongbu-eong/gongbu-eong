"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { TicketRewardAlert } from "./TicketRewardAlert";

export function TicketRewardQueryAlert() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [dismissed, setDismissed] = useState(false);
  const message = useMemo(() => {
    const reward = searchParams.get("ticketReward");
    const amount = Number(searchParams.get("ticketAmount") || 0);

    return getTicketRewardMessage(reward, amount);
  }, [searchParams]);

  useEffect(() => {
    if (!message) {
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    params.delete("ticketReward");
    params.delete("ticketAmount");
    const query = params.toString();

    window.history.replaceState(
      window.history.state,
      "",
      `${pathname}${query ? `?${query}` : ""}${window.location.hash}`,
    );
  }, [message, pathname, searchParams]);

  if (!message || dismissed) {
    return null;
  }

  return (
    <TicketRewardAlert
      message={message}
      onClose={() => setDismissed(true)}
    />
  );
}

function getTicketRewardMessage(reward: string | null, amount: number) {
  if (!reward || amount <= 0) {
    return "";
  }

  return amount === 1
    ? "진단권 1장이 추가되었습니다."
    : `진단권 ${amount}장이 추가되었습니다.`;
}
