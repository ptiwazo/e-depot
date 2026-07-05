-- AlterTable
ALTER TABLE "User" ADD COLUMN     "activationToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_activationToken_key" ON "User"("activationToken");

