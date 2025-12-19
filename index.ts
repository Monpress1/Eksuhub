import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import webpush from "npm:web-push@3.6.6"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Your VAPID Keys
const VAPID_PUBLIC = "BCsdeMpKPh58L1p16fhaZvmIwyQF9mgp1IRwO39bxSc6qtefudhOlSSgdk5sILLtgUsoEqbNu5NccmCjt_RBkU4"
const VAPID_PRIVATE = "ts7tftMSG5vfyNg8WUBSyzUinyLG79ixA6Ch44seux4"
const VAPID_SUBJECT = "mailto:elimonpresss@gmail.com"

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json()
    console.log("Incoming Webhook Payload:", JSON.stringify(body))

    const record = body.record || body
    const subscription = record.subscription_json || record.subscription || body.subscription

    if (!subscription?.endpoint) {
      console.error("No subscription found in payload.")
      return new Response(JSON.stringify({ error: "Missing subscription endpoint" }), { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      })
    }

    // 3. Determine the Message Content
    let titleText = record.title || "EksuHub"
    let messageText = record.content || record.message || "You Have New activity on your Hub!"

    if (body.table === 'push_subscriptions') {
      titleText = "Welcome to EksuHub! 🚀"
      messageText = "You have successfully enabled push notifications."
    }

    // 4. Configure VAPID
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)

    // 5. Prepare and Send (Updated with your Logo URL)
    const pushPayload = JSON.stringify({
      title: titleText,
      body: messageText,
      icon: "https://wfhaiasdkkmwjzrndcmi.supabase.co/storage/v1/object/public/assets/logo.jpg",
      badge: "https://wfhaiasdkkmwjzrndcmi.supabase.co/storage/v1/object/public/assets/logo.jpg", // Small icon for status bar
      data: {
        url: "https://eksuhub.vercel.app" // Opens your app when clicked
      }
    })

    console.log(`Sending push to endpoint: ${subscription.endpoint}`)
    const response = await webpush.sendNotification(subscription, pushPayload)

    return new Response(JSON.stringify({ status: response.statusCode }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200
    })

  } catch (err) {
    console.error("Push delivery failed:", err.message)
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200 
    })
  }
})
