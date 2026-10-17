ALTER TABLE "users" ADD COLUMN "adminWarningEmails" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "admin_warning_mails" (
    "key" TEXT NOT NULL,
    "lastMailedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_warning_mails_pkey" PRIMARY KEY ("key")
);
