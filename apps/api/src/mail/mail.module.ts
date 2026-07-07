import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service';

// Global : MailService injectable partout (notifications RDV, test SMTP admin).
// S'appuie sur SettingsService (lui-même global) pour lire la config SMTP à chaud.
@Global()
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
