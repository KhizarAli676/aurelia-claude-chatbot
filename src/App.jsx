import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Sparkles,
  KeyRound,
  ShieldCheck,
  Download,
  Copy,
  Check,
  AlertCircle,
  Sliders,
  Crown,
  Trash2,
  Eye,
  EyeOff,
  History,
  Cpu,
  Database,
  Plus,
  MessageSquare,
  CheckCircle2,
  FileCode2,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from './lib/supabase.js';

const PERSONA_PRESETS = [
  {
    id: 'concierge',
    label: 'Executive Concierge',
    badge: 'Signature',
    prompt:
      'You are Aurelia, an ultra-refined executive concierge and strategic advisor. Respond with clarity, warmth, precision, and understated luxury. Remember every detail shared earlier in our conversation.',
  },
  {
    id: 'architect',
    label: 'Principal Architect',
    badge: 'Technical',
    prompt:
      'You are a Principal Systems Architect advising an executive engineering team. Provide structured, battle-tested architectural guidance with crisp trade-offs and recall prior constraints discussed in this thread.',
  },
  {
    id: 'creative',
    label: 'Creative Director',
    badge: 'Editorial',
    prompt:
      'You are the Creative Director of a luxury maison. Craft evocative, articulate concepts with refined aesthetics and editorial poise, building continuously upon the context established in our dialogue.',
  },
  {
    id: 'custom',
    label: 'Custom Directive',
    badge: 'Bespoke',
    prompt:
      'You are a helpful, articulate AI assistant. Maintain full awareness of the conversation history and tailor your answers thoughtfully.',
  },
];

