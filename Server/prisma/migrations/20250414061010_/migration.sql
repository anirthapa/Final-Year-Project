-- AlterTable
ALTER TABLE "User" ADD COLUMN     "otpAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "otpLastSent" TIMESTAMP(3),
ADD COLUMN     "resetOTP" TEXT,
ADD COLUMN     "resetOTPExpiry" TIMESTAMP(3),
ADD COLUMN     "resetPasswordExpiry" TIMESTAMP(3),
ADD COLUMN     "resetPasswordToken" TEXT;
