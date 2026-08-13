import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { ChatMessage } from '../types'

interface Props {
  sessionId: string
}

interface DisplayMessage extends ChatMessage {
  senderName?: string
}

export default function Chat({ sessionId }: Props) {
  const { profile } = useAuth()
  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false

    async function loadHistory() {
      const { data, error: fetchError } = await supabase
        .from('chat_messages')
        .select('*, profiles(name)')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true })

      if (fetchError) {
        setError('Could not load chat history.')
        return
      }
      if (!cancelled && data) {
        setMessages(
          data.map((m: any) => ({ ...m, senderName: m.profiles?.name ?? 'User' }))
        )
      }
    }

    loadHistory()

    // Supabase Realtime: subscribe to new inserts for this session only.
    const channel = supabase
      .channel(`chat:${sessionId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `session_id=eq.${sessionId}` },
        payload => {
          setMessages(prev => [...prev, payload.new as DisplayMessage])
        }
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [sessionId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim() || !profile) return
    setError('')

    const { error: sendError } = await supabase.from('chat_messages').insert({
      session_id: sessionId,
      user_id: profile.id,
      message: text.trim(),
    })

    if (sendError) {
      setError('Message failed to send. Check your connection and try again.')
      return
    }
    setText('')
  }

  return (
    <div className="chat-box">
      <div className="chat-messages">
        {messages.map(m => (
          <div key={m.id} className="chat-message">
            <strong>{m.senderName ?? 'User'}: </strong>
            <span>{m.message}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      {error && <p className="error">{error}</p>}
      <form onSubmit={sendMessage} className="chat-input">
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Say something..."
          maxLength={500}
        />
        <button type="submit">Send</button>
      </form>
    </div>
  )
}
