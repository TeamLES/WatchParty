"use client";

import { useState, useRef, useEffect } from "react";
import {
  CopyIcon,
  MessageSquareTextIcon,
  MonitorPlayIcon,
  PlayIcon,
  SendIcon,
  SettingsIcon,
  Share2Icon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Pomocná funkcia na získanie YouTube ID z URL
const extractYoutubeId = (url: string) => {
  if (!url) return null;
  const regExp =
    /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
};

// Hardcoded ukážkové správy
const INITAL_MESSAGES = [
  { id: 1, user: "Ty", text: "Caute, všetci tu?", time: "20:41", isMe: true },
  { id: 2, user: "Alex", text: "Jasne, možeme začať", time: "20:42", isMe: false },
  { id: 3, user: "Nina", text: "Čakám, pusti to 🍿", time: "20:42", isMe: false },
];

export default function RoomPage() {
  const [videoUrl, setVideoUrl] = useState("https://www.youtube.com/watch?v=aqz-KE-bpKQ");
  const [activeVideoId, setActiveVideoId] = useState<string | null>("aqz-KE-bpKQ");
  const [messages, setMessages] = useState(INITAL_MESSAGES);
  const [newMessage, setNewMessage] = useState("");

  const chatEndRef = useRef<HTMLDivElement>(null);

  const handlePlay = () => {
    const id = extractYoutubeId(videoUrl);
    if (id) {
      setActiveVideoId(id);
    } else {
      alert("Zadaj platnú YouTube URL, prosím.");
    }
  };

  const handleSendMessage = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!newMessage.trim()) return;

    setMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        user: "Ty",
        text: newMessage,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isMe: true,
      }
    ]);
    setNewMessage("");
  };

  // Autoscroll chatu na spodok
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="relative min-h-screen bg-[radial-gradient(circle_at_20%_10%,rgba(251,191,36,0.12),transparent_30%),radial-gradient(circle_at_75%_20%,rgba(16,185,129,0.12),transparent_35%),radial-gradient(circle_at_50%_80%,rgba(14,165,233,0.1),transparent_45%)] flex flex-col font-sans text-foreground">

      {/* Navbar miestnosti */}
      <header className="glass-card sticky top-0 z-40 flex h-16 shrink-0 items-center justify-between px-6 border-x-0 border-t-0 rounded-none border-white/10 bg-card/40 backdrop-blur-2xl">
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 text-primary">
            <MonitorPlayIcon className="size-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold leading-tight">Friday Night Cinema</h1>
            <p className="text-xs text-muted-foreground">3 účastníci v miestnosti</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="glass-card border-primary/30 text-primary hover:bg-primary/20 gap-2 h-9">
            <Share2Icon className="size-4" />
            <span className="hidden sm:inline">Pozvať</span>
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full glass-card hover:bg-white/10">
            <SettingsIcon className="size-4" />
          </Button>
        </div>
      </header>

      {/* Hlavný workspace (Video + Chat) */}
      <main className="flex-1 flex flex-col lg:flex-row gap-6 p-4 sm:p-6 overflow-hidden max-h-[calc(100vh-4rem)]">

        {/* Ľavá časť: Prehrávač videa a ovládanie */}
        <section className="flex-1 flex flex-col gap-4 min-w-0">

          {/* Vstup pre URL */}
          <div className="glass-card rounded-2xl p-4 flex flex-col sm:flex-row gap-3 items-center shrink-0">
            <div className="flex-1 w-full relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                <CopyIcon className="size-4" />
              </div>
              <Input
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="Vlož YouTube link zdroja..."
                className="pl-10 h-12 bg-black/20 border-white/10 focus-visible:ring-primary/50 text-base"
                onKeyDown={(e) => e.key === "Enter" && handlePlay()}
              />
            </div>
            <Button size="lg" className="w-full sm:w-auto h-12 px-8 rounded-xl shadow-[0_0_20px_rgba(232,121,249,0.2)] hover:shadow-[0_0_30px_rgba(232,121,249,0.4)] transition-all gap-2" onClick={handlePlay}>
              <PlayIcon className="size-5 fill-current" />
              <span className="font-semibold">Prehrať pre všetkých</span>
            </Button>
          </div>

          {/* Samotný Video Prehrávač (16:9 kontajner) */}
          <div className="glass-card rounded-3xl flex-1 relative overflow-hidden bg-black/60 shadow-2xl min-h-[300px]">
            {activeVideoId ? (
              <iframe
                className="absolute inset-0 w-full h-full"
                src={`https://www.youtube.com/embed/${activeVideoId}?autoplay=1&rel=0&modestbranding=1`}
                title="WatchParty Video Player"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              ></iframe>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
                <MonitorPlayIcon className="size-16 mb-4 opacity-50" />
                <p className="text-lg font-medium">Zatiaľ sa nič neprehráva</p>
                <p className="text-sm">Vlož link a spusti prehrávanie</p>
              </div>
            )}
          </div>
        </section>

        {/* Pravá časť: Live Chat */}
        <aside className="w-full lg:w-96 xl:w-[400px] flex flex-col shrink-0 gap-4 h-[500px] lg:h-auto">
          <div className="glass-card rounded-3xl flex flex-col h-full overflow-hidden border-white/10">

            {/* Chat hlavička */}
            <div className="p-4 border-b border-white/10 bg-black/10 shrink-0 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquareTextIcon className="size-5 text-primary" />
                <h2 className="font-semibold text-lg">Miestny Chat</h2>
              </div>
              <div className="flex items-center gap-1 text-xs font-medium text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-md">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                Live
              </div>
            </div>

            {/* Správy - Scroll zóna */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex flex-col ${msg.isMe ? "items-end" : "items-start"}`}>
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-xs font-medium text-muted-foreground">{msg.user}</span>
                    <span className="text-[10px] text-muted-foreground/60">{msg.time}</span>
                  </div>
                  <div className={`px-4 py-2 rounded-2xl max-w-[85%] text-sm ${msg.isMe ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-white/10 text-foreground rounded-bl-sm"}`}>
                    {msg.text}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Chat Vstup */}
            <div className="p-4 pt-2 shrink-0 bg-black/10 border-t border-white/5">
              <form onSubmit={handleSendMessage} className="relative flex items-center">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Napíš správu..."
                  className="pr-12 h-12 rounded-xl bg-black/20 border-white/10 focus-visible:ring-primary/50 text-sm"
                />
                <Button
                  type="submit"
                  size="icon"
                  variant="ghost"
                  className="absolute right-1 h-10 w-10 rounded-lg text-primary hover:bg-primary/20 hover:text-primary transition-colors"
                  disabled={!newMessage.trim()}
                >
                  <SendIcon className="size-4" />
                </Button>
              </form>
            </div>

          </div>
        </aside>

      </main>
    </div>
  );
}
