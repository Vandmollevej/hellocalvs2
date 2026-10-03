-- Betalingsmetode: hvilken wallet kortet ligger i hos Stripe (Apple Pay / Google Pay).
CREATE TYPE "PaymentWallet" AS ENUM ('APPLE_PAY', 'GOOGLE_PAY');
ALTER TABLE "payment_methods" ADD COLUMN "wallet" "PaymentWallet";
