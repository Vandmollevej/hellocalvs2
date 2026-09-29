-- Stripe (MobilePay i Danmark, kort/EC i Tyskland): to nye visningsmaerker.
ALTER TYPE "PaymentMethodBrand" ADD VALUE IF NOT EXISTS 'CARD';
ALTER TYPE "PaymentMethodBrand" ADD VALUE IF NOT EXISTS 'GIROCARD';
