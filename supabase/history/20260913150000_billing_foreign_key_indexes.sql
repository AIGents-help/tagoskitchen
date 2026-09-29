create index booking_invoices_issued_by_idx on public.booking_invoices(issued_by);
create index refund_requests_invoice_idx on public.refund_requests(invoice_id);
create index refund_requests_processed_transaction_idx on public.refund_requests(processed_transaction_id);
create index refund_requests_requested_by_idx on public.refund_requests(requested_by);
create index refund_requests_reviewed_by_idx on public.refund_requests(reviewed_by);
