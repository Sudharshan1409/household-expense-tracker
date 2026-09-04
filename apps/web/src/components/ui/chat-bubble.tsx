"use client";

import { useChat } from '@ai-sdk/react';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Send, Loader2, Bot, User, Maximize2, Minimize2, Trash2, Sparkles } from 'lucide-react';
import { useHousehold } from '@/components/providers/household-provider';
import { fetchAuthSession } from 'aws-amplify/auth';
import { DefaultChatTransport, isToolUIPart, getToolName } from 'ai';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export function ChatBubble() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const { activeHousehold } = useHousehold();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchAuthSession().then(session => {
      setToken(session.tokens?.idToken?.toString() || null);
    });
  }, []);

  const [input, setInput] = useState('');
  
  const tokenRef = useRef(token);
  tokenRef.current = token;

  const { messages, setMessages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
      headers: () => (tokenRef.current ? { Authorization: `Bearer ${tokenRef.current}` } : {}) as Record<string, string>,
    })
  });

  const isLoading = status === 'submitted' || status === 'streaming';

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  if (!activeHousehold?.householdId || !token) return null;

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    
    const userMessage = input;
    setInput('');
    
    sendMessage({ text: userMessage }, {
      body: {
        data: {
          householdId: activeHousehold.householdId
        }
      }
    });
  };

  return (
    <div className="fixed bottom-[184px] md:bottom-6 right-4 md:right-6 z-50 flex flex-col items-end">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className={`mb-4 bg-background border rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 origin-bottom-right ${
              isMaximized
                ? 'w-[90vw] md:w-[700px] lg:w-[800px] h-[70vh] md:h-[700px] max-h-[85vh]'
                : 'w-[350px] sm:w-[400px] h-[500px]'
            }`}
          >
            {/* Header */}
            <div className="bg-primary p-4 flex items-center justify-between text-primary-foreground">
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5" />
                <h3 className="font-semibold">AI Financial Advisor</h3>
              </div>
              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <button 
                    onClick={() => setMessages([])} 
                    className="hover:bg-primary-foreground/20 p-1 rounded-md transition-colors mr-1"
                    title="Clear Chat"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
                <button onClick={() => setIsMaximized(!isMaximized)} className="hover:bg-primary-foreground/20 p-1 rounded-md transition-colors" title={isMaximized ? "Minimize" : "Maximize"}>
                  {isMaximized ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
                </button>
                <button onClick={() => setIsOpen(false)} className="hover:bg-primary-foreground/20 p-1 rounded-md transition-colors" title="Close">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/30">
              {messages.length === 0 && (
                <div className="text-center text-muted-foreground mt-10 space-y-3">
                  <Bot className="h-10 w-10 mx-auto opacity-50" />
                  <p className="text-sm">Hi! I have access to your household data. Ask me anything about your spending, tags, or savings!</p>
                </div>
              )}
              
              {messages.map(m => {
                if (m.role === 'system' || (m.parts && m.parts.length === 0)) return null;
                
                const isUser = m.role === 'user';
                return (
                  <div key={m.id} className={`flex gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
                    {!isUser && (
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Bot className="h-4 w-4 text-primary" />
                      </div>
                    )}
                    
                    <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${isUser ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-card border rounded-tl-sm shadow-sm'}`}>
                      {m.parts?.map((part: any, index: number) => {
                        if (part.type === 'text') {
                          return (
                            <div key={index} className="prose prose-sm dark:prose-invert max-w-none prose-tables:border-collapse prose-th:border prose-th:border-border prose-th:p-2 prose-td:border prose-td:border-border prose-td:p-2">
                              <ReactMarkdown 
                                remarkPlugins={[remarkGfm]}
                                components={{
                                  table: ({node, ...props}) => (
                                    <div className="overflow-x-auto w-full mb-4">
                                      <table {...props} className="min-w-full" />
                                    </div>
                                  )
                                }}
                              >
                                {part.text}
                              </ReactMarkdown>
                            </div>
                          );
                        } else if (isToolUIPart(part)) {
                          const toolName = getToolName(part);
                          const resultData = part.output;
                          
                          if (toolName === 'getMonthlySummaries' && part.state === 'output-available' && resultData && Array.isArray(resultData) && resultData.length > 0) {
                            const chartData = resultData.map((item: any) => {
                              let totalIncome = 0;
                              let totalSpend = 0;
                              if (item.users) {
                                Object.values(item.users).forEach((u: any) => {
                                  totalIncome += u.income || 0;
                                  totalSpend += u.spend || 0;
                                });
                              }
                              return {
                                name: item.month,
                                Income: totalIncome,
                                Spend: totalSpend,
                              };
                            }).sort((a: any, b: any) => a.name.localeCompare(b.name));
                            
                            return (
                              <div key={index} className="mt-4 mb-2 p-3 bg-background border rounded-xl shadow-sm">
                                <h4 className="text-xs font-semibold mb-3 text-muted-foreground flex items-center gap-2">
                                  📊 Interactive Trend
                                </h4>
                                <div className="h-[200px] w-full">
                                  <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData}>
                                      <XAxis dataKey="name" fontSize={10} tickMargin={5} axisLine={false} tickLine={false} />
                                      <YAxis fontSize={10} width={40} axisLine={false} tickLine={false} tickFormatter={(val) => `₹${val}`} />
                                      <Tooltip 
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                                        formatter={(value: any) => [`₹${value}`, '']}
                                      />
                                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                                      <Bar dataKey="Income" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={30} />
                                      <Bar dataKey="Spend" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={30} />
                                    </BarChart>
                                  </ResponsiveContainer>
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div key={index} className="mt-2 text-xs opacity-70 italic border-t border-current/20 pt-1">
                              {part.state === 'output-available' ? `✓ Queried ${toolName || 'tool'}` : `⟳ Fetching ${toolName || 'tool'}...`}
                            </div>
                          );
                        }
                        return null;
                      })}
                    </div>

                    {isUser && (
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <User className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                );
              })}
              {isLoading && messages[messages.length - 1]?.role === 'user' && (
                 <div className="flex justify-start gap-2">
                   <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                     <Loader2 className="h-4 w-4 text-primary animate-spin" />
                   </div>
                 </div>
              )}
              {error && (
                <div className="p-3 m-4 bg-destructive/10 text-destructive text-sm rounded-md border border-destructive/20">
                  <p className="font-semibold">Error connecting to AI:</p>
                  <p>{error.message || "Unknown error occurred"}</p>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <form onSubmit={handleFormSubmit} className="p-3 border-t bg-background flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about your finances..."
                className="flex-1 rounded-full bg-muted/50 focus-visible:ring-primary/50"
              />
              <Button 
                type="submit" 
                size="icon" 
                disabled={!input.trim() || isLoading} 
                className={`rounded-full shrink-0 ${(!input.trim() || isLoading) ? 'opacity-50 pointer-events-none' : ''}`}
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <Button
        onClick={() => setIsOpen(!isOpen)}
        size="icon"
        className="h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 hover:scale-105 border-0 text-white relative"
      >
        {!isOpen && (
          <span className="absolute -inset-1 animate-pulse rounded-full bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 opacity-40 blur-sm"></span>
        )}
        <div className="relative z-10 flex items-center justify-center">
          {isOpen ? <X className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />}
        </div>
      </Button>
    </div>
  );
}
