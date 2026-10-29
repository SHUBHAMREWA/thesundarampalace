-- Optional ID number on customer / bride-groom documents (Aadhaar is stored masked).
ALTER TABLE "customer_document" ADD COLUMN "idNumber" TEXT;
