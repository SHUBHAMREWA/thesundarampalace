-- The day the booking was taken, separate from the event dates (additive, nullable).
ALTER TABLE "booking" ADD COLUMN "bookedOn" DATE;
