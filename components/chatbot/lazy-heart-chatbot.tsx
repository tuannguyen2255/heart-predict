"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { MessageCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const HeartChatbot = dynamic(() => import("./HeartChatbot"), {
  ssr: false,
  loading: () => (
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50" role="status" aria-label="Đang tải trò chuyện">
      <Loader2 className="h-10 w-10 animate-spin text-sky-500" />
    </div>
  ),
});

export default function LazyHeartChatbot({ latestResult }: { latestResult?: unknown }) {
  const [activated, setActivated] = useState(false);
  if (activated) return <HeartChatbot latestResult={latestResult} initiallyOpen />;
  return (
    <Button
      className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 h-14 w-14 rounded-full bg-primary shadow-sm hover:bg-primary/90"
      size="icon"
      aria-label="Mở trò chuyện"
      onClick={() => setActivated(true)}
    >
      <MessageCircle className="h-6 w-6 text-white" />
    </Button>
  );
}
