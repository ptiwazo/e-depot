import { Global, Module } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';

// Global : injectable partout (notifications RDV, test admin). S'appuie sur SettingsService (global).
@Global()
@Module({
  providers: [WhatsappService],
  exports: [WhatsappService],
})
export class WhatsappModule {}
