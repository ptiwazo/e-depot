-- CreateIndex
CREATE INDEX "Appointment_companyId_idx" ON "Appointment"("companyId");

-- CreateIndex
CREATE INDEX "Appointment_createdById_idx" ON "Appointment"("createdById");

-- CreateIndex
CREATE INDEX "ContainerManifest_containerType_idx" ON "ContainerManifest"("containerType");

-- CreateIndex
CREATE INDEX "ContainerManifest_transporteur_idx" ON "ContainerManifest"("transporteur");