const CLAUDE_MODELS = [
  { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4 (Balanced Luxury)' },
  { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet (Reasoning)' },
  { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku (Rapid)' },
];

const SQL_SNIPPET = `-- Run in Supabase SQL Editor
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL DEFAULT 'Executive Dossier',
    persona_id TEXT NOT NULL DEFAULT 'concierge',
    system_prompt TEXT NOT NULL,
    model TEXT NOT NULL DEFAULT 'claude-sonnet-4-20250514',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public access to chat_sessions"
    ON public.chat_sessions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow public access to chat_messages"
    ON public.chat_messages FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);`;

const WELCOME_MESSAGE = {
  id: 'welcome-local',
  role: 'assistant',
  content:
    'Good day. I am Aurelia, your private Claude intelligence suite connected to Supabase. Every exchange is archived and retained in active context—how may I assist you today?',
  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
};

export default function App() {
  const envApiKey = import.meta.env.VITE_ANTHROPIC_API_KEY || '';
  const [apiKey, setApiKey] = useState(
    envApiKey && envApiKey !== 'your_anthropic_api_key_here' ? envApiKey : ''
  );
  const [showKey, setShowKey] = useState(false);

  // Persona & System Prompt State
  const [selectedPreset, setSelectedPreset] = useState('concierge');
  const [systemPrompt, setSystemPrompt] = useState(PERSONA_PRESETS[0].prompt);
  const [model, setModel] = useState(CLAUDE_MODELS[0].id);

  // Supabase Sessions & Messages State
  const [dbStatus, setDbStatus] = useState('connecting');
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [sqlCopied, setSqlCopied] = useState(false);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    loadSessionsFromSupabase();
  }, []);

  const loadSessionsFromSupabase = async () => {
    if (!isSupabaseConfigured || !supabase) {
      setDbStatus('schema_missing');
      return;
    }

    try {
      setDbStatus('connecting');
      const { data, error: fetchErr } = await supabase
        .from('chat_sessions')
        .select('*')
        .order('updated_at', { ascending: false });

      if (fetchErr) {
        console.warn('Supabase table check:', fetchErr.message);
        setDbStatus('schema_missing');
        return;
      }

      setDbStatus('connected');
      setSessions(data || []);

      if (data && data.length > 0) {
        await selectSession(data[0]);
      }
    } catch (err) {
      console.warn('Supabase connection error:', err);
      setDbStatus('schema_missing');
    }
  };

  const selectSession = async (session) => {
    setActiveSessionId(session.id);
    setSelectedPreset(session.persona_id || 'concierge');
    setSystemPrompt(session.system_prompt || PERSONA_PRESETS[0].prompt);
    setModel(session.model || CLAUDE_MODELS[0].id);
    setError(null);

    if (!supabase) return;

    const { data, error: msgErr } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', session.id)
      .order('created_at', { ascending: true });

    if (!msgErr && data) {
      if (data.length === 0) {
        setMessages([WELCOME_MESSAGE]);
      } else {
        setMessages(
          data.map((row) => ({
            id: row.id,
            role: row.role,
            content: row.content,
            timestamp: new Date(row.created_at).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            }),
          }))
        );
      }
    }
  };

  const ensureActiveSession = async (firstUserMessageText) => {
    if (activeSessionId) return activeSessionId;
    if (dbStatus !== 'connected' || !supabase) return null;

    const autoTitle =
      firstUserMessageText.length > 38
        ? `${firstUserMessageText.slice(0, 38)}...`
        : firstUserMessageText || 'Executive Dossier';

    const { data, error: createErr } = await supabase
      .from('chat_sessions')
      .insert([
        {
          title: autoTitle,
          persona_id: selectedPreset,
          system_prompt: systemPrompt,
          model,
        },
      ])
      .select()
      .single();

    if (createErr || !data) {
      console.warn('Could not create Supabase session:', createErr?.message);
      return null;
    }

    setActiveSessionId(data.id);
    setSessions((prev) => [data, ...prev]);
    return data.id;
  };

  const persistMessageToSupabase = async (sessionId, role, content) => {
    if (!sessionId || dbStatus !== 'connected' || !supabase) return null;

    const { data, error: insertErr } = await supabase
      .from('chat_messages')
      .insert([{ session_id: sessionId, role, content }])
      .select()
      .single();

    if (insertErr) {
      console.warn('Could not save message to Supabase:', insertErr.message);
      return null;
    }
    return data;
  };

  const handlePresetChange = async (preset) => {
    setSelectedPreset(preset.id);
    setSystemPrompt(preset.prompt);

    if (activeSessionId && dbStatus === 'connected' && supabase) {
      await supabase
        .from('chat_sessions')
        .update({ persona_id: preset.id, system_prompt: preset.prompt })
        .eq('id', activeSessionId);
    }
  };

  const generateAtelierPreviewReply = (history, currentSystem) => {
    const userTurns = history.filter((m) => m.role === 'user');
    const latest = userTurns[userTurns.length - 1]?.content || '';
    const firstTopic = userTurns[0]?.content || '';
    const personaName =
      PERSONA_PRESETS.find((p) => p.id === selectedPreset)?.label || 'Custom Persona';

    if (userTurns.length === 1) {
      return `[Atelier Preview Mode — ${personaName}]\n\nI have received your inquiry: "${latest}".\n\nDatabase Status: ${
        dbStatus === 'connected'
          ? 'Synced with Supabase PostgreSQL'
          : 'Awaiting SQL Schema in Supabase'
      }. Add your \`sk-ant-...\` key in the Anthropic API Vault on the left to switch from local preview to live Claude responses.`;
    }

    return `[Atelier Preview Mode — Context Verified (${history.length} messages in payload)]\n\nBuilding upon our earlier exchange regarding "${firstTopic.slice(0, 60)}${
      firstTopic.length > 60 ? '...' : ''
    }", here is my tailored continuation for "${latest}":\n\n• Active System Directive: "${currentSystem.slice(0, 75)}..."\n• Full conversation history array (${history.length} turns) is synced and ready for Claude \`/v1/messages\`.`;
  };

  const handleSendMessage = async (e) => {
    e?.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    setError(null);

    const userMsg = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const updatedHistory = [...messages, userMsg];
    setMessages(updatedHistory);
    setInput('');
    setIsLoading(true);

    try {
      const sessionId = await ensureActiveSession(trimmed);
      await persistMessageToSupabase(sessionId, 'user', trimmed);

      const firstUserIdx = updatedHistory.findIndex((m) => m.role === 'user');
      const apiMessages = updatedHistory.slice(firstUserIdx).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      let assistantText = '';

      if (!apiKey.trim()) {
        await new Promise((r) => setTimeout(r, 750));
        assistantText = generateAtelierPreviewReply(apiMessages, systemPrompt);
      } else {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey.trim(),
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
          },
          body: JSON.stringify({
            model,
            max_tokens: 1024,
            system: systemPrompt,
            messages: apiMessages,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          const apiErrorMessage =
            data?.error?.message || `Anthropic API returned status ${response.status}`;
          throw new Error(apiErrorMessage);
        }

        assistantText =
          data?.content?.[0]?.text || 'No text content returned from Claude API.';
      }

      const savedAssistant = await persistMessageToSupabase(
        sessionId,
        'assistant',
        assistantText
      );

      setMessages((prev) => [
        ...prev,
        {
          id: savedAssistant?.id || `assistant-${Date.now()}`,
          role: 'assistant',
          content: assistantText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);

      if (dbStatus === 'connected') {
        const { data: refreshedSessions } = await supabase
          .from('chat_sessions')
          .select('*')
          .order('updated_at', { ascending: false });
        if (refreshedSessions) setSessions(refreshedSessions);
      }
    } catch (err) {
      setError(err.message || 'An unexpected error occurred while contacting Claude.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartNewSession = () => {
    setActiveSessionId(null);
    setError(null);
    setMessages([
      {
        ...WELCOME_MESSAGE,
        id: `welcome-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  const handleDeleteSession = async (e, sessionId) => {
    e.stopPropagation();
    if (!supabase || dbStatus !== 'connected') return;

    await supabase.from('chat_sessions').delete().eq('id', sessionId);
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));

    if (activeSessionId === sessionId) {
      handleStartNewSession();
    }
  };

  const handleCopyMessage = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(SQL_SNIPPET);
    setSqlCopied(true);
    setTimeout(() => setSqlCopied(false), 2000);
  };

  const handleExportDossier = () => {
    const header = `# Aurelia Executive Conversation Dossier\nModel: ${model}\nSystem Directive: ${systemPrompt}\nExported: ${new Date().toLocaleString()}\n\n---\n\n`;
    const body = messages
      .map(
        (m) =>
          `### ${m.role === 'user' ? 'Client' : 'Aurelia (Claude)'} [${m.timestamp}]\n${m.content}\n`
      )
      .join('\n');
    const blob = new Blob([header + body], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aurelia-dossier-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#070709] text-[#F4F1EA] flex flex-col lg:flex-row overflow-hidden">
      {/* Left Luxury Atelier Control Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'w-full lg:w-[380px]' : 'hidden'
        } bg-[#0D0D11] border-b lg:border-b-0 lg:border-r border-[#C5A059]/20 flex flex-col justify-between p-6 shrink-0`}
      >
        <div className="space-y-5 overflow-y-auto max-h-[calc(100vh-105px)] pr-1">
          {/* Brand Crest */}
          <div className="flex items-center justify-between border-b border-[#C5A059]/15 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#C5A059] to-[#8C6A2B] flex items-center justify-center shadow-lg shadow-[#C5A059]/15">
                <Crown className="w-5 h-5 text-[#070709]" />
              </div>
              <div>
                <h1 className="font-serif text-2xl font-semibold tracking-wide text-[#F0DEC0]">
                  AURELIA
                </h1>
                <p className="text-[11px] uppercase tracking-[0.22em] text-[#C5A059]">
                  Claude + Supabase Suite
                </p>
              </div>
            </div>
            <span
              className={`px-2.5 py-1 rounded-full text-[10px] font-medium tracking-wider uppercase border ${
                apiKey.trim()
                  ? 'bg-emerald-950/50 text-emerald-300 border-emerald-500/30'
                  : 'bg-[#C5A059]/10 text-[#DFC08A] border-[#C5A059]/30'
              }`}
            >
              {apiKey.trim() ? 'Live Claude' : 'Preview'}
            </span>
          </div>

          {/* Supabase Database Status Card */}
          <div className="bg-[#14141A] border border-[#C5A059]/20 rounded-2xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Database className="w-4 h-4 text-[#C5A059]" />
                <div>
                  <div className="text-xs font-medium text-[#F0DEC0]">Supabase PostgreSQL</div>
                  <div className="text-[11px] text-[#8E8B82]">
                    {dbStatus === 'connected' && 'Tables synced & archiving chats'}
                    {dbStatus === 'connecting' && 'Connecting to database...'}
                    {dbStatus === 'schema_missing' && 'Tables not created yet'}
                  </div>
                </div>
              </div>
              {dbStatus === 'connected' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <button
                  type="button"
                  onClick={loadSessionsFromSupabase}
                  className="text-[11px] text-[#DFC08A] underline hover:text-white"
                >
                  Verify
                </button>
              )}
            </div>

            {dbStatus === 'schema_missing' && (
              <div className="pt-2 border-t border-white/5 flex items-center justify-between gap-2">
                <span className="text-[11px] text-[#A5A198]">
                  Run <code className="text-[#DFC08A]">supabase/schema.sql</code> in SQL Editor
                </span>
                <button
                  type="button"
                  onClick={handleCopySql}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#C5A059]/15 border border-[#C5A059]/40 text-[11px] text-[#F0DEC0] hover:bg-[#C5A059]/25 shrink-0"
                >
                  <FileCode2 className="w-3 h-3 text-[#C5A059]" />
                  {sqlCopied ? 'Copied SQL!' : 'Copy SQL'}
                </button>
              </div>
            )}
          </div>

          {/* Saved Dossiers (Supabase History) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-[#DFC08A] flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-[#C5A059]" />
                Saved Dossiers ({sessions.length})
              </span>
              <button
                type="button"
                onClick={handleStartNewSession}
                className="flex items-center gap-1 text-[11px] text-[#C5A059] hover:text-[#F0DEC0] transition"
              >
                <Plus className="w-3.5 h-3.5" />
                New Chat
              </button>
            </div>

            <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
              {sessions.length === 0 ? (
                <div className="text-[11px] text-[#6E6B63] bg-[#14141A]/60 border border-white/5 rounded-xl p-3">
                  No archived sessions yet. Send a message to create your first Supabase dossier.
                </div>
              ) : (
                sessions.map((s) => {
                  const isCurrent = s.id === activeSessionId;
                  return (
                    <div
                      key={s.id}
                      onClick={() => selectSession(s)}
                      className={`group flex items-center justify-between px-3 py-2 rounded-xl border cursor-pointer transition ${
                        isCurrent
                          ? 'bg-[#C5A059]/15 border-[#C5A059] text-[#F0DEC0]'
                          : 'bg-[#14141A] border-white/5 text-[#A5A198] hover:border-[#C5A059]/40'
                      }`}
                    >
                      <span className="text-xs truncate pr-2">{s.title}</span>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteSession(e, s.id)}
                        className="opacity-60 hover:opacity-100 text-[#8E8B82] hover:text-rose-400 transition"
                        title="Delete session"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* API Key Vault */}
          <div className="bg-[#14141A] border border-[#C5A059]/20 rounded-2xl p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium uppercase tracking-wider text-[#DFC08A] flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-[#C5A059]" />
                Anthropic API Vault
              </label>
              <span className="text-[11px] text-[#8E8B82] flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-[#C5A059]" />
                Session Only
              </span>
            </div>

            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-ant-api03-..."
                className="w-full bg-[#070709] border border-white/10 focus:border-[#C5A059] rounded-xl px-3.5 py-2 pr-10 text-xs text-[#F4F1EA] placeholder-[#5B5955] outline-none transition"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8E8B82] hover:text-[#DFC08A]"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Model Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wider text-[#DFC08A] flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-[#C5A059]" />
              Claude Engine
            </label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full bg-[#14141A] border border-white/10 focus:border-[#C5A059] rounded-xl px-3.5 py-2 text-xs text-[#F4F1EA] outline-none transition"
            >
              {CLAUDE_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          {/* System Prompt Studio */}
          <div className="space-y-2.5">
            <label className="text-xs font-medium uppercase tracking-wider text-[#DFC08A] flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-[#C5A059]" />
              System Prompt & Persona
            </label>

            <div className="grid grid-cols-2 gap-2">
              {PERSONA_PRESETS.map((preset) => {
                const active = selectedPreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handlePresetChange(preset)}
                    className={`text-left p-2 rounded-xl border transition ${
                      active
                        ? 'bg-[#C5A059]/15 border-[#C5A059] text-[#F0DEC0]'
                        : 'bg-[#14141A] border-white/5 text-[#A5A198] hover:border-[#C5A059]/40'
                    }`}
                  >
                    <div className="text-[10px] uppercase tracking-wider text-[#C5A059]">
                      {preset.badge}
                    </div>
                    <div className="text-xs font-medium mt-0.5 truncate">{preset.label}</div>
                  </button>
                );
              })}
            </div>

            <textarea
              rows={3}
              value={systemPrompt}
              onChange={(e) => {
                setSelectedPreset('custom');
                setSystemPrompt(e.target.value);
              }}
              placeholder="Define Claude's character, rules, and objective..."
              className="w-full bg-[#14141A] border border-white/10 focus:border-[#C5A059] rounded-xl p-3 text-xs leading-relaxed text-[#E5E0D5] placeholder-[#5B5955] outline-none resize-none transition"
            />
          </div>
        </div>

        {/* Footer Context Telemetry */}
        <div className="pt-3 mt-3 border-t border-[#C5A059]/15 flex items-center justify-between text-xs text-[#8E8B82]">
          <span className="flex items-center gap-1.5">
            <History className="w-3.5 h-3.5 text-[#C5A059]" />
            Context: <strong className="text-[#F0DEC0]">{messages.length}</strong> msgs
          </span>
          <span className="text-[11px] text-[#C5A059]">Supabase + Claude</span>
        </div>
      </aside>

      {/* Main Executive Chat Stage */}
      <main className="flex-1 flex flex-col h-screen bg-gradient-to-b from-[#09090D] via-[#070709] to-[#0B0B0F]">
        {/* Top Bar */}
        <header className="h-16 px-6 border-b border-[#C5A059]/15 bg-[#0D0D11]/80 backdrop-blur-md flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="px-3 py-1.5 rounded-lg bg-[#14141A] border border-white/10 hover:border-[#C5A059]/50 text-xs text-[#DFC08A] transition"
            >
              {sidebarOpen ? 'Hide Atelier' : 'Open Atelier'}
            </button>
            <div className="hidden sm:block">
              <span className="text-xs text-[#8E8B82]">Persona: </span>
              <span className="text-xs font-medium text-[#F0DEC0]">
                {PERSONA_PRESETS.find((p) => p.id === selectedPreset)?.label || 'Custom'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleExportDossier}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#14141A] border border-white/10 hover:border-[#C5A059]/50 text-xs text-[#E5E0D5] transition"
            >
              <Download className="w-3.5 h-3.5 text-[#C5A059]" />
              <span>Export Dossier</span>
            </button>
            <button
              type="button"
              onClick={handleStartNewSession}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#14141A] border border-white/10 hover:border-[#C5A059]/50 text-xs text-[#E5E0D5] transition"
            >
              <Plus className="w-3.5 h-3.5 text-[#C5A059]" />
              <span>New Session</span>
            </button>
          </div>
        </header>

        {/* Conversation Feed */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 space-y-6">
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.map((msg) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                >
                  <div className="flex items-center gap-2 mb-1.5 px-1">
                    <span className="text-[11px] uppercase tracking-widest text-[#C5A059] font-medium">
                      {isUser ? 'You' : 'Aurelia'}
                    </span>
                    <span className="text-[10px] text-[#6E6B63]">{msg.timestamp}</span>
                  </div>

                  <div
                    className={`group relative max-w-[88%] sm:max-w-[80%] rounded-2xl px-5 py-4 text-sm leading-relaxed whitespace-pre-wrap shadow-xl ${
                      isUser
                        ? 'bg-gradient-to-br from-[#C5A059] to-[#A6823E] text-[#070709] font-medium rounded-tr-sm'
                        : 'bg-[#14141A] border border-[#C5A059]/20 text-[#F4F1EA] rounded-tl-sm'
                    }`}
                  >
                    {msg.content}

                    {!isUser && (
                      <button
                        type="button"
                        onClick={() => handleCopyMessage(msg.id, msg.content)}
                        className="mt-3 pt-2 border-t border-white/5 flex items-center gap-1.5 text-[11px] text-[#8E8B82] hover:text-[#DFC08A] transition"
                      >
                        {copiedId === msg.id ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-400">Copied to clipboard</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy response</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {isLoading && (
              <div className="flex flex-col items-start">
                <div className="flex items-center gap-2 mb-1.5 px-1">
                  <span className="text-[11px] uppercase tracking-widest text-[#C5A059] font-medium">
                    Aurelia
                  </span>
                  <span className="text-[10px] text-[#8E8B82]">Synthesizing...</span>
                </div>
                <div className="bg-[#14141A] border border-[#C5A059]/25 rounded-2xl rounded-tl-sm px-5 py-4 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#C5A059] animate-bounce" />
                  <span className="w-2 h-2 rounded-full bg-[#C5A059] animate-bounce [animation-delay:150ms]" />
                  <span className="w-2 h-2 rounded-full bg-[#C5A059] animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            )}

            {error && (
              <div className="bg-rose-950/40 border border-rose-500/40 rounded-2xl p-4 flex items-start justify-between gap-4 text-rose-200 text-xs">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-rose-300">Claude API Request Failed</p>
                    <p className="mt-1 leading-relaxed">{error}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setError(null)}
                  className="text-rose-300 hover:text-white underline shrink-0"
                >
                  Dismiss
                </button>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Composer Bar */}
        <footer className="p-4 sm:px-8 sm:py-5 border-t border-[#C5A059]/15 bg-[#0D0D11]/90 backdrop-blur-md">
          <form onSubmit={handleSendMessage} className="max-w-3xl mx-auto">
            <div className="flex items-end gap-3 bg-[#14141A] border border-[#C5A059]/30 focus-within:border-[#C5A059] rounded-2xl p-2.5 shadow-2xl transition">
              <textarea
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="Address Aurelia... (Shift + Enter for new line)"
                className="flex-1 bg-transparent px-3 py-2 text-sm text-[#F4F1EA] placeholder-[#6E6B63] outline-none resize-none max-h-36"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#C5A059] to-[#DFC08A] text-[#070709] font-semibold text-xs uppercase tracking-wider flex items-center gap-2 hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition shrink-0 shadow-lg shadow-[#C5A059]/20"
              >
                <span>Send</span>
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex items-center justify-between mt-2 px-1 text-[11px] text-[#6E6B63]">
              <span>Full conversation history is transmitted with every request & archived to Supabase.</span>
              <span className="flex items-center gap-1 text-[#8E8B82]">
                <Sparkles className="w-3 h-3 text-[#C5A059]" />
                Powered by Claude + Supabase
              </span>
            </div>
          </form>
        </footer>
      </main>
    </div>
  );
}
