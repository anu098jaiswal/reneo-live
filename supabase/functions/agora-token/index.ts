// Supabase Edge Function — generates Agora RTC tokens server-side.
// The Agora App Certificate NEVER reaches the browser or the git repo —
// it lives only as a Supabase secret. This is what A10 requires:
// "Agora tokens must be generated server-side."
//
// Deploy:
//   supabase functions deploy agora-token
//   supabase secrets set AGORA_APP_ID=xxx AGORA_APP_CERTIFICATE=xxx
//
// Called from the client via supabase.functions.invoke('agora-token', { body: { channel, uid, role } })

import { serve } from 'https://deno.land/std@0.192.0/http/server.ts'
import { RtcTokenBuilder, RtcRole } from 'npm:agora-token@2.0.5'

const APP_ID = Deno.env.get('AGORA_APP_ID')!
const APP_CERTIFICATE = Deno.env.get('AGORA_APP_CERTIFICATE')!
const TOKEN_EXPIRY_SECONDS = 3600 // 1 hour — re-fetch on reconnect if a live runs longer

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { channel, uid, role } = await req.json()

    if (!channel || uid === undefined || !role) {
      return new Response(JSON.stringify({ error: 'channel, uid, and role are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const agoraRole = role === 'host' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER
    const expireTimestamp = Math.floor(Date.now() / 1000) + TOKEN_EXPIRY_SECONDS

    const token = RtcTokenBuilder.buildTokenWithUid(
      APP_ID,
      APP_CERTIFICATE,
      channel,
      uid,
      agoraRole,
      expireTimestamp
    )

    return new Response(JSON.stringify({ token }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
