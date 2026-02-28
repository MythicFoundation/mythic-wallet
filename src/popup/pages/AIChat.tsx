import React, { useState, useRef, useEffect } from 'react';
import Button from '../components/Button';

const AI_GATEWAY_URL = 'https://ai.mythic.sh';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  meta?: {
    validator?: string;
    tokensGenerated?: number;
    computeUnits?: string;
    latencyMs?: number;
    costSol?: string;
    onChain?: boolean;
  };
}

interface AIChatProps {
  address: string;
  onBack: () => void;
}

export default function AIChat({ address, onBack }: AIChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'system',
      content: 'Ask anything. Your prompts are processed by decentralized GPU validators on Mythic L2.',
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [estimateCost, setEstimateCost] = useState<string | null>(null);
  const [totalSpent, setTotalSpent] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Debounced cost estimate
  useEffect(() => {
    if (!input.trim() || input.trim().length < 3) {
      setEstimateCost(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const resp = await fetch(`${AI_GATEWAY_URL}/v1/estimate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: input.trim(), max_tokens: 512 }),
        });
        if (resp.ok) {
          const data = await resp.json();
          setEstimateCost(data.estimated_cost_sol);
        }
      } catch {
        // Silently fail on estimate
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [input]);

  const sendMessage = async () => {
    const prompt = input.trim();
    if (!prompt || loading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: prompt,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setEstimateCost(null);
    setLoading(true);

    try {
      const resp = await fetch(`${AI_GATEWAY_URL}/v1/inference`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          max_tokens: 512,
          wallet: address,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(err.error ?? `HTTP ${resp.status}`);
      }

      const data = await resp.json();
      const costSol = (Number(data.compute_units) / 1e9).toFixed(6);

      const assistantMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: data.output,
        timestamp: Date.now(),
        meta: {
          validator: data.validator,
          tokensGenerated: data.tokens_generated,
          computeUnits: data.compute_units,
          latencyMs: data.latency_ms,
          costSol,
          onChain: data.on_chain,
        },
      };

      setMessages((prev) => [...prev, assistantMsg]);
      setTotalSpent((prev) => prev + parseFloat(costSol));
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'system',
        content: `Error: ${err.message ?? 'Unknown error'}`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const shortAddr = (addr: string) => `${addr.slice(0, 4)}...${addr.slice(-4)}`;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-subtle bg-surface-card">
        <button onClick={onBack} className="p-1 hover:bg-surface-hover">
          <svg className="w-5 h-5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1">
          <h2 className="font-display text-sm font-bold text-text-heading">Mythic AI</h2>
          <p className="text-[10px] text-text-muted">Decentralized Inference</p>
        </div>
        {totalSpent > 0 && (
          <div className="text-right">
            <p className="text-[10px] text-text-muted">Session cost</p>
            <p className="font-mono text-xs text-rose">{totalSpent.toFixed(6)} SOL</p>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {messages.map((msg) => (
          <div key={msg.id}>
            {msg.role === 'user' ? (
              <div className="flex justify-end">
                <div className="max-w-[85%] bg-rose/15 border border-rose/20 px-3 py-2">
                  <p className="text-sm text-text-heading whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ) : msg.role === 'assistant' ? (
              <div className="flex justify-start">
                <div className="max-w-[85%] bg-surface-elevated border border-subtle px-3 py-2">
                  <p className="text-sm text-text-body whitespace-pre-wrap">{msg.content}</p>
                  {msg.meta && (
                    <div className="mt-2 pt-2 border-t border-subtle">
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-text-muted font-mono">
                        {msg.meta.validator && (
                          <span>Validator: {shortAddr(msg.meta.validator)}</span>
                        )}
                        {msg.meta.tokensGenerated !== undefined && (
                          <span>{msg.meta.tokensGenerated} tokens</span>
                        )}
                        {msg.meta.latencyMs !== undefined && (
                          <span>{msg.meta.latencyMs}ms</span>
                        )}
                        {msg.meta.costSol && (
                          <span className="text-rose">{msg.meta.costSol} SOL</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex justify-center">
                <p className="text-xs text-text-muted italic px-3 py-1">{msg.content}</p>
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-surface-elevated border border-subtle px-3 py-2">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-rose rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-rose rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-rose rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-xs text-text-muted">Processing on validator network...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Cost estimate bar */}
      {estimateCost && !loading && (
        <div className="px-4 py-1.5 bg-surface-elevated border-t border-subtle">
          <p className="text-[10px] text-text-muted font-mono">
            Estimated cost: <span className="text-rose">{estimateCost} SOL</span>
          </p>
        </div>
      )}

      {/* Input */}
      <div className="px-3 py-3 bg-surface-card border-t border-subtle">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Mythic AI..."
            disabled={loading}
            className="flex-1 bg-surface-base border border-subtle px-3 py-2 text-sm text-text-heading placeholder:text-text-disabled font-sans outline-none focus:border-rose/50 transition-colors disabled:opacity-50"
          />
          <Button
            variant="primary"
            size="sm"
            onClick={sendMessage}
            disabled={loading || !input.trim()}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </Button>
        </div>
      </div>
    </div>
  );
}
