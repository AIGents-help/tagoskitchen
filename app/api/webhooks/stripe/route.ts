import {NextResponse} from "next/server";
import Stripe from "stripe";
import {getStripe} from "@/lib/stripe-server";
import {getSupabaseAdmin} from "@/lib/supabase-server";

export async function POST(request:Request){
 const secret=process.env.STRIPE_WEBHOOK_SECRET,signature=request.headers.get("stripe-signature");
 if(!secret||!signature)return NextResponse.json({error:"Webhook is not configured."},{status:503});
 const stripe=getStripe();let event:Stripe.Event;
 try{event=stripe.webhooks.constructEvent(await request.text(),signature,secret)}catch{return NextResponse.json({error:"Invalid signature."},{status:400})}
 if(event.type==="checkout.session.completed"||event.type==="checkout.session.async_payment_succeeded"){
  const session=event.data.object as Stripe.Checkout.Session;
  if(session.payment_status==="paid"&&session.metadata?.tagos_payment_type==="catering"&&session.metadata.tagos_proposal_id){
   const admin=getSupabaseAdmin(),fee=Number(session.metadata.tagos_platform_fee_cents||0),amount=session.amount_total||0;
   const {error}=await admin.from("catering_payments").upsert({opportunity_id:session.metadata.tagos_opportunity_id,proposal_id:session.metadata.tagos_proposal_id,business_id:session.metadata.tagos_business_id,customer_id:session.metadata.tagos_customer_id,amount_cents:amount,platform_fee_cents:fee,provider_net_cents:amount-fee,status:"succeeded",stripe_checkout_session_id:session.id,stripe_payment_intent_id:String(session.payment_intent||""),updated_at:new Date().toISOString()},{onConflict:"proposal_id"});
   if(error)throw error;
  }
  if(session.payment_status==="paid"&&session.metadata?.tagos_booking_id&&session.metadata?.tagos_invoice_id){
   const admin=getSupabaseAdmin();
   const {error}=await admin.rpc("record_stripe_booking_payment",{
    p_booking_id:session.metadata.tagos_booking_id,
    p_invoice_id:session.metadata.tagos_invoice_id,
    p_checkout_session_id:session.id,
    p_payment_intent_id:String(session.payment_intent||""),
    p_amount_cents:session.amount_total||0,
    p_platform_fee_cents:Number(session.metadata.tagos_platform_fee_cents||0),
    p_created_by:session.metadata.tagos_user_id
   });
   if(error)throw error;
  }
 }
 if(event.type==="account.updated"){
  const account=event.data.object as Stripe.Account,businessId=account.metadata?.tagos_business_id;
  if(businessId){const {error}=await getSupabaseAdmin().from("businesses").update({payouts_enabled:Boolean(account.payouts_enabled&&account.charges_enabled)}).eq("id",businessId);if(error)throw error}
 }
 return NextResponse.json({received:true});
}
