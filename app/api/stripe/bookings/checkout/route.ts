import {NextResponse} from "next/server";
import {getStripe,paymentProcessingReady,siteOrigin} from "@/lib/stripe-server";
import {requireSupabaseUser} from "@/lib/supabase-server";

export async function POST(request:Request){
 if(!paymentProcessingReady())return NextResponse.json({error:"Online payments are temporarily unavailable. Please contact the kitchen before paying."},{status:503});
 try{
  const {bookingId}=await request.json() as {bookingId?:string};
  if(!bookingId)return NextResponse.json({error:"Booking is required."},{status:400});
  const {admin,user}=await requireSupabaseUser(request);
  const {data:booking,error:bookingError}=await admin.from("bookings").select("id,kitchen_id,renter_business_id,status,platform_fee_cents").eq("id",bookingId).single();
  if(bookingError)throw bookingError;
  const {data:membership}=await admin.from("business_members").select("business_id").eq("business_id",booking.renter_business_id).eq("user_id",user.id).maybeSingle();
  if(!membership)return NextResponse.json({error:"This invoice does not belong to your business."},{status:403});
  if(booking.status!=="pending_payment")return NextResponse.json({error:"This booking is not awaiting payment."},{status:409});
  const {data:invoice,error:invoiceError}=await admin.from("booking_invoices").select("id,invoice_number,amount_due_cents,amount_paid_cents,status").eq("booking_id",booking.id).single();
  if(invoiceError)throw invoiceError;
  const balance=Math.max(0,invoice.amount_due_cents-invoice.amount_paid_cents);
  if(!balance)return NextResponse.json({error:"This invoice is already paid."},{status:409});
  const {data:kitchen,error:kitchenError}=await admin.from("kitchens").select("id,name,owner_business_id").eq("id",booking.kitchen_id).single();
  if(kitchenError)throw kitchenError;
  const {data:provider,error:providerError}=await admin.from("businesses").select("stripe_account_id,payouts_enabled").eq("id",kitchen.owner_business_id).single();
  if(providerError)throw providerError;
  if(!provider.stripe_account_id||!provider.payouts_enabled)return NextResponse.json({error:"This kitchen is still completing payment setup."},{status:409});
  const {data:prior}=await admin.from("booking_transactions").select("platform_fee_cents").eq("booking_id",booking.id).eq("status","succeeded");
  const feeCollected=(prior||[]).reduce((sum,row)=>sum+(row.platform_fee_cents||0),0);
  const applicationFee=Math.min(balance,Math.max(0,booking.platform_fee_cents-feeCollected));
  const origin=siteOrigin(request),stripe=getStripe();
  const session=await stripe.checkout.sessions.create({mode:"payment",customer_email:user.email,line_items:[{quantity:1,price_data:{currency:"usd",unit_amount:balance,product_data:{name:`${kitchen.name} booking`,description:`TaGo's invoice ${invoice.invoice_number}`}}}],payment_intent_data:{application_fee_amount:applicationFee,transfer_data:{destination:provider.stripe_account_id}},success_url:`${origin}/chef?payment=success&session_id={CHECKOUT_SESSION_ID}`,cancel_url:`${origin}/chef?payment=cancelled`,metadata:{tagos_booking_id:booking.id,tagos_invoice_id:invoice.id,tagos_user_id:user.id,tagos_platform_fee_cents:String(applicationFee)}},{idempotencyKey:`tagos-${invoice.id}-${balance}`});
  return NextResponse.json({url:session.url});
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Unable to start checkout."},{status:400})}
}
