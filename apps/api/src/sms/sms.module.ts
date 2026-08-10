import { Global, Module } from '@nestjs/common';
import { SmsService } from './sms.service';

// Global : injectable partout (notifications RDV, test admin). S'appuie sur SettingsService (global).
@Global()
@Module({
  providers: [SmsService],
  exports: [SmsService],
})
export class SmsModule {}
