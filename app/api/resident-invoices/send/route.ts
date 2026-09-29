import { NextResponse } from "next/server";
import { requireSupabaseUser } from "@/lib/supabase-server";

const money = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    cents / 100,
  );

export async function POST(request: Request) {
  try {
    const { admin, user } = await requireSupabaseUser(request);
    const { invoiceId } = (await request.json()) as { invoiceId?: string };
    if (!invoiceId)
      return NextResponse.json(
        { error: "Invoice is required." },
        { status: 400 },
      );

    const { data: invoice, error } = await admin
      .from("resident_invoices")
      .select(
        "id,invoice_number,kitchen_id,sponsored_profile_id,billing_period,amount_due_cents,amount_paid_cents,payment_method,paid_at,status,recipient_email",
      )
      .eq("id", invoiceId)
      .single();
    if (error || !invoice)
      return NextResponse.json(
        { error: "Invoice not found." },
        { status: 404 },
      );

    const { data: kitchen } = await admin
      .from("kitchens")
      .select("id,name,address_line1,city,region,postal_code,owner_business_id")
      .eq("id", invoice.kitchen_id)
      .single();
    const { data: member } = kitchen
      ? await admin
          .from("business_members")
          .select("user_id")
          .eq("business_id", kitchen.owner_business_id)
          .eq("user_id", user.id)
          .in("role", ["owner", "manager"])
          .maybeSingle()
      : { data: null };
    const { data: staff } = await admin
      .from("platform_staff")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!kitchen || (!member && !staff))
      return NextResponse.json(
        { error: "Kitchen owner access required." },
        { status: 403 },
      );

    const { data: chef } = await admin
      .from("sponsored_chef_profiles")
      .select("chef_name,business_name,email")
      .eq("id", invoice.sponsored_profile_id)
      .single();
    if (
      !chef ||
      chef.email.toLowerCase() !== invoice.recipient_email.toLowerCase()
    )
      return NextResponse.json(
        { error: "Invoice recipient does not match the Chef Profile." },
        { status: 400 },
      );

    const resendKey = process.env.RESEND_API_KEY;
    const from = process.env.TAGOS_INVOICE_FROM;
    if (!resendKey || !from)
      return NextResponse.json(
        { error: "Invoice email is not configured yet." },
        { status: 503 },
      );
    const month = new Date(
      `${invoice.billing_period}T12:00:00Z`,
    ).toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
    const paid = invoice.paid_at
      ? new Date(invoice.paid_at).toLocaleDateString("en-US", {
          timeZone: "America/New_York",
        })
      : "Recorded";
    const isPaid = invoice.status === "paid";
    const balance = Math.max(
      0,
      invoice.amount_due_cents - invoice.amount_paid_cents,
    );
    const html = `<!doctype html><html><body style="margin:0;background:#f6f0e7;font-family:Arial,sans-serif;color:#1b1a17"><div style="max-width:680px;margin:24px auto;background:#fff;border-radius:16px;overflow:hidden"><div style="background:#191917;padding:24px 32px;border-bottom:6px solid #ef6c22"><div style="font-size:28px;font-weight:900;color:#fff">TaGo's Kitchen</div><div style="color:#f0c6a8;margin-top:4px">${kitchen.address_line1}, ${kitchen.city}, ${kitchen.region} ${kitchen.postal_code || ""}</div></div><div style="padding:32px"><div style="display:inline-block;background:${isPaid ? "#dcfce7" : "#fff0d8"};color:${isPaid ? "#166534" : "#87500b"};font-weight:900;padding:8px 12px;border-radius:999px">${isPaid ? "PAID" : "AMOUNT DUE"}</div><h1 style="margin:18px 0 4px">Resident Rent ${isPaid ? "Receipt" : "Invoice"}</h1><p style="margin:0;color:#666">${invoice.invoice_number}</p><div style="margin:28px 0;padding:20px;border:1px solid #e1d8cc;border-radius:12px"><p><b>Billed to:</b> ${chef.business_name} (${chef.chef_name})</p><p><b>Billing period:</b> ${month}</p><p><b>Description:</b> Resident commissary kitchen rent</p>${isPaid ? `<p><b>Payment method:</b> ${invoice.payment_method || "Recorded payment"}</p><p><b>Payment date:</b> ${paid}</p>` : ""}<p style="font-size:22px"><b>${isPaid ? "Amount paid" : "Amount due"}: ${money(isPaid ? invoice.amount_paid_cents : balance)}</b></p><p><b>Balance due:</b> ${money(balance)}</p></div><p>${isPaid ? "Thank you. This email confirms that your payment was received." : "Please arrange payment with TaGo's Kitchen according to your resident agreement."}</p><p style="margin-top:32px"><b>TaGo's Kitchen</b><br>${kitchen.address_line1}<br>${kitchen.city}, ${kitchen.region} ${kitchen.postal_code || ""}</p></div></div></body></html>`;
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${resendKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [invoice.recipient_email],
        subject: `${isPaid ? "Paid receipt" : "Rent invoice"} ${invoice.invoice_number} - ${month}`,
        html,
      }),
    });
    if (!response.ok) {
      const detail = await response.text();
      console.error("Resend invoice failure", response.status, detail);
      return NextResponse.json(
        { error: "The email provider could not send this invoice." },
        { status: 502 },
      );
    }
    await admin
      .from("resident_invoices")
      .update({
        sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", invoice.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to email invoice.",
      },
      { status: 400 },
    );
  }
}
